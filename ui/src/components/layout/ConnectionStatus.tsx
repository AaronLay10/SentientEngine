import { useConnectionStore, type SubsystemHealth } from '@/state';
import { StatusIndicator } from '@/components/shared/StatusIndicator';

/**
 * Map tri-state health to StatusIndicator status
 */
function healthToStatus(health: SubsystemHealth): 'online' | 'offline' | 'unknown' {
  switch (health) {
    case 'healthy':
      return 'online';
    case 'unhealthy':
      return 'offline';
    case 'unknown':
      return 'unknown';
  }
}

/**
 * Get tooltip text for subsystem health
 */
function healthTooltip(name: string, health: SubsystemHealth): string {
  switch (health) {
    case 'healthy':
      return `${name} healthy`;
    case 'unhealthy':
      return `${name} unavailable`;
    case 'unknown':
      return `${name} status unknown`;
  }
}

export function ConnectionStatus() {
  const wsConnected = useConnectionStore((s) => s.wsConnected);
  const wsReconnecting = useConnectionStore((s) => s.wsReconnecting);
  const mqttHealth = useConnectionStore((s) => s.mqttHealth);
  const postgresHealth = useConnectionStore((s) => s.postgresHealth);

  return (
    <div className="flex items-center gap-3 text-xs">
      <StatusIndicator
        label="WS"
        status={wsConnected ? 'online' : wsReconnecting ? 'pending' : 'offline'}
        title={
          wsConnected
            ? 'WebSocket connected'
            : wsReconnecting
              ? 'Reconnecting...'
              : 'WebSocket disconnected'
        }
      />
      <StatusIndicator
        label="MQTT"
        status={healthToStatus(mqttHealth)}
        title={healthTooltip('MQTT broker', mqttHealth)}
      />
      <StatusIndicator
        label="DB"
        status={healthToStatus(postgresHealth)}
        title={healthTooltip('Database', postgresHealth)}
      />
    </div>
  );
}
