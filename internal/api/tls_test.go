package api

import (
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"
)

func TestInitTLS_NoEnvVars(t *testing.T) {
	// Clear any existing env vars
	os.Unsetenv("SENTIENT_TLS_CERT")
	os.Unsetenv("SENTIENT_TLS_KEY")

	// Reset global state
	SetTLSConfigForTest(nil)

	InitTLS()

	if IsTLSEnabled() {
		t.Error("TLS should not be enabled when env vars are not set")
	}
}

func TestInitTLS_OnlyCert(t *testing.T) {
	os.Setenv("SENTIENT_TLS_CERT", "/path/to/cert.pem")
	os.Unsetenv("SENTIENT_TLS_KEY")
	defer os.Unsetenv("SENTIENT_TLS_CERT")

	SetTLSConfigForTest(nil)
	InitTLS()

	if IsTLSEnabled() {
		t.Error("TLS should not be enabled when only cert is set")
	}
}

func TestInitTLS_OnlyKey(t *testing.T) {
	os.Unsetenv("SENTIENT_TLS_CERT")
	os.Setenv("SENTIENT_TLS_KEY", "/path/to/key.pem")
	defer os.Unsetenv("SENTIENT_TLS_KEY")

	SetTLSConfigForTest(nil)
	InitTLS()

	if IsTLSEnabled() {
		t.Error("TLS should not be enabled when only key is set")
	}
}

func TestInitTLS_BothSet(t *testing.T) {
	os.Setenv("SENTIENT_TLS_CERT", "/path/to/cert.pem")
	os.Setenv("SENTIENT_TLS_KEY", "/path/to/key.pem")
	defer func() {
		os.Unsetenv("SENTIENT_TLS_CERT")
		os.Unsetenv("SENTIENT_TLS_KEY")
	}()

	SetTLSConfigForTest(nil)
	InitTLS()

	if !IsTLSEnabled() {
		t.Error("TLS should be enabled when both cert and key are set")
	}

	cfg := GetTLSConfig()
	if cfg == nil {
		t.Fatal("GetTLSConfig should return non-nil when TLS is enabled")
	}
	if cfg.CertFile != "/path/to/cert.pem" {
		t.Errorf("CertFile = %q, want %q", cfg.CertFile, "/path/to/cert.pem")
	}
	if cfg.KeyFile != "/path/to/key.pem" {
		t.Errorf("KeyFile = %q, want %q", cfg.KeyFile, "/path/to/key.pem")
	}
}

func TestLoadTLSConfig_NotEnabled(t *testing.T) {
	SetTLSConfigForTest(nil)

	cfg := LoadTLSConfig()
	if cfg != nil {
		t.Error("LoadTLSConfig should return nil when TLS is not enabled")
	}
}

func TestLoadTLSConfig_InvalidFiles(t *testing.T) {
	SetTLSConfigForTest(&TLSConfig{
		CertFile: "/nonexistent/cert.pem",
		KeyFile:  "/nonexistent/key.pem",
	})

	cfg := LoadTLSConfig()
	if cfg != nil {
		t.Error("LoadTLSConfig should return nil when cert files don't exist")
	}
}

func TestRedirectServer_HealthNoRedirect(t *testing.T) {
	srv := NewRedirectServer(8080, 8523) // 8080 + 443 = 8523

	req := httptest.NewRequest("GET", "/health", nil)
	req.Host = "localhost:8080"
	w := httptest.NewRecorder()

	srv.Handler.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("/health should return 200, got %d", w.Code)
	}

	// Should not have Location header (no redirect)
	if loc := w.Header().Get("Location"); loc != "" {
		t.Errorf("/health should not redirect, got Location: %s", loc)
	}
}

func TestRedirectServer_ReadyNoRedirect(t *testing.T) {
	// Set orchestrator ready for test
	SetOrchestratorReady(true)
	SetMQTTState(true, false)
	SetPostgresState(true, false)
	defer func() {
		SetOrchestratorReady(false)
		SetMQTTState(false, true)
		SetPostgresState(false, true)
	}()

	srv := NewRedirectServer(8080, 8523) // 8080 + 443 = 8523

	req := httptest.NewRequest("GET", "/ready", nil)
	req.Host = "localhost:8080"
	w := httptest.NewRecorder()

	srv.Handler.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("/ready should return 200, got %d", w.Code)
	}

	if loc := w.Header().Get("Location"); loc != "" {
		t.Errorf("/ready should not redirect, got Location: %s", loc)
	}
}

func TestRedirectServer_UIRedirects(t *testing.T) {
	srv := NewRedirectServer(8080, 8523) // 8080 + 443 = 8523

	req := httptest.NewRequest("GET", "/ui", nil)
	req.Host = "localhost:8080"
	w := httptest.NewRecorder()

	srv.Handler.ServeHTTP(w, req)

	if w.Code != http.StatusMovedPermanently {
		t.Errorf("/ui should return 301, got %d", w.Code)
	}

	loc := w.Header().Get("Location")
	if !strings.HasPrefix(loc, "https://") {
		t.Errorf("Location should start with https://, got %s", loc)
	}
	if !strings.Contains(loc, ":8523") {
		t.Errorf("Location should contain :8523, got %s", loc)
	}
	if !strings.HasSuffix(loc, "/ui") {
		t.Errorf("Location should end with /ui, got %s", loc)
	}
}

func TestRedirectServer_PreservesQueryString(t *testing.T) {
	srv := NewRedirectServer(8080, 8523) // 8080 + 443 = 8523

	req := httptest.NewRequest("GET", "/events?limit=100", nil)
	req.Host = "localhost:8080"
	w := httptest.NewRecorder()

	srv.Handler.ServeHTTP(w, req)

	if w.Code != http.StatusMovedPermanently {
		t.Errorf("should return 301, got %d", w.Code)
	}

	loc := w.Header().Get("Location")
	if !strings.Contains(loc, "?limit=100") {
		t.Errorf("Location should preserve query string, got %s", loc)
	}
}

func TestRedirectServer_WSEventsRedirects(t *testing.T) {
	srv := NewRedirectServer(8080, 8523) // 8080 + 443 = 8523

	req := httptest.NewRequest("GET", "/ws/events", nil)
	req.Host = "localhost:8080"
	w := httptest.NewRecorder()

	srv.Handler.ServeHTTP(w, req)

	if w.Code != http.StatusMovedPermanently {
		t.Errorf("/ws/events should return 301, got %d", w.Code)
	}

	loc := w.Header().Get("Location")
	if !strings.HasPrefix(loc, "https://") {
		t.Errorf("Location should start with https://, got %s", loc)
	}
}
