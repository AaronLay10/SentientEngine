package api

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func resetAuth() {
	auth = nil
}

func TestAuthDisabledWhenNoEnvVars(t *testing.T) {
	resetAuth()

	// Simulate no env vars set
	auth = &authConfig{
		enabled: false,
	}

	if IsAuthEnabled() {
		t.Error("auth should be disabled when no env vars are set")
	}

	// Create a test handler
	called := false
	handler := RequireAnyRole(func(w http.ResponseWriter, r *http.Request) {
		called = true
		w.WriteHeader(http.StatusOK)
	})

	// Make request without credentials
	req := httptest.NewRequest("GET", "/test", nil)
	w := httptest.NewRecorder()

	handler(w, req)

	if !called {
		t.Error("handler should be called when auth is disabled")
	}
	if w.Code != http.StatusOK {
		t.Errorf("expected status 200, got %d", w.Code)
	}
}

func TestAuthEnabledRequiresCredentials(t *testing.T) {
	resetAuth()

	// Enable auth with admin credentials
	auth = &authConfig{
		adminUser:    "admin",
		adminPass:    "secret",
		operatorUser: "operator",
		operatorPass: "opsecret",
		enabled:      true,
	}

	if !IsAuthEnabled() {
		t.Error("auth should be enabled")
	}

	// Create a test handler
	called := false
	handler := RequireAnyRole(func(w http.ResponseWriter, r *http.Request) {
		called = true
		w.WriteHeader(http.StatusOK)
	})

	// Make request without credentials
	req := httptest.NewRequest("GET", "/test", nil)
	w := httptest.NewRecorder()

	handler(w, req)

	if called {
		t.Error("handler should NOT be called without credentials")
	}
	if w.Code != http.StatusUnauthorized {
		t.Errorf("expected status 401, got %d", w.Code)
	}
	if w.Header().Get("WWW-Authenticate") == "" {
		t.Error("expected WWW-Authenticate header")
	}
}

func TestValidAdminCredentials(t *testing.T) {
	resetAuth()

	auth = &authConfig{
		adminUser:    "admin",
		adminPass:    "secret",
		operatorUser: "operator",
		operatorPass: "opsecret",
		enabled:      true,
	}

	called := false
	handler := RequireAnyRole(func(w http.ResponseWriter, r *http.Request) {
		called = true
		w.WriteHeader(http.StatusOK)
	})

	req := httptest.NewRequest("GET", "/test", nil)
	req.SetBasicAuth("admin", "secret")
	w := httptest.NewRecorder()

	handler(w, req)

	if !called {
		t.Error("handler should be called with valid admin credentials")
	}
	if w.Code != http.StatusOK {
		t.Errorf("expected status 200, got %d", w.Code)
	}
}

func TestValidOperatorCredentials(t *testing.T) {
	resetAuth()

	auth = &authConfig{
		adminUser:    "admin",
		adminPass:    "secret",
		operatorUser: "operator",
		operatorPass: "opsecret",
		enabled:      true,
	}

	called := false
	handler := RequireAnyRole(func(w http.ResponseWriter, r *http.Request) {
		called = true
		w.WriteHeader(http.StatusOK)
	})

	req := httptest.NewRequest("GET", "/test", nil)
	req.SetBasicAuth("operator", "opsecret")
	w := httptest.NewRecorder()

	handler(w, req)

	if !called {
		t.Error("handler should be called with valid operator credentials")
	}
	if w.Code != http.StatusOK {
		t.Errorf("expected status 200, got %d", w.Code)
	}
}

func TestInvalidCredentialsRejected(t *testing.T) {
	resetAuth()

	auth = &authConfig{
		adminUser:    "admin",
		adminPass:    "secret",
		operatorUser: "operator",
		operatorPass: "opsecret",
		enabled:      true,
	}

	called := false
	handler := RequireAnyRole(func(w http.ResponseWriter, r *http.Request) {
		called = true
		w.WriteHeader(http.StatusOK)
	})

	req := httptest.NewRequest("GET", "/test", nil)
	req.SetBasicAuth("admin", "wrongpassword")
	w := httptest.NewRecorder()

	handler(w, req)

	if called {
		t.Error("handler should NOT be called with invalid credentials")
	}
	if w.Code != http.StatusUnauthorized {
		t.Errorf("expected status 401, got %d", w.Code)
	}
}

func TestAdminOnlyEndpointAllowsAdmin(t *testing.T) {
	resetAuth()

	auth = &authConfig{
		adminUser:    "admin",
		adminPass:    "secret",
		operatorUser: "operator",
		operatorPass: "opsecret",
		enabled:      true,
	}

	called := false
	handler := RequireAdmin(func(w http.ResponseWriter, r *http.Request) {
		called = true
		w.WriteHeader(http.StatusOK)
	})

	req := httptest.NewRequest("POST", "/game/start", nil)
	req.SetBasicAuth("admin", "secret")
	w := httptest.NewRecorder()

	handler(w, req)

	if !called {
		t.Error("admin-only handler should be called with admin credentials")
	}
	if w.Code != http.StatusOK {
		t.Errorf("expected status 200, got %d", w.Code)
	}
}

func TestAdminOnlyEndpointRejectsOperator(t *testing.T) {
	resetAuth()

	auth = &authConfig{
		adminUser:    "admin",
		adminPass:    "secret",
		operatorUser: "operator",
		operatorPass: "opsecret",
		enabled:      true,
	}

	called := false
	handler := RequireAdmin(func(w http.ResponseWriter, r *http.Request) {
		called = true
		w.WriteHeader(http.StatusOK)
	})

	req := httptest.NewRequest("POST", "/game/start", nil)
	req.SetBasicAuth("operator", "opsecret")
	w := httptest.NewRecorder()

	handler(w, req)

	if called {
		t.Error("admin-only handler should NOT be called with operator credentials")
	}
	if w.Code != http.StatusForbidden {
		t.Errorf("expected status 403, got %d", w.Code)
	}
}

func TestAuthWithOnlyAdminConfigured(t *testing.T) {
	resetAuth()

	// Only admin credentials set (operator not configured)
	auth = &authConfig{
		adminUser: "admin",
		adminPass: "secret",
		enabled:   true,
	}

	called := false
	handler := RequireAnyRole(func(w http.ResponseWriter, r *http.Request) {
		called = true
		w.WriteHeader(http.StatusOK)
	})

	// Admin should work
	req := httptest.NewRequest("GET", "/test", nil)
	req.SetBasicAuth("admin", "secret")
	w := httptest.NewRecorder()

	handler(w, req)

	if !called {
		t.Error("handler should be called with valid admin credentials")
	}
	if w.Code != http.StatusOK {
		t.Errorf("expected status 200, got %d", w.Code)
	}

	// Unknown user should fail
	called = false
	req2 := httptest.NewRequest("GET", "/test", nil)
	req2.SetBasicAuth("operator", "anything")
	w2 := httptest.NewRecorder()

	handler(w2, req2)

	if called {
		t.Error("handler should NOT be called with unconfigured operator")
	}
	if w2.Code != http.StatusUnauthorized {
		t.Errorf("expected status 401, got %d", w2.Code)
	}
}

func TestSecureCompare(t *testing.T) {
	if !secureCompare("test", "test") {
		t.Error("identical strings should match")
	}
	if secureCompare("test", "Test") {
		t.Error("different case should not match")
	}
	if secureCompare("test", "test1") {
		t.Error("different strings should not match")
	}
	if secureCompare("", "test") {
		t.Error("empty vs non-empty should not match")
	}
}
