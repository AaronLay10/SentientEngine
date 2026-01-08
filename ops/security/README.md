# Sentient Engine Security Guide

This document covers security best practices for operating Sentient Engine in production,
including certificate rotation, credential management, and token hygiene.

## Overview

Sentient Engine supports:
- **TLS encryption** for API and WebSocket connections
- **Basic authentication** with role-based access (admin/operator)
- **Secret file pattern** (`*_FILE` variables) for secure credential injection

## TLS Configuration

### Enabling TLS

Set these environment variables:

| Variable | Description |
|----------|-------------|
| `SENTIENT_TLS_CERT` | Path to TLS certificate (PEM format) |
| `SENTIENT_TLS_KEY` | Path to TLS private key (PEM format) |

Or use the `*_FILE` pattern for secret injection:

| Variable | Description |
|----------|-------------|
| `SENTIENT_TLS_CERT_FILE` | Path to file containing cert path |
| `SENTIENT_TLS_KEY_FILE` | Path to file containing key path |

### TLS Requirements

- Minimum TLS version: **TLS 1.2**
- Certificate format: PEM (X.509)
- Key format: PEM (RSA or ECDSA)
- Certificate chain: Include intermediate certificates in cert file

### Certificate Rotation

#### Zero-Downtime Rotation Procedure

1. **Generate new certificate** before current one expires (recommend 30+ days):
   ```bash
   # Using certbot (Let's Encrypt)
   certbot certonly --standalone -d sentient.example.com

   # Or generate self-signed for internal use
   openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
     -keyout new-server.key -out new-server.crt \
     -subj "/CN=sentient.example.com"
   ```

2. **Validate the new certificate**:
   ```bash
   # Check certificate dates
   openssl x509 -in new-server.crt -noout -dates

   # Verify key matches certificate
   openssl x509 -in new-server.crt -noout -modulus | md5sum
   openssl rsa -in new-server.key -noout -modulus | md5sum
   # Both should match

   # Check certificate chain (if using CA-signed)
   openssl verify -CAfile ca-bundle.crt new-server.crt
   ```

3. **Replace certificate files**:
   ```bash
   # Backup old certificates
   cp /etc/sentient/certs/server.crt /etc/sentient/certs/server.crt.bak
   cp /etc/sentient/certs/server.key /etc/sentient/certs/server.key.bak

   # Install new certificates
   cp new-server.crt /etc/sentient/certs/server.crt
   cp new-server.key /etc/sentient/certs/server.key
   chmod 600 /etc/sentient/certs/server.key
   ```

4. **Restart the room container**:
   ```bash
   docker restart sentient-pharaohs
   # Or for systemd
   systemctl restart sentient-room@pharaohs
   ```

5. **Verify TLS is working**:
   ```bash
   # Check certificate
   openssl s_client -connect localhost:8443 -servername sentient.example.com </dev/null 2>/dev/null | \
     openssl x509 -noout -dates

   # Test API endpoint
   curl -k https://localhost:8443/health
   ```

#### Automated Rotation with Certbot

Create a renewal hook at `/etc/letsencrypt/renewal-hooks/deploy/sentient-reload.sh`:

```bash
#!/bin/bash
# Reload Sentient containers after certificate renewal

ROOMS="pharaohs clockwork"

for room in $ROOMS; do
    if docker ps --format '{{.Names}}' | grep -q "sentient-${room}"; then
        docker restart "sentient-${room}"
        echo "Restarted sentient-${room}"
    fi
done
```

Make it executable:
```bash
chmod +x /etc/letsencrypt/renewal-hooks/deploy/sentient-reload.sh
```

Certbot will automatically run this hook after successful renewal.

#### Certificate Expiry Monitoring

Add a Prometheus alert for certificate expiry:

```yaml
- alert: SentientCertExpiringSoon
  expr: (probe_ssl_earliest_cert_expiry - time()) / 86400 < 30
  for: 1h
  labels:
    severity: warning
  annotations:
    summary: "TLS certificate expires in {{ $value | humanizeDuration }}"
```

## Authentication

### Credential Configuration

| Variable | Description | Role |
|----------|-------------|------|
| `SENTIENT_ADMIN_USER` | Admin username | Full access |
| `SENTIENT_ADMIN_PASS` | Admin password | Full access |
| `SENTIENT_OPERATOR_USER` | Operator username | Limited access |
| `SENTIENT_OPERATOR_PASS` | Operator password | Limited access |

Use `*_FILE` variants for secure injection:
```bash
SENTIENT_ADMIN_USER_FILE=/run/secrets/admin_user
SENTIENT_ADMIN_PASS_FILE=/run/secrets/admin_pass
```

### Role Permissions

| Endpoint | Admin | Operator |
|----------|-------|----------|
| `/health`, `/ready`, `/metrics` | Yes (public) | Yes (public) |
| `/ui`, `/ws/events` | Yes | Yes |
| `/game/*`, `/operator/*` | Yes | Yes |
| `/admin/*` (if present) | Yes | No |

### Credential Rotation

#### Rotation Procedure

1. **Generate new credentials**:
   ```bash
   # Generate secure password
   NEW_PASS=$(openssl rand -base64 32)
   echo "New password: $NEW_PASS"
   ```

2. **Update credential files** (if using `*_FILE` pattern):
   ```bash
   # Update secret files
   echo -n "newadmin" > /etc/sentient/secrets/admin_user
   echo -n "$NEW_PASS" > /etc/sentient/secrets/admin_pass
   chmod 600 /etc/sentient/secrets/*
   ```

