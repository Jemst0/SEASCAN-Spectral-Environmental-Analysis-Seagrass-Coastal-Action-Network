import { useMemo, useState } from 'react';
import { Archive, CheckSquare, Download, Edit3, Eye, LineChart, Square, Trash2 } from 'lucide-react';
import type { ClassificationRecord } from './types';
import StatusBadge from './StatusBadge';

type ClassificationCardProps = {
  classification: ClassificationRecord;
  selected: boolean;
  expanded: boolean;
  canManage: boolean;
  onToggleSelect: (id: number) => void;
  onToggleExpand: (id: number) => void;
  onDownload: (classification: ClassificationRecord) => void;
  onArchive: (classification: ClassificationRecord) => void;
  onTrendAnalysis: (classification: ClassificationRecord) => void;
  onDelete: (classification: ClassificationRecord) => void;
  onSaveNotes: (classification: ClassificationRecord, notes: string) => void;
};

function formatDate(value?: string | null) {
  if (!value) return 'N/A';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString();
}

function formatNumber(value?: number | null) {
  if (value == null) return 'N/A';
  return value.toLocaleString();
}

function formatArea(value?: number | null, unit?: string | null) {
  if (value == null) return 'N/A';
  return `${value.toLocaleString()} ${unit || ''}`.trim();
}

function formatPixelArea(value?: number | null) {
  if (value == null) return 'N/A';
  return `${value.toLocaleString(undefined, { maximumFractionDigits: 2 })} m2`;
}

