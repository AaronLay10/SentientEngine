// Package version provides build and version information for Sentient Engine.
package version

// Version is the current release version of Sentient Engine.
// This can be overridden at build time using:
//
//	go build -ldflags "-X github.com/AaronLay10/SentientEngine/internal/version.Version=x.y.z"
var Version = "1.0.0"