3. **Restart the container**:
   ```bash
   docker restart sentient-pharaohs
   ```

4. **Verify authentication**:
   ```bash
   # Test with new credentials
   curl -u newadmin:$NEW_PASS http://localhost:8080/ready
   ```

5. **Update client configurations** with new credentials.

#### Docker Secrets (Recommended)

For Docker Swarm or Compose with secrets:

```yaml
version: "3.8"
services:
  sentient:
    image: ghcr.io/aaronlay10/sentient-engine:latest
    secrets:
      - admin_user
      - admin_pass
      - operator_user
      - operator_pass
    environment:
      - SENTIENT_ADMIN_USER_FILE=/run/secrets/admin_user
      - SENTIENT_ADMIN_PASS_FILE=/run/secrets/admin_pass
      - SENTIENT_OPERATOR_USER_FILE=/run/secrets/operator_user
      - SENTIENT_OPERATOR_PASS_FILE=/run/secrets/operator_pass

secrets:
  admin_user:
    file: ./secrets/admin_user
  admin_pass:
    file: ./secrets/admin_pass
  operator_user:
    file: ./secrets/operator_user
  operator_pass:
    file: ./secrets/operator_pass
```

#### Credential Rotation Schedule

| Credential Type | Recommended Rotation |
|-----------------|---------------------|
| Admin password | Every 90 days |
| Operator password | Every 90 days |
| API tokens (if added) | Every 30 days |
| TLS certificates | Before expiry (auto with certbot) |

## Token Hygiene

### Best Practices

1. **Never commit credentials to git**:
   ```bash
   # Add to .gitignore
   *.env
   secrets/
   *.key
   *.pem
   ```

2. **Use environment-specific credential files**:
   ```
   /etc/sentient/pharaohs.env     # Production
   /etc/sentient/dev.env          # Development (different creds)
   ```

3. **Restrict file permissions**:
   ```bash
   # Credential files should be readable only by owner
   chmod 600 /etc/sentient/secrets/*
   chmod 600 /etc/sentient/*.env
   chown root:root /etc/sentient/secrets/*
   ```

4. **Use read-only mounts for secrets**:
   ```bash
   docker run -v /etc/sentient/certs:/certs:ro ...
   ```

5. **Audit credential access**:
   ```bash
   # Check who can read secret files
   ls -la /etc/sentient/secrets/
   getfacl /etc/sentient/secrets/*
   ```

### Avoiding Common Mistakes

| Mistake | Correct Approach |
|---------|-----------------|
| Credentials in docker-compose.yml | Use `env_file` or secrets |
| Credentials in command line | Use environment files |
| Shared credentials across environments | Unique credentials per environment |
| Long-lived credentials | Regular rotation schedule |
| Credentials in logs | Mask sensitive values in logging |

### Logging Security

The Sentient Engine does NOT log:
- Passwords or credentials
- Full request/response bodies
- TLS private keys

It DOES log:
- Authentication failures (without passwords)
- TLS configuration status
- Connection events

## Network Security

### Recommended Firewall Rules

```bash
# Allow API/WebSocket (HTTPS)
ufw allow 8443/tcp comment "Sentient HTTPS"

# Allow HTTP redirect (optional, if using TLS)
ufw allow 8080/tcp comment "Sentient HTTP redirect"

# Block direct database access
ufw deny 5432/tcp comment "Block external Postgres"

# Block direct MQTT access
ufw deny 1883/tcp comment "Block external MQTT"
```

### Docker Network Isolation

```yaml
networks:
  sentient-internal:
    internal: true  # No external access
  sentient-public:
    # External access for API only
```

### Metrics Endpoint Security

The `/metrics` endpoint is **unauthenticated** by design (for Prometheus scraping).
Secure it via:

1. **Network policy** - Only allow Prometheus IP
2. **Reverse proxy** - Add auth at proxy level
3. **Firewall** - Restrict to monitoring network

## Incident Response

### Suspected Credential Compromise

1. **Immediately rotate** affected credentials
2. **Review access logs** for unauthorized access:
   ```bash
   docker logs sentient-pharaohs 2>&1 | grep -i "unauthorized\|forbidden\|401\|403"
   ```
3. **Check for unauthorized changes** via event history:
   ```bash
   curl -u admin:pass http://localhost:8080/events | jq '.[-20:]'
   ```
4. **Notify stakeholders** per your incident response plan

### Suspected Certificate Compromise

1. **Revoke the certificate** with your CA
2. **Generate and deploy new certificate** immediately
3. **Update certificate revocation lists** if applicable
4. **Restart all affected services**

## Security Checklist

### Initial Deployment

- [ ] TLS certificates installed and valid
- [ ] Admin and operator credentials configured
- [ ] Credential files have restricted permissions (600)
- [ ] Secret files not committed to git
- [ ] Firewall rules restrict database/MQTT access
- [ ] `/metrics` endpoint access restricted

### Ongoing Operations

- [ ] Certificate expiry monitored (alert at 30 days)
- [ ] Credentials rotated per schedule
- [ ] Access logs reviewed regularly
- [ ] Backup credentials stored securely
- [ ] Incident response plan documented

## References

- [TLS Best Practices](https://wiki.mozilla.org/Security/Server_Side_TLS)
- [Docker Secrets](https://docs.docker.com/engine/swarm/secrets/)
- [Let's Encrypt](https://letsencrypt.org/docs/)
