# Room Template

This directory is the canonical template for all rooms.

To create a new room:
1. Copy this folder to `rooms/<room-id>/`
2. Update `room.yaml`:
   - room.id
   - room.revision
   - name and description
3. Update `devices.yaml` to match expected logical devices
4. Add scene graphs under `graphs/`
5. Add media assets under `media/`
6. Optional helper scripts go in `scripts/`

Rules:
- Do NOT add engine code here
- Scenes reference logical device IDs only
- Physical wiring is reported by controllers at runtime
