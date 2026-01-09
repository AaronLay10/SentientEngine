import { CheckCircle, AlertTriangle, AlertOctagon } from 'lucide-react';
import type { HealthLevel } from '@/types';
import { HEALTH_STYLES } from '@/types';

interface HealthBadgeProps {
  health: HealthLevel;
  alertCount?: number;
}

const HEALTH_ICONS = {
  healthy: CheckCircle,
  warning: AlertTriangle,
  critical: AlertOctagon,
};

export function HealthBadge({ health, alertCount }: HealthBadgeProps) {
  const style = HEALTH_STYLES[health];
  const Icon = HEALTH_ICONS[health];

  return (
    <div
      className={`flex items-center gap-1.5 rounded px-2 py-0.5 text-xs ${style.bg} ${style.pulse ? 'animate-pulse-alert' : ''}`}
    >
      <Icon className="h-3.5 w-3.5" />
      <span className="capitalize">{health}</span>
      {alertCount !== undefined && alertCount > 0 && (
        <span className="ml-1 rounded-full bg-zinc-900/50 px-1.5">
          {alertCount}
        </span>
      )}
    </div>
  );
}
