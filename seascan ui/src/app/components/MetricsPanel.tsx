type MetricsPanelProps = {
  stats?: {
    totalCoastalPixels?: number | string;
    waterPixels?: number | string;
    seagrassPixels?: number | string;
    sandPixels?: number | string;
    cloudPixels?: number | string;
  };
};

const classDefinitions = [
  { key: 'waterPixels', label: 'Water', color: '#4A9EFF' },
  { key: 'seagrassPixels', label: 'Seagrass', color: '#3DDC84' },
  { key: 'sandPixels', label: 'Sand', color: '#E8C97A' },
  { key: 'cloudPixels', label: 'Clouds', color: '#FFFFFF' },
] as const;

function parseCount(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const cleaned = value.replace(/,/g, '').replace(/px$/i, '').trim();
    const parsed = Number.parseFloat(cleaned);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
}

function formatPixels(value: number): string {
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(2)}M`;
  }

  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(1)}K`;
  }

  return value.toLocaleString();
}

export default function MetricsPanel({ stats }: MetricsPanelProps) {
  const totalPixels = parseCount(stats?.totalCoastalPixels);
  const classRows = classDefinitions.map((item) => {
    const pixels = parseCount(stats?.[item.key]);
    const share = totalPixels > 0 ? (pixels / totalPixels) * 100 : 0;

    return {
      ...item,
      pixels,
      share,
    };
  });

  const dominantClass = [...classRows].sort((left, right) => right.pixels - left.pixels)[0];

  return (
    <div className="bg-[#010812] border border-[#00C9A7]/30 rounded-2xl p-6">
      <div className="mb-6">
        <h3 className="text-xl font-bold text-white mb-1" style={{ fontFamily: 'Syne, sans-serif' }}>
          Classification Summary
        </h3>
        <p className="text-[#00C9A7]/70 text-xs" style={{ fontFamily: 'Space Mono, monospace' }}>
          Backend counts returned by the classifier are shown below in pixels and class share.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="p-5 bg-gradient-to-br from-[#020D1A] to-[#010812] border border-[#00C9A7]/30 rounded-xl">
          <p className="text-gray-400 text-xs uppercase tracking-wider mb-2">TOTAL COASTAL PIXELS</p>
          <div className="mb-2">
            <span className="text-4xl font-bold text-[#00C9A7]" style={{ fontFamily: 'Space Mono, monospace' }}>
              {totalPixels > 0 ? totalPixels.toLocaleString() : '—'}
            </span>
          </div>
          <p className="text-gray-400 text-sm">Pixels classified inside the coastal mask</p>
        </div>

        <div className="p-5 bg-gradient-to-br from-[#020D1A] to-[#010812] border border-[#00C9A7]/30 rounded-xl">
          <p className="text-gray-400 text-xs uppercase tracking-wider mb-2">DOMINANT CLASS</p>
          <div className="mb-2 flex items-end gap-2">
            <span className="text-4xl font-bold" style={{ fontFamily: 'Space Mono, monospace', color: dominantClass?.color }}>
              {dominantClass?.label ?? '—'}
            </span>
          </div>
          <p className="text-gray-400 text-sm">
            {dominantClass
              ? `${formatPixels(dominantClass.pixels)} pixels (${dominantClass.share.toFixed(1)}% of total)`
              : 'Run a prediction to see class dominance'}
          </p>
        </div>
      </div>

      <div>
        <h4 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-4">
          PIXELS PER CLASS
        </h4>

        <div className="space-y-3">
          <div className="grid grid-cols-12 gap-3 text-xs text-gray-500 uppercase tracking-wider pb-2 border-b border-[#00C9A7]/10">
            <div className="col-span-4">CLASS</div>
            <div className="col-span-4 text-right">PIXELS</div>
            <div className="col-span-4 text-right">SHARE</div>
          </div>

          {classRows.map((cls) => (
            <div key={cls.key} className="grid grid-cols-12 gap-3 items-center">
              <div className="col-span-4 flex items-center gap-2">
                <div className="w-3 h-3 rounded" style={{ backgroundColor: cls.color }} />
                <span className="text-white text-sm font-medium">{cls.label}</span>
              </div>
              <div className="col-span-4 text-right">
                <span className="text-sm font-medium" style={{ fontFamily: 'Space Mono, monospace', color: cls.color }}>
                  {totalPixels > 0 ? formatPixels(cls.pixels) : '—'}
                </span>
              </div>
              <div className="col-span-4">
                <div className="flex items-center justify-end gap-3">
                  <div className="flex-1 h-2 bg-[#020D1A] rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{ backgroundColor: cls.color, width: `${Math.min(cls.share, 100)}%` }}
                    />
                  </div>
                  <span className="w-12 text-right text-xs text-gray-300" style={{ fontFamily: 'Space Mono, monospace' }}>
                    {totalPixels > 0 ? `${cls.share.toFixed(1)}%` : '—'}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
