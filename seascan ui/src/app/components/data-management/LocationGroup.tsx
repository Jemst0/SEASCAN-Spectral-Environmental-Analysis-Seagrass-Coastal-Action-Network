import { ChevronDown, ChevronRight, MapPin } from 'lucide-react';
import ClassificationCard from './ClassificationCard';
import type { ClassificationRecord, LocationGroup as LocationGroupType } from './types';

type LocationGroupProps = {
  group: LocationGroupType;
  expanded: boolean;
  selectedIds: Set<number>;
  expandedIds: Set<number>;
  canManage: boolean;
  onToggleGroup: (location: string) => void;
  onToggleSelect: (id: number) => void;
  onToggleExpand: (id: number) => void;
  onDownload: (classification: ClassificationRecord) => void;
  onArchive: (classification: ClassificationRecord) => void;
  onTrendAnalysis: (classification: ClassificationRecord) => void;
  onDelete: (classification: ClassificationRecord) => void;
  onSaveNotes: (classification: ClassificationRecord, notes: string) => void;
};

function formatDate(value: string | null) {
  if (!value) return 'N/A';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString();
}

export default function LocationGroup({
  group,
  expanded,
  selectedIds,
  expandedIds,
  canManage,
  onToggleGroup,
  onToggleSelect,
  onToggleExpand,
  onDownload,
  onArchive,
  onTrendAnalysis,
  onDelete,
  onSaveNotes,
}: LocationGroupProps) {
  return (
    <section className="overflow-hidden rounded-3xl border border-[#00C9A7]/20 bg-[#010812] shadow-[0_0_0_1px_rgba(0,201,167,0.03)]">
      <button
        onClick={() => onToggleGroup(group.location)}
        className="flex w-full items-start justify-between gap-4 px-5 py-4 text-left transition-colors hover:bg-[#020D1A]"
      >
        <div className="flex min-w-0 items-start gap-3">
          <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#00C9A7]/10 text-[#00C9A7]">
            <MapPin className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              {expanded ? <ChevronDown className="h-4 w-4 text-[#00C9A7]" /> : <ChevronRight className="h-4 w-4 text-[#00C9A7]" />}
              <h3 className="truncate text-lg font-semibold text-white">{group.location}</h3>
            </div>
            <p className="mt-1 text-sm text-gray-400">
              {group.totalClassifications.toLocaleString()} classifications • Latest {formatDate(group.latestDate)}
            </p>
          </div>
        </div>
        <div className="rounded-full border border-[#00C9A7]/20 bg-[#00C9A7]/10 px-3 py-1 text-xs text-[#00C9A7]">
          {group.records.filter((record) => selectedIds.has(record.id)).length} selected
        </div>
      </button>

      <div className={`grid transition-all duration-300 ease-in-out ${expanded ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
        <div className="overflow-hidden">
          <div className="space-y-4 border-t border-[#00C9A7]/10 p-4 md:p-5">
            {group.records.map((classification) => (
              <ClassificationCard
                key={classification.id}
                classification={classification}
                selected={selectedIds.has(classification.id)}
                expanded={expandedIds.has(classification.id)}
                canManage={canManage}
                onToggleSelect={onToggleSelect}
                onToggleExpand={onToggleExpand}
                onDownload={onDownload}
                onArchive={onArchive}
                onTrendAnalysis={onTrendAnalysis}
                onDelete={onDelete}
                onSaveNotes={onSaveNotes}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
