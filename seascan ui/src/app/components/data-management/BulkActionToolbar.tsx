import { Archive, Download, LineChart, Trash2 } from 'lucide-react';

type BulkActionToolbarProps = {
  selectedCount: number;
  canManage: boolean;
  onArchive: () => void;
  onDelete: () => void;
  onDownload: () => void;
  onTrendAnalysis: () => void;
};

export default function BulkActionToolbar({
  selectedCount,
  canManage,
  onArchive,
  onDelete,
  onDownload,
  onTrendAnalysis,
}: BulkActionToolbarProps) {
  if (selectedCount === 0) return null;

  return (
    <div className="sticky top-[92px] z-10 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#00C9A7]/20 bg-[#020D1A]/95 px-4 py-3 backdrop-blur-xl">
      <p className="text-sm text-gray-300">
        <span className="font-semibold text-white">{selectedCount}</span> selected
      </p>
      <div className="flex flex-wrap gap-2">
        <button onClick={onTrendAnalysis} className="inline-flex items-center gap-2 rounded-xl border border-[#E8C97A]/20 bg-[#E8C97A]/10 px-3 py-2 text-sm text-[#E8C97A] transition-colors hover:bg-[#E8C97A]/20">
          <LineChart className="h-4 w-4" />
          Trend Analysis
        </button>
        <button onClick={onDownload} className="inline-flex items-center gap-2 rounded-xl border border-[#00C9A7]/20 bg-[#00C9A7]/10 px-3 py-2 text-sm text-[#00C9A7] transition-colors hover:bg-[#00C9A7]/20">
          <Download className="h-4 w-4" />
          Download selected
        </button>
        {canManage ? (
          <button onClick={onArchive} className="inline-flex items-center gap-2 rounded-xl border border-[#3DDC84]/20 bg-[#3DDC84]/10 px-3 py-2 text-sm text-[#3DDC84] transition-colors hover:bg-[#3DDC84]/20">
            <Archive className="h-4 w-4" />
            Archive selected
          </button>
        ) : null}
        {canManage ? (
          <button onClick={onDelete} className="inline-flex items-center gap-2 rounded-xl border border-[#ff4a4a]/20 bg-[#ff4a4a]/10 px-3 py-2 text-sm text-[#ff8a8a] transition-colors hover:bg-[#ff4a4a]/20">
            <Trash2 className="h-4 w-4" />
            Delete selected
          </button>
        ) : null}
      </div>
    </div>
  );
}
