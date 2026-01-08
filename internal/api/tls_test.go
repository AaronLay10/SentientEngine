package api

import (
	"os"
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
