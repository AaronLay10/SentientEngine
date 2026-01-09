import {
  RoomStatusBanner,
  ControllerSummary,
  ActiveDevices,
  EventStream,
} from '@/components/monitor';

/**
 * Live Room Monitor page
 *
 * Provides a single screen for operators to observe:
 * - Current room/session state
 * - Controller health summary
 * - Active devices
 * - Event stream
 *
 * All data is from backend - UI does not infer or compute state.
 */
export function MonitorPage() {
  return (
    <div className="flex h-full flex-col gap-4">
      {/* Room status banner */}
      <RoomStatusBanner />

      {/* Three-column layout */}
      <div className="grid flex-1 grid-cols-1 gap-4 lg:grid-cols-3 min-h-0">
        {/* Left: Controller summary */}
        <div className="min-h-64 lg:min-h-0">
          <ControllerSummary />
        </div>

        {/* Center: Active devices */}
        <div className="min-h-64 lg:min-h-0">
          <ActiveDevices />
        </div>

        {/* Right: Event stream */}
        <div className="min-h-64 lg:min-h-0">
          <EventStream />
        </div>
      </div>
    </div>
  );
}
