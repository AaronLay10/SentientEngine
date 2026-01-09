type Status = 'online' | 'offline' | 'pending' | 'error';

interface StatusIndicatorProps {
  label: string;
  status: Status;
  title?: string;
}

const STATUS_COLORS: Record<Status, string> = {
  online: 'bg-online',
  offline: 'bg-offline',
  pending: 'bg-pending animate-pulse',
  error: 'bg-error',
};

export function StatusIndicator({ label, status, title }: StatusIndicatorProps) {
  return (
    <div className="flex items-center gap-1.5" title={title}>
      <div className={`h-2 w-2 rounded-full ${STATUS_COLORS[status]}`} />
      <span className="text-zinc-400">{label}</span>
    </div>
  );
}
