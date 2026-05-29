import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, Loader2, RefreshCcw } from 'lucide-react';
import BulkActionToolbar from './BulkActionToolbar';
import FilterBar from './FilterBar';
import LocationGroup from './LocationGroup';
import SummaryCards from './SummaryCards';
import type {
  ClassificationFilters,
  ClassificationRecord,
  LocationGroup as LocationGroupType,
  SummaryMetrics,
} from './types';
import { deleteClassification, fetchAllClassifications, updateClassification } from './api';

type MessageState = {
  type: 'success' | 'error' | 'info';
  text: string;
} | null;

type DataManagementPageProps = {
  onTrendAnalysis?: (records: ClassificationRecord[]) => void;
  canManage?: boolean;
};

const defaultFilters: ClassificationFilters = {
  search: '',
  dateFrom: '',
  dateTo: '',
  status: 'All',
  detectionType: 'All',
  size: 'All',
  sortBy: 'date_desc',
};

function getEffectiveDate(record: ClassificationRecord): Date | null {
  const candidate = record.classification_date || record.classification_timestamp || record.created_at;
  if (!candidate) return null;
  const parsed = new Date(candidate);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function normalizeLocation(record: ClassificationRecord): string {
  const rawLocation = record.study_area_location?.trim();
  if (rawLocation && rawLocation !== 'Not specified') {
    return rawLocation;
  }
  return record.study_area_name || 'Unknown Location';
}

function toCsvSafe(value: string) {
  return `"${value.replace(/"/g, '""')}"`;
}

function downloadJsonFile(filename: string, payload: unknown) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function downloadCsvFile(filename: string, records: ClassificationRecord[]) {
  const headers = [
    'id',
    'study_area_name',
    'study_area_location',
    'status',
    'detection_type',
    'classification_date',
    'classification_timestamp',
    'last_updated',
    'affected_area_size',
    'affected_area_unit',
    'confidence_score',
    'source',
    'water_pixels',
    'seagrass_pixels',
    'sand_pixels',
    'cloud_pixels',
    'total_pixels',
  ];

  const rows = records.map((record) => [
    record.id,
    record.study_area_name,
    record.study_area_location || '',
    record.status || '',
    record.detection_type || '',
    record.classification_date || '',
    record.classification_timestamp || '',
    record.last_updated || '',
    record.affected_area_size ?? '',
    record.affected_area_unit || '',
    record.confidence_score ?? '',
    record.source || '',
    record.water_pixels ?? '',
    record.seagrass_pixels ?? '',
    record.sand_pixels ?? '',
    record.cloud_pixels ?? '',
    record.total_pixels ?? '',
  ]);

  const csv = [headers.map(toCsvSafe).join(','), ...rows.map((row) => row.map((value) => toCsvSafe(String(value))).join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function matchesDateRange(record: ClassificationRecord, dateFrom: string, dateTo: string) {
  const effectiveDate = getEffectiveDate(record);
  if (!effectiveDate) return false;

  if (dateFrom) {
    const from = new Date(dateFrom);
    from.setHours(0, 0, 0, 0);
    if (effectiveDate < from) return false;
  }

  if (dateTo) {
    const to = new Date(dateTo);
    to.setHours(23, 59, 59, 999);
    if (effectiveDate > to) return false;
  }

  return true;
}

function buildGroups(records: ClassificationRecord[]): LocationGroupType[] {
  const grouped = records.reduce((accumulator, record) => {
    const key = normalizeLocation(record);
    if (!accumulator[key]) accumulator[key] = [];
    accumulator[key].push(record);
    return accumulator;
  }, {} as Record<string, ClassificationRecord[]>);

  return Object.entries(grouped)
    .map(([location, items]) => {
      const sortedRecords = [...items].sort((left, right) => {
        const leftDate = getEffectiveDate(left)?.getTime() ?? 0;
        const rightDate = getEffectiveDate(right)?.getTime() ?? 0;
        if (leftDate !== rightDate) return rightDate - leftDate;
        return right.id - left.id;
      });

      const latestDate = sortedRecords[0] ? (getEffectiveDate(sortedRecords[0])?.toISOString() || sortedRecords[0].classification_timestamp || sortedRecords[0].created_at || null) : null;

      return {
        location,
        records: sortedRecords,
        totalClassifications: sortedRecords.length,
        latestDate,
      };
    })
    .sort((left, right) => {
      const leftTime = left.latestDate ? new Date(left.latestDate).getTime() : 0;
      const rightTime = right.latestDate ? new Date(right.latestDate).getTime() : 0;
      return rightTime - leftTime;
    });
}

function filterRecords(records: ClassificationRecord[], filters: ClassificationFilters) {
  return records.filter((record) => {
    const searchText = `${record.study_area_name} ${record.study_area_location || ''} ${record.detection_type || ''} ${record.source || ''}`.toLowerCase();
    const matchesSearch = !filters.search || searchText.includes(filters.search.toLowerCase());

    const matchesStatus = filters.status === 'All' || (record.status || 'Processed') === filters.status;
    const matchesType = filters.detectionType === 'All' || (record.detection_type || '').toLowerCase() === filters.detectionType.toLowerCase();
    const matchesSize = (() => {
      if (filters.size === 'All') return true;
      const size = record.affected_area_size ?? null;
      if (size == null) return false;
      if (filters.size === 'Under 1 sq km') return size < 1;
      if (filters.size === '1 to 5 sq km') return size >= 1 && size <= 5;
      if (filters.size === 'Over 5 sq km') return size > 5;
      return true;
    })();

    const matchesDate = matchesDateRange(record, filters.dateFrom, filters.dateTo);
    return matchesSearch && matchesStatus && matchesType && matchesSize && matchesDate;
  });
}

function sortRecords(records: ClassificationRecord[], sortBy: string) {
  const sorted = [...records];
  sorted.sort((left, right) => {
    const leftDate = getEffectiveDate(left)?.getTime() ?? 0;
    const rightDate = getEffectiveDate(right)?.getTime() ?? 0;

    if (sortBy === 'date_asc') return leftDate - rightDate;
    if (sortBy === 'confidence_desc') return (right.confidence_score ?? -1) - (left.confidence_score ?? -1);
    if (sortBy === 'size_desc') return (right.affected_area_size ?? -1) - (left.affected_area_size ?? -1);
    if (sortBy === 'updated_desc') {
      const leftUpdated = new Date(left.last_updated || left.created_at || left.classification_timestamp || 0).getTime();
      const rightUpdated = new Date(right.last_updated || right.created_at || right.classification_timestamp || 0).getTime();
      return rightUpdated - leftUpdated;
    }
    return rightDate - leftDate;
  });

  return sorted;
}

function computeMetrics(records: ClassificationRecord[]): SummaryMetrics {
  const totalClassifications = records.length;
  const processingJobs = records.filter((record) => ['Downloading', 'Processing'].includes(record.status || '')).length;
  const queuedJobs = records.filter((record) => (record.status || '') === 'Queued').length;
  const archivedResults = records.filter((record) => (record.status || '') === 'Archived').length;
  const totalLocationsMonitored = new Set(records.map((record) => normalizeLocation(record))).size;

  return {
    totalClassifications,
    processingJobs,
    queuedJobs,
    archivedResults,
    totalLocationsMonitored,
  };
}

export default function DataManagementPage({ onTrendAnalysis, canManage = false }: DataManagementPageProps) {
  const [records, setRecords] = useState<ClassificationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<ClassificationFilters>(defaultFilters);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [expandedLocations, setExpandedLocations] = useState<Set<string>>(new Set());
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());
  const [message, setMessage] = useState<MessageState>(null);

  const loadData = async () => {
    try {
      setError(null);
      const data = await fetchAllClassifications();
      setRecords(data);
      setExpandedLocations(new Set(data.map((record) => normalizeLocation(record))));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load classifications');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filteredRecords = useMemo(() => {
    const filtered = filterRecords(records, filters);
    return sortRecords(filtered, filters.sortBy);
  }, [records, filters]);

  const groupedLocations = useMemo(() => buildGroups(filteredRecords), [filteredRecords]);
  const metrics = useMemo(() => computeMetrics(filteredRecords), [filteredRecords]);
  const detectionTypes = useMemo(() => {
    return Array.from(
      new Set(records.map((record) => record.detection_type?.trim()).filter((value): value is string => Boolean(value))),
    ).sort();
  }, [records]);

  const selectedRecords = useMemo(() => filteredRecords.filter((record) => selectedIds.has(record.id)), [filteredRecords, selectedIds]);

  const toggleSelected = (id: number) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleExpanded = (id: number) => {
    setExpandedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleLocation = (location: string) => {
    setExpandedLocations((current) => {
      const next = new Set(current);
      if (next.has(location)) next.delete(location);
      else next.add(location);
      return next;
    });
  };

  const refresh = async () => {
    setRefreshing(true);
    await loadData();
  };

  const updateSelectedStatus = async (status: string) => {
    if (!canManage) {
      setMessage({ type: 'error', text: 'Admin access required to update status.' });
      return;
    }
    if (selectedRecords.length === 0) return;
    await Promise.all(selectedRecords.map((record) => updateClassification(record.id, { status })));
    setSelectedIds(new Set());
    setMessage({ type: 'success', text: `Updated ${selectedRecords.length} classifications to ${status}.` });
    await loadData();
  };

  const handleArchiveSelected = async () => {
    await updateSelectedStatus('Archived');
  };

  const handleDeleteSelected = async () => {
    if (!canManage) {
      setMessage({ type: 'error', text: 'Admin access required to delete classifications.' });
      return;
    }
    if (selectedRecords.length === 0) return;
    if (!window.confirm(`Delete ${selectedRecords.length} selected classifications?`)) return;

    await Promise.all(selectedRecords.map((record) => deleteClassification(record.id)));
    setSelectedIds(new Set());
    setMessage({ type: 'success', text: `Deleted ${selectedRecords.length} classifications.` });
    await loadData();
  };

  const handleDownloadSelected = () => {
    if (selectedRecords.length === 0) return;
    downloadJsonFile(`seascan-classifications-${new Date().toISOString().slice(0, 10)}.json`, selectedRecords);
    setMessage({ type: 'info', text: `Downloaded ${selectedRecords.length} classifications.` });
  };

  const handleTrendAnalysisSelected = () => {
    if (selectedRecords.length === 0) return;
    if (!onTrendAnalysis) {
      setMessage({ type: 'error', text: 'Trend Analysis navigation is not configured.' });
      return;
    }
    onTrendAnalysis(selectedRecords);
  };

  const handleSingleDownload = (classification: ClassificationRecord) => {
    downloadJsonFile(`classification-${classification.id}.json`, classification);
  };

  const handleSingleArchive = async (classification: ClassificationRecord) => {
    if (!canManage) {
      setMessage({ type: 'error', text: 'Admin access required to update status.' });
      return;
    }
    await updateClassification(classification.id, { status: 'Archived' });
    await loadData();
  };


  const handleSingleTrendAnalysis = (classification: ClassificationRecord) => {
    if (!onTrendAnalysis) {
      setMessage({ type: 'error', text: 'Trend Analysis navigation is not configured.' });
      return;
    }
    onTrendAnalysis([classification]);
  };

  const handleSingleDelete = async (classification: ClassificationRecord) => {
    if (!canManage) {
      setMessage({ type: 'error', text: 'Admin access required to delete classifications.' });
      return;
    }
    if (!window.confirm(`Delete classification #${classification.id}?`)) return;
    await deleteClassification(classification.id);
    await loadData();
  };

  const handleSaveNotes = async (classification: ClassificationRecord, notes: string) => {
    if (!canManage) {
      setMessage({ type: 'error', text: 'Admin access required to update notes.' });
      return;
    }
    await updateClassification(classification.id, { notes });
    await loadData();
  };

  const resetFilters = () => setFilters(defaultFilters);

  const allSelectedVisible = filteredRecords.length > 0 && filteredRecords.every((record) => selectedIds.has(record.id));

  const toggleSelectAllVisible = () => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (allSelectedVisible) {
        filteredRecords.forEach((record) => next.delete(record.id));
      } else {
        filteredRecords.forEach((record) => next.add(record.id));
      }
      return next;
    });
  };

  return (
    <div className="space-y-6 pb-10">
      <div className="flex flex-col gap-2">
        <p className="text-sm uppercase tracking-[0.3em] text-[#00C9A7]/70">Monitoring Intelligence</p>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-3xl font-semibold text-white" style={{ fontFamily: 'Syne, sans-serif' }}>
              Data Management
            </h2>
            <p className="mt-2 max-w-3xl text-sm text-gray-400">
              Organized by monitored location, with classification history, filtering, bulk operations, and temporal review tools.
            </p>
          </div>
          <button
            onClick={refresh}
            className="inline-flex items-center gap-2 rounded-xl border border-[#00C9A7]/20 bg-[#00C9A7]/10 px-4 py-2 text-sm text-[#00C9A7] transition-colors hover:bg-[#00C9A7]/20"
          >
            {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
            Refresh
          </button>
        </div>
      </div>

      {message && (
        <div className={`rounded-2xl border px-4 py-3 text-sm ${message.type === 'error' ? 'border-red-500/30 bg-red-500/10 text-red-200' : message.type === 'success' ? 'border-[#3DDC84]/30 bg-[#3DDC84]/10 text-[#b5f3c8]' : 'border-[#00C9A7]/30 bg-[#00C9A7]/10 text-[#bff7ef]'}`}>
          {message.text}
        </div>
      )}

      <SummaryCards metrics={metrics} loading={loading} />

      <FilterBar filters={filters} detectionTypes={detectionTypes} onChange={setFilters} onReset={resetFilters} />

      <BulkActionToolbar
        selectedCount={selectedRecords.length}
        canManage={canManage}
        onArchive={handleArchiveSelected}
        onDelete={handleDeleteSelected}
        onDownload={handleDownloadSelected}
        onTrendAnalysis={handleTrendAnalysisSelected}
      />

      {error && (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4">
          <div className="flex items-center gap-2 text-red-200">
            <AlertCircle className="h-4 w-4" />
            <span className="text-sm">{error}</span>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center rounded-3xl border border-[#00C9A7]/20 bg-[#010812] py-24">
          <Loader2 className="mr-3 h-6 w-6 animate-spin text-[#00C9A7]" />
          <span className="text-gray-300">Loading classifications...</span>
        </div>
      ) : filteredRecords.length === 0 ? (
        <div className="rounded-3xl border border-[#00C9A7]/20 bg-[#010812] px-6 py-16 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#00C9A7]/10 text-[#00C9A7]">
            <AlertCircle className="h-8 w-8" />
          </div>
          <h3 className="text-lg font-semibold text-white">No classifications match the current filters</h3>
          <p className="mx-auto mt-2 max-w-xl text-sm text-gray-400">
            Adjust the search, status, date range, or size filters to view another subset of your monitored locations.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3 rounded-2xl border border-[#00C9A7]/20 bg-[#010812] px-4 py-3 text-sm text-gray-300">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={allSelectedVisible}
                onChange={toggleSelectAllVisible}
                className="h-4 w-4 rounded border-[#00C9A7]/30 bg-[#020D1A] text-[#00C9A7]"
              />
              Select all visible
            </label>
            <span>{filteredRecords.length.toLocaleString()} visible records</span>
          </div>

          {groupedLocations.map((group) => (
            <LocationGroup
              key={group.location}
              group={group}
              expanded={expandedLocations.has(group.location)}
              selectedIds={selectedIds}
              expandedIds={expandedIds}
              canManage={canManage}
              onToggleGroup={toggleLocation}
              onToggleSelect={toggleSelected}
              onToggleExpand={toggleExpanded}
              onDownload={handleSingleDownload}
              onArchive={handleSingleArchive}
              onTrendAnalysis={handleSingleTrendAnalysis}
              onDelete={handleSingleDelete}
              onSaveNotes={handleSaveNotes}
            />
          ))}
        </div>
      )}
    </div>
  );
}
