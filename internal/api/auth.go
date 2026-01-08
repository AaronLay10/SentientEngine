package api

import (
	"crypto/subtle"
	"log"
	"net/http"

	"github.com/AaronLay10/SentientEngine/internal/config"
)

// Role represents an authorization role.
type Role string

const (
	RoleAdmin    Role = "admin"
	RoleOperator Role = "operator"
)

// authConfig holds credentials loaded from environment variables.
type authConfig struct {
	adminUser    string
	adminPass    string
	operatorUser string
	operatorPass string
	enabled      bool
}

var auth *authConfig

// InitAuth loads auth credentials from environment variables or files.
// Supports *_FILE convention: if SENTIENT_ADMIN_USER_FILE is set, reads from that file.
// If none are set, authentication is disabled (dev-friendly).
func InitAuth() {
	adminUser, err := config.ResolveSecret("SENTIENT_ADMIN_USER")
	if err != nil {
		log.Fatalf("failed to resolve SENTIENT_ADMIN_USER: %v", err)
	}
	adminPass, err := config.ResolveSecret("SENTIENT_ADMIN_PASS")
	if err != nil {
		log.Fatalf("failed to resolve SENTIENT_ADMIN_PASS: %v", err)
	}
	operatorUser, err := config.ResolveSecret("SENTIENT_OPERATOR_USER")
	if err != nil {
		log.Fatalf("failed to resolve SENTIENT_OPERATOR_USER: %v", err)
	}
	operatorPass, err := config.ResolveSecret("SENTIENT_OPERATOR_PASS")
	if err != nil {
		log.Fatalf("failed to resolve SENTIENT_OPERATOR_PASS: %v", err)
	}

	// Auth is enabled only if at least admin credentials are set
	enabled := adminUser != "" && adminPass != ""

	auth = &authConfig{
		adminUser:    adminUser,
		adminPass:    adminPass,
		operatorUser: operatorUser,
		operatorPass: operatorPass,
		enabled:      enabled,
	}
}

// IsAuthEnabled returns true if authentication is configured.
func IsAuthEnabled() bool {
	return auth != nil && auth.enabled
}

// authenticate checks basic auth credentials and returns the role if valid.
// Returns empty string if credentials are invalid.
func authenticate(r *http.Request) Role {
	if auth == nil || !auth.enabled {
		return RoleAdmin // No auth configured = full access
	}

	user, pass, ok := r.BasicAuth()
	if !ok {
		return ""
	}

	// Check admin credentials
	if auth.adminUser != "" && auth.adminPass != "" {
		if secureCompare(user, auth.adminUser) && secureCompare(pass, auth.adminPass) {
			return RoleAdmin
		}
	}

	// Check operator credentials
	if auth.operatorUser != "" && auth.operatorPass != "" {
		if secureCompare(user, auth.operatorUser) && secureCompare(pass, auth.operatorPass) {
			return RoleOperator
		}
	}

	return ""
}

// secureCompare performs constant-time string comparison to prevent timing attacks.
func secureCompare(a, b string) bool {
	return subtle.ConstantTimeCompare([]byte(a), []byte(b)) == 1
}

// requireAuth returns 401 Unauthorized with WWW-Authenticate header.
func requireAuth(w http.ResponseWriter) {
	w.Header().Set("WWW-Authenticate", `Basic realm="Sentient Engine"`)
	http.Error(w, "Unauthorized", http.StatusUnauthorized)
}

// RequireRole wraps a handler and requires one of the specified roles.
func RequireRole(handler http.HandlerFunc, allowedRoles ...Role) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		role := authenticate(r)
		if role == "" {
			requireAuth(w)
			return
		}

		// Check if user's role is allowed
		for _, allowed := range allowedRoles {
			if role == allowed {
				handler(w, r)
				return
			}
		}

		// Role not authorized for this endpoint
		http.Error(w, "Forbidden", http.StatusForbidden)
	}
}

// RequireAnyRole wraps a handler requiring admin OR operator role.
func RequireAnyRole(handler http.HandlerFunc) http.HandlerFunc {
	return RequireRole(handler, RoleAdmin, RoleOperator)
}

// RequireAdmin wraps a handler requiring admin role only.
func RequireAdmin(handler http.HandlerFunc) http.HandlerFunc {
	return RequireRole(handler, RoleAdmin)
}
