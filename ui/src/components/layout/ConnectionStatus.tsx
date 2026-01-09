import { useConnectionStore } from '@/state';
import { StatusIndicator } from '@/components/shared/StatusIndicator';

export function ConnectionStatus() {
  const wsConnected = useConnectionStore((s) => s.wsConnected);
  const wsReconnecting = useConnectionStore((s) => s.wsReconnecting);
  const mqttHealthy = useConnectionStore((s) => s.mqttHealthy);
  const postgresHealthy = useConnectionStore((s) => s.postgresHealthy);

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
        status={mqttHealthy ? 'online' : 'offline'}
        title={mqttHealthy ? 'MQTT broker healthy' : 'MQTT broker unavailable'}
      />
      <StatusIndicator
        label="DB"
        status={postgresHealthy ? 'online' : 'offline'}
        title={postgresHealthy ? 'Database healthy' : 'Database unavailable'}
      />
    </div>
  );
}
