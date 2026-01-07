#!/bin/bash

echo "Stopping two-room containers..."
docker stop sentient-pharaohs sentient-clockwork 2>/dev/null || true
docker rm sentient-pharaohs sentient-clockwork 2>/dev/null || true
echo "Containers stopped and removed."
echo ""
echo "To also remove data volumes:"
echo "  docker volume rm sentient_pharaohs_data sentient_clockwork_data"
