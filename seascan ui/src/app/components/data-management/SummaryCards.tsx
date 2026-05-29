import { Database, Loader2, Archive, MapPin, FileText } from 'lucide-react';
import type { SummaryMetrics } from './types';

type SummaryCardsProps = {
  metrics: SummaryMetrics;
  loading?: boolean;
};

const cards = [
  { key: 'totalClassifications', label: 'Total Classifications', icon: FileText, accent: '#00C9A7' },
  { key: 'archivedResults', label: 'Archived Results', icon: Archive, accent: '#3DDC84' },
  { key: 'totalLocationsMonitored', label: 'Total Locations Monitored', icon: MapPin, accent: '#ff7a7a' },
] as const;

export default function SummaryCards({ metrics, loading }: SummaryCardsProps) {
  return (
    <div className="grid gap-4 lg:grid-cols-5 md:grid-cols-3 sm:grid-cols-2">
      {cards.map((card) => {
        const Icon = card.icon;
        const value = metrics[card.key];

        return (
          <div key={card.key} className="rounded-2xl border border-[#00C9A7]/20 bg-[#010812] p-5 shadow-[0_0_0_1px_rgba(0,201,167,0.04)]">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ backgroundColor: `${card.accent}18` }}>
                <Icon className="h-5 w-5" style={{ color: card.accent }} />
              </div>
              <span className="text-[11px] uppercase tracking-[0.2em] text-gray-500">Monitor</span>
            </div>
            <p className="text-xs text-gray-400">{card.label}</p>
            <div className="mt-2 flex items-end gap-2">
              <span className="text-3xl font-semibold text-white" style={{ fontFamily: 'Space Mono, monospace' }}>
                {loading ? '—' : value.toLocaleString()}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
