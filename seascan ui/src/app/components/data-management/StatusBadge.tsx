import type { ClassificationStatus } from './types';

type StatusBadgeProps = {
  status?: ClassificationStatus | string | null;
};

const statusStyles: Record<string, { label: string; className: string }> = {
  Queued: { label: 'Queued', className: 'bg-[#4A9EFF]/10 text-[#4A9EFF] border-[#4A9EFF]/20' },
  Downloading: { label: 'Downloading', className: 'bg-[#E8C97A]/10 text-[#E8C97A] border-[#E8C97A]/20' },
  Processing: { label: 'Processing', className: 'bg-[#00C9A7]/10 text-[#00C9A7] border-[#00C9A7]/20' },
  Processed: { label: 'Processed', className: 'bg-[#3DDC84]/10 text-[#3DDC84] border-[#3DDC84]/20' },
  Failed: { label: 'Failed', className: 'bg-[#ff4a4a]/10 text-[#ff7a7a] border-[#ff4a4a]/20' },
  Archived: { label: 'Archived', className: 'bg-gray-500/10 text-gray-300 border-gray-500/20' },
};

export default function StatusBadge({ status }: StatusBadgeProps) {
  const normalized = (status || 'Processed').toString();
  const style = statusStyles[normalized] || {
    label: normalized,
    className: 'bg-[#00C9A7]/10 text-[#00C9A7] border-[#00C9A7]/20',
  };

  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-medium ${style.className}`}>
      {style.label}
    </span>
  );
}
