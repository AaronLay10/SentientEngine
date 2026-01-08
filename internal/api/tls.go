package api

import (
	"crypto/tls"
	"log"
	"os"
)

// TLSConfig holds TLS certificate paths loaded from environment variables.
type TLSConfig struct {
	CertFile string
	KeyFile  string
}

// tlsConfig is the package-level TLS configuration, set by InitTLS.
var tlsConfig *TLSConfig

// InitTLS loads TLS configuration from environment variables.
// Call this before starting the server.
func InitTLS() {
	certFile := os.Getenv("SENTIENT_TLS_CERT")
	keyFile := os.Getenv("SENTIENT_TLS_KEY")

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
