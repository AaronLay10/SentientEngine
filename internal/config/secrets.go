package config

import (
	"fmt"
	"os"
	"strings"
)

// ResolveSecret reads a secret value using the *_FILE convention.
// If envName+"_FILE" is set, reads the secret from that file path.
// Otherwise falls back to the value of envName.
// Returns empty string if neither is set.
// Returns an error if the file cannot be read.
func ResolveSecret(envName string) (string, error) {
	// Check for *_FILE variant first (takes precedence)
	fileEnv := envName + "_FILE"
	if filePath := os.Getenv(fileEnv); filePath != "" {
		content, err := os.ReadFile(filePath)
		if err != nil {
			return "", fmt.Errorf("failed to read secret from %s=%s: %w", fileEnv, filePath, err)
		}
		return strings.TrimSpace(string(content)), nil
	}

	// Fall back to direct env var
	return os.Getenv(envName), nil
}

// MustResolveSecret is like ResolveSecret but logs and exits on error.
// Use this for required secrets during startup.
func MustResolveSecret(envName string) string {
	value, err := ResolveSecret(envName)
	if err != nil {
		// Log error without exposing secret content
		fmt.Fprintf(os.Stderr, "error: %v\n", err)
		os.Exit(1)
	}
	return value
}
