import { FilterBanner } from '@/components/shared/FilterBanner';
import { ControllerGrid } from '@/components/controllers/ControllerGrid';
import { ControllerOverlay } from '@/components/controllers/ControllerOverlay';

export function ControllersPage() {
  return (
    <div className="h-full">
      <FilterBanner />
      <ControllerGrid />
      <ControllerOverlay />
    </div>
  );
}
