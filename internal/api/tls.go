package api

import (
	"crypto/tls"
	"fmt"
	"log"
	"net/http"

	"github.com/AaronLay10/SentientEngine/internal/config"
)

// TLSConfig holds TLS certificate paths loaded from environment variables.
type TLSConfig struct {
	CertFile string
	KeyFile  string
}

// tlsConfig is the package-level TLS configuration, set by InitTLS.
var tlsConfig *TLSConfig

// InitTLS loads TLS configuration from environment variables or files.
// Supports *_FILE convention: if SENTIENT_TLS_CERT_FILE is set, reads the path from that file.
// Call this before starting the server.
func InitTLS() {
	certFile, err := config.ResolveSecret("SENTIENT_TLS_CERT")
	if err != nil {
		log.Fatalf("failed to resolve SENTIENT_TLS_CERT: %v", err)
	}
	keyFile, err := config.ResolveSecret("SENTIENT_TLS_KEY")
	if err != nil {
		log.Fatalf("failed to resolve SENTIENT_TLS_KEY: %v", err)
	}

	if certFile != "" && keyFile != "" {
		tlsConfig = &TLSConfig{
			CertFile: certFile,
			KeyFile:  keyFile,
		}
	}
}

// IsTLSEnabled returns true if TLS is configured.
func IsTLSEnabled() bool {
	return tlsConfig != nil && tlsConfig.CertFile != "" && tlsConfig.KeyFile != ""
}

// GetTLSConfig returns the current TLS configuration (may be nil).
func GetTLSConfig() *TLSConfig {
	return tlsConfig
}

// LoadTLSConfig loads a tls.Config from the cert and key files.
// Returns nil and logs an error if loading fails.
func LoadTLSConfig() *tls.Config {
	if !IsTLSEnabled() {
		return nil
	}

	cert, err := tls.LoadX509KeyPair(tlsConfig.CertFile, tlsConfig.KeyFile)
	if err != nil {
		log.Printf("Failed to load TLS certificate: %v", err)
		return nil
	}

	return &tls.Config{
		Certificates: []tls.Certificate{cert},
		MinVersion:   tls.VersionTLS12,
	}
}

// SetTLSConfigForTest allows tests to set TLS config directly.
func SetTLSConfigForTest(cfg *TLSConfig) {
	tlsConfig = cfg
}

// NewRedirectServer creates an HTTP server that redirects to HTTPS.
// /health and /ready are served directly (no redirect) for health checks.
// All other paths redirect to HTTPS on the specified port.
func NewRedirectServer(httpPort, httpsPort int) *http.Server {
	mux := http.NewServeMux()

	// Health check endpoints served directly (no redirect)
	mux.HandleFunc("/health", healthHandler)
	mux.HandleFunc("/ready", readyHandler)

	// All other requests redirect to HTTPS
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		httpsURL := fmt.Sprintf("https://%s:%d%s", r.Host, httpsPort, r.URL.RequestURI())
		// Strip port from host if present
		if host := r.Host; host != "" {
			// Remove existing port if any
			for i := len(host) - 1; i >= 0; i-- {
				if host[i] == ':' {
					host = host[:i]
					break
				} else if host[i] < '0' || host[i] > '9' {
					break
				}
			}
			httpsURL = fmt.Sprintf("https://%s:%d%s", host, httpsPort, r.URL.RequestURI())
		}
		http.Redirect(w, r, httpsURL, http.StatusMovedPermanently)
	})

	return &http.Server{
		Addr:    fmt.Sprintf(":%d", httpPort),
		Handler: mux,
	}
}
