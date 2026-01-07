# Sentient Engine V7 - Single Container Per Room
# Uses s6-overlay to run: orchestrator, mosquitto, postgres

# =============================================================================
# Stage 1: Build Go binaries
# =============================================================================
FROM golang:1.24-alpine AS builder

RUN apk add --no-cache git

WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -o /bin/orchestrator ./cmd/orchestrator

# =============================================================================
# Stage 2: Runtime image with s6-overlay
# =============================================================================
FROM alpine:3.19

# Install s6-overlay
ARG S6_OVERLAY_VERSION=3.1.6.2
ADD https://github.com/just-containers/s6-overlay/releases/download/v${S6_OVERLAY_VERSION}/s6-overlay-noarch.tar.xz /tmp
ADD https://github.com/just-containers/s6-overlay/releases/download/v${S6_OVERLAY_VERSION}/s6-overlay-x86_64.tar.xz /tmp
RUN tar -C / -Jxpf /tmp/s6-overlay-noarch.tar.xz && \
    tar -C / -Jxpf /tmp/s6-overlay-x86_64.tar.xz && \
    rm /tmp/s6-overlay-*.tar.xz

# Install runtime dependencies
RUN apk add --no-cache \
    mosquitto \
    postgresql16 \
    postgresql16-contrib \
    su-exec \
    bash \
    netcat-openbsd

# Create directories
RUN mkdir -p /data/db /data/mqtt /config /run/postgresql /etc/mosquitto && \
    chown -R postgres:postgres /data/db /run/postgresql && \
    chown -R mosquitto:mosquitto /data/mqtt /etc/mosquitto

# Copy orchestrator binary
COPY --from=builder /bin/orchestrator /usr/local/bin/orchestrator

# Copy s6 service definitions and mosquitto config
COPY ops/docker/rootfs/ /

# Make s6 run scripts executable
RUN chmod +x /etc/s6-overlay/s6-rc.d/postgres/run \
             /etc/s6-overlay/s6-rc.d/mosquitto/run \
             /etc/s6-overlay/s6-rc.d/sentient/run

# Environment
ENV SENTIENT_CONFIG_DIR=/config
ENV MQTT_URL=tcp://localhost:1883
ENV PGDATA=/data/db
ENV POSTGRES_USER=sentient
ENV POSTGRES_DB=sentient

# Expose ports
EXPOSE 8080 1883 5432

# s6-overlay entrypoint
ENTRYPOINT ["/init"]
