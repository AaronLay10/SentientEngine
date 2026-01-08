package config

import (
	"os"
	"path/filepath"
	"testing"
)

func TestResolveSecret_EnvOnly(t *testing.T) {
	const envName = "TEST_SECRET_ENV_ONLY"
	os.Setenv(envName, "env-value")
	defer os.Unsetenv(envName)

	value, err := ResolveSecret(envName)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if value != "env-value" {
		t.Errorf("got %q, want %q", value, "env-value")
	}
}

func TestResolveSecret_FileOnly(t *testing.T) {
	const envName = "TEST_SECRET_FILE_ONLY"

	// Create temp file with secret
	tmpDir := t.TempDir()
	secretFile := filepath.Join(tmpDir, "secret.txt")
	if err := os.WriteFile(secretFile, []byte("file-value\n"), 0600); err != nil {
		t.Fatalf("failed to write temp file: %v", err)
	}

	os.Setenv(envName+"_FILE", secretFile)
	defer os.Unsetenv(envName + "_FILE")

	value, err := ResolveSecret(envName)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if value != "file-value" {
		t.Errorf("got %q, want %q", value, "file-value")
	}
}

func TestResolveSecret_FileWinsOverEnv(t *testing.T) {
	const envName = "TEST_SECRET_FILE_WINS"

	// Set direct env var
	os.Setenv(envName, "env-value")
	defer os.Unsetenv(envName)

	// Create temp file with different value
	tmpDir := t.TempDir()
	secretFile := filepath.Join(tmpDir, "secret.txt")
	if err := os.WriteFile(secretFile, []byte("file-value"), 0600); err != nil {
		t.Fatalf("failed to write temp file: %v", err)
	}

	os.Setenv(envName+"_FILE", secretFile)
	defer os.Unsetenv(envName + "_FILE")

	value, err := ResolveSecret(envName)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if value != "file-value" {
		t.Errorf("got %q, want %q (file should win over env)", value, "file-value")
	}
}

func TestResolveSecret_NeitherSet(t *testing.T) {
	const envName = "TEST_SECRET_NEITHER_SET"

	// Ensure both are unset
	os.Unsetenv(envName)
	os.Unsetenv(envName + "_FILE")

	value, err := ResolveSecret(envName)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if value != "" {
		t.Errorf("got %q, want empty string", value)
	}
}

func TestResolveSecret_FileNotFound(t *testing.T) {
	const envName = "TEST_SECRET_FILE_NOT_FOUND"

	os.Setenv(envName+"_FILE", "/nonexistent/path/to/secret")
	defer os.Unsetenv(envName + "_FILE")

	_, err := ResolveSecret(envName)
	if err == nil {
		t.Error("expected error when file does not exist")
	}
}

func TestResolveSecret_TrimsWhitespace(t *testing.T) {
	const envName = "TEST_SECRET_WHITESPACE"

	tmpDir := t.TempDir()
	secretFile := filepath.Join(tmpDir, "secret.txt")

	// File with leading/trailing whitespace and newlines
	if err := os.WriteFile(secretFile, []byte("  secret-value  \n\n"), 0600); err != nil {
		t.Fatalf("failed to write temp file: %v", err)
	}

	os.Setenv(envName+"_FILE", secretFile)
	defer os.Unsetenv(envName + "_FILE")

	value, err := ResolveSecret(envName)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if value != "secret-value" {
		t.Errorf("got %q, want %q (whitespace should be trimmed)", value, "secret-value")
	}
}

func TestResolveSecret_EmptyFile(t *testing.T) {
	const envName = "TEST_SECRET_EMPTY_FILE"

	tmpDir := t.TempDir()
	secretFile := filepath.Join(tmpDir, "secret.txt")
	if err := os.WriteFile(secretFile, []byte(""), 0600); err != nil {
		t.Fatalf("failed to write temp file: %v", err)
	}

	os.Setenv(envName+"_FILE", secretFile)
	defer os.Unsetenv(envName + "_FILE")

	value, err := ResolveSecret(envName)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if value != "" {
		t.Errorf("got %q, want empty string", value)
	}
}