export default function ClassificationCard({
  classification,
  selected,
  expanded,
  canManage,
  onToggleSelect,
  onToggleExpand,
  onDownload,
  onArchive,
  onTrendAnalysis,
  onDelete,
  onSaveNotes,
}: ClassificationCardProps) {
  const [notesDraft, setNotesDraft] = useState(classification.notes || '');
  const [editingNotes, setEditingNotes] = useState(false);

  const thumbnail = useMemo(() => {
    if (!classification.classified_image_base64) return null;
    const base64 = classification.classified_image_base64.startsWith('data:')
      ? classification.classified_image_base64
      : `data:image/png;base64,${classification.classified_image_base64}`;
    return base64;
  }, [classification.classified_image_base64]);

  return (
    <div className="overflow-hidden rounded-2xl border border-[#00C9A7]/20 bg-[#010812] transition-all duration-300 hover:border-[#00C9A7]/40">
      <div className="flex gap-4 p-4 md:p-5">
        <button
          onClick={() => onToggleSelect(classification.id)}
          className="mt-1 h-5 w-5 shrink-0 rounded border border-[#00C9A7]/30 text-[#00C9A7]"
          aria-label={selected ? 'Deselect classification' : 'Select classification'}
        >
          {selected ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}
        </button>

        <button
          onClick={() => onToggleExpand(classification.id)}
          className="group relative h-24 w-24 shrink-0 overflow-hidden rounded-xl border border-[#00C9A7]/20 bg-[#020D1A]"
          title="View details"
        >
          {thumbnail ? (
            <img src={thumbnail} alt={`Classification ${classification.id} thumbnail`} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-xs text-gray-500">No preview</div>
          )}
          <div className="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition-all group-hover:bg-black/30 group-hover:opacity-100">
            <Eye className="h-5 w-5 text-white" />
          </div>
        </button>

        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h4 className="truncate text-base font-semibold text-white">#{classification.id}</h4>
                <StatusBadge status={classification.status} />
              </div>
              <p className="mt-1 text-sm text-gray-300">{classification.study_area_name}</p>
              <p className="truncate text-xs text-[#00C9A7]/70">{classification.study_area_location || 'Location not specified'}</p>
            </div>
            <div className="text-right text-xs text-gray-400">
              <p>Processed: <span className="text-white">{formatDate(classification.classification_date || classification.classification_timestamp)}</span></p>
              <p>Last updated: <span className="text-white">{formatDate(classification.last_updated || classification.created_at)}</span></p>
            </div>
          </div>

          <div className="grid gap-3 text-sm md:grid-cols-4 lg:grid-cols-6">
            <div>
              <p className="text-xs text-gray-500">Detection Type</p>
              <p className="mt-1 text-white">{classification.detection_type || 'N/A'}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Affected Area</p>
              <p className="mt-1 text-white">{formatArea(classification.affected_area_size, classification.affected_area_unit)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Confidence</p>
              <p className="mt-1 text-white">
                {classification.confidence_score != null ? `${classification.confidence_score}%` : 'N/A'}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Source</p>
              <p className="mt-1 text-white">{classification.source || 'N/A'}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Total Pixels</p>
              <p className="mt-1 text-white">{formatNumber(classification.total_pixels)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Filename</p>
              <p className="mt-1 truncate text-white">{classification.uploaded_filename || 'N/A'}</p>
            </div>
          </div>

          {expanded && (
            <div className="rounded-xl border border-[#00C9A7]/10 bg-[#020D1A] p-4">
              <div className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <p className="text-xs text-gray-500">Water</p>
                  <p className="mt-1 text-[#4A9EFF]">{formatNumber(classification.water_pixels)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Seagrass</p>
                  <p className="mt-1 text-[#3DDC84]">{formatNumber(classification.seagrass_pixels)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Sand</p>
                  <p className="mt-1 text-[#E8C97A]">{formatNumber(classification.sand_pixels)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Clouds</p>
                  <p className="mt-1 text-gray-300">{formatNumber(classification.cloud_pixels)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Pixel Area</p>
                  <p className="mt-1 text-[#00C9A7]">{formatPixelArea(classification.pixel_area_sqm)}</p>
                </div>
              </div>

              <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_auto]">
                <div>
                  <p className="text-xs text-gray-500">Notes</p>
                  {editingNotes && canManage ? (
                    <textarea
                      value={notesDraft}
                      onChange={(event) => setNotesDraft(event.target.value)}
                      rows={3}
                      className="mt-2 w-full rounded-xl border border-[#00C9A7]/20 bg-[#010812] px-3 py-2 text-sm text-white outline-none placeholder:text-gray-500"
                      placeholder="Add notes about this classification"
                    />
                  ) : (
                    <p className="mt-2 text-sm text-gray-300">{classification.notes || 'No notes added yet.'}</p>
                  )}
                </div>
                <div className="flex flex-wrap gap-2 self-start lg:justify-end">
                  {editingNotes && canManage ? (
                    <button
                      onClick={() => {
                        onSaveNotes(classification, notesDraft);
                        setEditingNotes(false);
                      }}
                      className="inline-flex items-center gap-2 rounded-xl border border-[#00C9A7]/20 bg-[#00C9A7]/10 px-3 py-2 text-sm text-[#00C9A7] transition-colors hover:bg-[#00C9A7]/20"
                    >
                      Save notes
                    </button>
                  ) : canManage ? (
                    <button
                      onClick={() => setEditingNotes(true)}
                      className="inline-flex items-center gap-2 rounded-xl border border-[#00C9A7]/20 bg-[#00C9A7]/10 px-3 py-2 text-sm text-[#00C9A7] transition-colors hover:bg-[#00C9A7]/20"
                    >
                      <Edit3 className="h-4 w-4" />
                      Add Notes
                    </button>
                  ) : null}
                  <button
                    onClick={() => onDownload(classification)}
                    className="inline-flex items-center gap-2 rounded-xl border border-[#4A9EFF]/20 bg-[#4A9EFF]/10 px-3 py-2 text-sm text-[#4A9EFF] transition-colors hover:bg-[#4A9EFF]/20"
                  >
                    <Download className="h-4 w-4" />
                    Download
                  </button>
                  <button
                    onClick={() => onTrendAnalysis(classification)}
                    className="inline-flex items-center gap-2 rounded-xl border border-[#E8C97A]/20 bg-[#E8C97A]/10 px-3 py-2 text-sm text-[#E8C97A] transition-colors hover:bg-[#E8C97A]/20"
                  >
                    <LineChart className="h-4 w-4" />
                    Trend Analysis
                  </button>
                  {canManage ? (
                    <button
                      onClick={() => onArchive(classification)}
                      className="inline-flex items-center gap-2 rounded-xl border border-[#3DDC84]/20 bg-[#3DDC84]/10 px-3 py-2 text-sm text-[#3DDC84] transition-colors hover:bg-[#3DDC84]/20"
                    >
                      <Archive className="h-4 w-4" />
                      Archive
                    </button>
                  ) : null}
                  {canManage ? (
                    <button
                      onClick={() => onDelete(classification)}
                      className="inline-flex items-center gap-2 rounded-xl border border-[#ff4a4a]/20 bg-[#ff4a4a]/10 px-3 py-2 text-sm text-[#ff8a8a] transition-colors hover:bg-[#ff4a4a]/20"
                    >
                      <Trash2 className="h-4 w-4" />
                      Delete
                    </button>
                  ) : null}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
