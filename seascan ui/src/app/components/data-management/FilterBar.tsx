import { Search, SlidersHorizontal } from 'lucide-react';
import type { ClassificationFilters, ClassificationStatus } from './types';

type FilterBarProps = {
  filters: ClassificationFilters;
  detectionTypes: string[];
  onChange: (next: ClassificationFilters) => void;
  onReset: () => void;
};

const statusOptions: Array<ClassificationStatus | 'All'> = ['All', 'Downloading', 'Processed', 'Failed', 'Archived'];
const sizeOptions = ['All', 'Under 1 sq km', '1 to 5 sq km', 'Over 5 sq km'];
const sortOptions = [
  { value: 'date_desc', label: 'Newest first' },
  { value: 'date_asc', label: 'Oldest first' },
  { value: 'confidence_desc', label: 'Highest confidence' },
  { value: 'size_desc', label: 'Largest area' },
  { value: 'updated_desc', label: 'Recently updated' },
];

export default function FilterBar({ filters, detectionTypes, onChange, onReset }: FilterBarProps) {
  const update = (patch: Partial<ClassificationFilters>) => onChange({ ...filters, ...patch });

  return (
    <div className="sticky top-4 z-20 rounded-2xl border border-[#00C9A7]/20 bg-[#010812]/95 p-4 backdrop-blur-xl">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="h-4 w-4 text-[#00C9A7]" />
          <h3 className="text-sm font-semibold text-white">Filters & Search</h3>
        </div>
        <button
          onClick={onReset}
          className="text-xs font-medium text-[#00C9A7] transition-colors hover:text-[#3DDC84]"
        >
          Reset
        </button>
      </div>

      <div className="grid gap-3 xl:grid-cols-6 lg:grid-cols-3 md:grid-cols-2">
        <label className="xl:col-span-2 flex items-center gap-2 rounded-xl border border-[#00C9A7]/20 bg-[#020D1A] px-3 py-2">
          <Search className="h-4 w-4 text-[#00C9A7]" />
          <input
            value={filters.search}
            onChange={(event) => update({ search: event.target.value })}
            placeholder="Search by location or study area"
            className="w-full bg-transparent text-sm text-white outline-none placeholder:text-gray-500"
          />
        </label>

        <input
          type="date"
          value={filters.dateFrom}
          onChange={(event) => update({ dateFrom: event.target.value })}
          className="rounded-xl border border-[#00C9A7]/20 bg-[#020D1A] px-3 py-2 text-sm text-white outline-none"
        />

        <input
          type="date"
          value={filters.dateTo}
          onChange={(event) => update({ dateTo: event.target.value })}
          className="rounded-xl border border-[#00C9A7]/20 bg-[#020D1A] px-3 py-2 text-sm text-white outline-none"
        />

        <select
          value={filters.status}
          onChange={(event) => update({ status: event.target.value })}
          className="rounded-xl border border-[#00C9A7]/20 bg-[#020D1A] px-3 py-2 text-sm text-white outline-none"
        >
          {statusOptions.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>

        <select
          value={filters.detectionType}
          onChange={(event) => update({ detectionType: event.target.value })}
          className="rounded-xl border border-[#00C9A7]/20 bg-[#020D1A] px-3 py-2 text-sm text-white outline-none"
        >
          <option value="All">All types</option>
          {detectionTypes.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>

        <select
          value={filters.size}
          onChange={(event) => update({ size: event.target.value })}
          className="rounded-xl border border-[#00C9A7]/20 bg-[#020D1A] px-3 py-2 text-sm text-white outline-none"
        >
          {sizeOptions.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>

        <select
          value={filters.sortBy}
          onChange={(event) => update({ sortBy: event.target.value })}
          className="rounded-xl border border-[#00C9A7]/20 bg-[#020D1A] px-3 py-2 text-sm text-white outline-none xl:col-span-2"
        >
          {sortOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
