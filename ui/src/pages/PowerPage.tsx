import { FilterBanner } from '@/components/shared/FilterBanner';
import { PowerGrid } from '@/components/power/PowerGrid';

export function PowerPage() {
  return (
    <div className="h-full">
      <FilterBanner />
      <PowerGrid />
    </div>
  );
}
