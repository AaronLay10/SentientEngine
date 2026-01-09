import { NavLink } from 'react-router-dom';
import { Cpu, Power, Activity, GitBranch, Puzzle } from 'lucide-react';
import { useAuthStore } from '@/state';
import { Tooltip } from '@/components/shared/Tooltip';

interface NavItemProps {
  to: string;
  icon: React.ReactNode;
  label: string;
  disabled?: boolean;
  disabledReason?: string;
}

function NavItem({ to, icon, label, disabled, disabledReason }: NavItemProps) {
  if (disabled) {
    return (
      <Tooltip content={disabledReason ?? 'Access restricted'}>
        <span className="flex cursor-not-allowed items-center gap-2 rounded px-3 py-1.5 text-sm text-zinc-600">
          {icon}
          {label}
        </span>
      </Tooltip>
    );
  }

  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `flex items-center gap-2 rounded px-3 py-1.5 text-sm transition-colors ${
          isActive
            ? 'bg-zinc-800 text-zinc-100'
            : 'text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200'
        }`
      }
    >
      {icon}
      {label}
    </NavLink>
  );
}

export function Navigation() {
  const permissions = useAuthStore((s) => s.getPermissions());

  // Default to full access if not authenticated (dev mode)
  const canViewMonitor = permissions?.canViewMonitor ?? true;
  const canViewSceneEditor = permissions?.canViewSceneEditor ?? true;
  const canViewPuzzleEditor = permissions?.canViewPuzzleEditor ?? true;
  const canViewControllers = permissions?.canViewControllers ?? true;
  const canViewPower = permissions?.canViewPower ?? true;

  return (
    <nav className="flex items-center gap-1">
      <NavItem
        to="/monitor"
        icon={<Activity className="h-4 w-4" />}
        label="Monitor"
        disabled={!canViewMonitor}
        disabledReason="You do not have permission to view Monitor"
      />
      <NavItem
        to="/scene-editor"
        icon={<GitBranch className="h-4 w-4" />}
        label="Scene Editor"
        disabled={!canViewSceneEditor}
        disabledReason="You do not have permission to view Scene Editor"
      />
      <NavItem
        to="/puzzle-editor"
        icon={<Puzzle className="h-4 w-4" />}
        label="Puzzle Editor"
        disabled={!canViewPuzzleEditor}
        disabledReason="You do not have permission to view Puzzle Editor"
      />
      <NavItem
        to="/controllers"
        icon={<Cpu className="h-4 w-4" />}
        label="Controllers"
        disabled={!canViewControllers}
        disabledReason="You do not have permission to view Controllers"
      />
      <NavItem
        to="/power"
        icon={<Power className="h-4 w-4" />}
        label="Power"
        disabled={!canViewPower}
        disabledReason="You do not have permission to view Power"
      />
    </nav>
  );
}
