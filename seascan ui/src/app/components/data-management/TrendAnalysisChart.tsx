import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import type { LocationTrendData } from './api';

interface TrendAnalysisChartProps {
  trendData: LocationTrendData | null;
  isLoading?: boolean;
  metric: 'all' | 'water' | 'seagrass' | 'sand' | 'cloud' | 'total';
  onMetricChange: (metric: 'all' | 'water' | 'seagrass' | 'sand' | 'cloud' | 'total') => void;
}

export default function TrendAnalysisChart({ trendData, isLoading = false, metric, onMetricChange }: TrendAnalysisChartProps) {

  const metricToDataKey = (m: string) => {
    switch (m) {
      case 'water':
        return 'water_pixels';
      case 'seagrass':
        return 'seagrass_pixels';
      case 'sand':
        return 'sand_pixels';
      case 'cloud':
        return 'cloud_pixels';
      case 'total':
        return 'total_pixels';
      default:
        return null;
    }
  };

  const metricDisplayName = (m: string) => {
    switch (m) {
      case 'water':
        return 'Water Pixels';
      case 'seagrass':
        return 'Seagrass Pixels';
      case 'sand':
        return 'Sand Pixels';
      case 'cloud':
        return 'Cloud Pixels';
      case 'total':
        return 'Total Pixels';
      default:
        return 'All Pixels';
    }
  };

  const computeStatsForKey = (key: string | null) => {
    if (!trendData || !trendData.dataPoints.length) return { min: 0, max: 0, avg: 0 };
    if (!key) return { min: 0, max: 0, avg: 0 };
    const vals = trendData.dataPoints.map((d) => (d as any)[key] || 0);
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
    return { min, max, avg };
  };
  if (isLoading) {
    return (
      <div className="bg-[#010812] border border-[#00C9A7]/30 rounded-2xl p-6">
        <div className="h-96 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin w-8 h-8 border-2 border-[#00C9A7] border-t-transparent rounded-full mx-auto mb-3" />
            <p className="text-gray-400 text-sm">Loading trend data...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!trendData || trendData.dataPoints.length === 0) {
    return (
      <div className="bg-[#010812] border border-[#00C9A7]/30 rounded-2xl p-6">
        <div className="h-96 flex items-center justify-center">
          <div className="text-center">
            <p className="text-gray-400 text-sm">No trend data available for this location</p>
          </div>
        </div>
      </div>
    );
  }

  if (trendData.dataPoints.length === 1) {
    return (
      <div className="bg-[#010812] border border-[#00C9A7]/30 rounded-2xl p-6">
        <div className="mb-4">
          <h3 className="text-xl font-bold text-white mb-1" style={{ fontFamily: 'Syne, sans-serif' }}>
            Trend Analysis - {trendData.location}
          </h3>
          <p className="text-[#00C9A7]/70 text-xs" style={{ fontFamily: 'Space Mono, monospace' }}>
            Only one classification available. Add more to see trends.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-4">
          {/* Metric selector for single-record view */}
          <div className="col-span-2 mb-2 flex items-center gap-3">
            <label className="text-gray-400 text-xs">Show:</label>
            <select
              value={metric}
              onChange={(e) => onMetricChange(e.target.value as any)}
              className="bg-[#020D1A] text-sm text-white px-3 py-2 rounded-md border border-[#00C9A7]/20"
            >
              <option value="all">All</option>
              <option value="water">Water</option>
              <option value="seagrass">Seagrass</option>
              <option value="sand">Sand</option>
              <option value="cloud">Clouds</option>
              <option value="total">Total</option>
            </select>
          </div>

          {metric === 'all' ? (
            <>
              <div className="p-4 bg-[#020D1A]/50 border border-[#00C9A7]/20 rounded-xl">
                <p className="text-gray-400 text-xs mb-2">Water Pixels</p>
                <p className="text-[#4A9EFF] font-bold text-lg" style={{ fontFamily: 'Space Mono, monospace' }}>
                  {trendData.dataPoints[0].water_pixels.toLocaleString()}
                </p>
              </div>
              <div className="p-4 bg-[#020D1A]/50 border border-[#00C9A7]/20 rounded-xl">
                <p className="text-gray-400 text-xs mb-2">Seagrass Pixels</p>
                <p className="text-[#3DDC84] font-bold text-lg" style={{ fontFamily: 'Space Mono, monospace' }}>
                  {trendData.dataPoints[0].seagrass_pixels.toLocaleString()}
                </p>
              </div>
              <div className="p-4 bg-[#020D1A]/50 border border-[#00C9A7]/20 rounded-xl">
                <p className="text-gray-400 text-xs mb-2">Sand Pixels</p>
                <p className="text-[#E8C97A] font-bold text-lg" style={{ fontFamily: 'Space Mono, monospace' }}>
                  {trendData.dataPoints[0].sand_pixels.toLocaleString()}
                </p>
              </div>
              <div className="p-4 bg-[#020D1A]/50 border border-[#00C9A7]/20 rounded-xl">
                <p className="text-gray-400 text-xs mb-2">Cloud Pixels</p>
                <p className="text-gray-400 font-bold text-lg" style={{ fontFamily: 'Space Mono, monospace' }}>
                  {trendData.dataPoints[0].cloud_pixels.toLocaleString()}
                </p>
              </div>
            </>
          ) : (
            <div className="p-4 bg-[#020D1A]/50 border border-[#00C9A7]/20 rounded-xl col-span-2">
              <p className="text-gray-400 text-xs mb-2">{metricDisplayName(metric)}</p>
              <p className="text-[#00C9A7] font-bold text-lg" style={{ fontFamily: 'Space Mono, monospace' }}>
                {(() => {
                  const key = metricToDataKey(metric);
                  return key ? (trendData.dataPoints[0] as any)[key].toLocaleString() : '0';
                })()}
              </p>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-[#010812] border border-[#00C9A7]/30 rounded-2xl p-6">
        <div className="mb-4">
          <h3 className="text-xl font-bold text-white mb-1" style={{ fontFamily: 'Syne, sans-serif' }}>
            Temporal Trend Analysis - {trendData.location}
          </h3>
          <div className="flex items-center gap-3">
            <p className="text-[#00C9A7]/70 text-xs" style={{ fontFamily: 'Space Mono, monospace' }}>
              Pixel count changes over time
            </p>
            <div className="ml-auto flex items-center gap-2">
              <label className="text-gray-400 text-xs">Show:</label>
              <select
                value={metric}
                onChange={(e) => onMetricChange(e.target.value as any)}
                className="bg-[#020D1A] text-sm text-white px-3 py-2 rounded-md border border-[#00C9A7]/20"
              >
                <option value="all">All</option>
                <option value="water">Water</option>
                <option value="seagrass">Seagrass</option>
                <option value="sand">Sand</option>
                <option value="cloud">Clouds</option>
                <option value="total">Total</option>
              </select>
            </div>
          </div>
        </div>

        <div style={{ width: '100%', height: 380 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={trendData.dataPoints} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#00C9A7" opacity={0.1} />
              <XAxis
                dataKey="date"
                stroke="#6B7280"
                style={{ fontSize: '12px', fontFamily: 'Space Mono, monospace' }}
              />
              <YAxis
                stroke="#6B7280"
                style={{ fontSize: '12px', fontFamily: 'Space Mono, monospace' }}
                label={{ value: 'Pixels', angle: -90, position: 'insideLeft', style: { fill: '#9CA3AF' } }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#010812',
                  border: '1px solid #00C9A7',
                  borderRadius: '8px',
                  fontFamily: 'Space Mono, monospace',
                  fontSize: '12px',
                }}
                labelStyle={{ color: '#ffffff' }}
                formatter={(value) => (typeof value === 'number' ? value.toLocaleString() : value)}
              />
              <Legend
                wrapperStyle={{ fontFamily: 'DM Sans, sans-serif', fontSize: '12px' }}
                iconType="line"
              />
              {metric === 'all' ? (
                <>
                  <Line
                    type="monotone"
                    dataKey="water_pixels"
                    stroke="#4A9EFF"
                    name="Water"
                    strokeWidth={2}
                    dot={{ fill: '#4A9EFF', r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="seagrass_pixels"
                    stroke="#3DDC84"
                    name="Seagrass"
                    strokeWidth={2}
                    dot={{ fill: '#3DDC84', r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="sand_pixels"
                    stroke="#E8C97A"
                    name="Sand"
                    strokeWidth={2}
                    dot={{ fill: '#E8C97A', r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="cloud_pixels"
                    stroke="#9CA3AF"
                    name="Clouds"
                    strokeWidth={2}
                    dot={{ fill: '#9CA3AF', r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                </>
              ) : (
                (() => {
                  const key = metricToDataKey(metric);
                  if (!key) return null;
                  const mapping: Record<string, { stroke: string; name: string }> = {
                    water_pixels: { stroke: '#4A9EFF', name: 'Water' },
                    seagrass_pixels: { stroke: '#3DDC84', name: 'Seagrass' },
                    sand_pixels: { stroke: '#E8C97A', name: 'Sand' },
                    cloud_pixels: { stroke: '#9CA3AF', name: 'Clouds' },
                    total_pixels: { stroke: '#00C9A7', name: 'Total' },
                  };
                  const cfg = mapping[key] || { stroke: '#00C9A7', name: metricDisplayName(metric) };
                  return (
                    <Line
                      type="monotone"
                      dataKey={key}
                      stroke={cfg.stroke}
                      name={cfg.name}
                      strokeWidth={2}
                      dot={{ fill: cfg.stroke, r: 4 }}
                      activeDot={{ r: 6 }}
                    />
                  );
                })()
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Statistics Grid */}
      <div className="grid grid-cols-2 gap-6">
        <div className="bg-[#010812] border border-[#00C9A7]/30 rounded-2xl p-6">
          <h4 className="text-lg font-bold text-white mb-4" style={{ fontFamily: 'Syne, sans-serif' }}>
            Pixel Count Statistics
          </h4>
          <div className="space-y-3">
            {/* Show stats for selected metric (or all) */}
            {metric === 'all' ? (
              <>
                {/* Water */}
                <div className="p-3 bg-[#020D1A]/50 border border-[#4A9EFF]/20 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-gray-400 text-xs">Water</span>
                    <span className="text-[#4A9EFF] text-xs font-medium" style={{ fontFamily: 'Space Mono, monospace' }}>
                      Avg: {Math.round(trendData.statistics.water.avg).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>Min: {trendData.statistics.water.min.toLocaleString()}</span>
                    <span>Max: {trendData.statistics.water.max.toLocaleString()}</span>
                  </div>
                </div>

                {/* Seagrass */}
                <div className="p-3 bg-[#020D1A]/50 border border-[#3DDC84]/20 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-gray-400 text-xs">Seagrass</span>
                    <span className="text-[#3DDC84] text-xs font-medium" style={{ fontFamily: 'Space Mono, monospace' }}>
                      Avg: {Math.round(trendData.statistics.seagrass.avg).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>Min: {trendData.statistics.seagrass.min.toLocaleString()}</span>
                    <span>Max: {trendData.statistics.seagrass.max.toLocaleString()}</span>
                  </div>
                </div>

                {/* Sand */}
                <div className="p-3 bg-[#020D1A]/50 border border-[#E8C97A]/20 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-gray-400 text-xs">Sand</span>
                    <span className="text-[#E8C97A] text-xs font-medium" style={{ fontFamily: 'Space Mono, monospace' }}>
                      Avg: {Math.round(trendData.statistics.sand.avg).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>Min: {trendData.statistics.sand.min.toLocaleString()}</span>
                    <span>Max: {trendData.statistics.sand.max.toLocaleString()}</span>
                  </div>
                </div>

                {/* Clouds */}
                <div className="p-3 bg-[#020D1A]/50 border border-gray-500/20 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-gray-400 text-xs">Clouds</span>
                    <span className="text-gray-400 text-xs font-medium" style={{ fontFamily: 'Space Mono, monospace' }}>
                      Avg: {Math.round(trendData.statistics.cloud.avg).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>Min: {trendData.statistics.cloud.min.toLocaleString()}</span>
                    <span>Max: {trendData.statistics.cloud.max.toLocaleString()}</span>
                  </div>
                </div>
              </>
            ) : (
              (() => {
                const key = metricToDataKey(metric);
                const s = computeStatsForKey(key);
                return (
                  <div className="p-3 bg-[#020D1A]/50 border border-[#00C9A7]/20 rounded-lg col-span-2">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-gray-400 text-xs">{metricDisplayName(metric)}</span>
                      <span className="text-[#00C9A7] text-xs font-medium" style={{ fontFamily: 'Space Mono, monospace' }}>
                        Avg: {Math.round(s.avg).toLocaleString()}
                      </span>
                    </div>
                    <div className="flex justify-between text-xs text-gray-500">
                      <span>Min: {s.min.toLocaleString()}</span>
                      <span>Max: {s.max.toLocaleString()}</span>
                    </div>
                  </div>
                );
              })()
            )}
          </div>
        </div>

        {/* Summary Info */}
        <div className="bg-[#010812] border border-[#00C9A7]/30 rounded-2xl p-6">
          <h4 className="text-lg font-bold text-white mb-4" style={{ fontFamily: 'Syne, sans-serif' }}>
            Trend Summary
          </h4>
          <div className="space-y-3">
            <div className="p-3 bg-[#020D1A]/50 border border-[#00C9A7]/20 rounded-lg">
              <p className="text-gray-400 text-xs mb-1">Classifications Analyzed</p>
              <p className="text-[#00C9A7] font-bold" style={{ fontFamily: 'Space Mono, monospace' }}>
                {trendData.dataPoints.length}
              </p>
            </div>
            <div className="p-3 bg-[#020D1A]/50 border border-[#00C9A7]/20 rounded-lg">
              <p className="text-gray-400 text-xs mb-1">Date Range</p>
              <p className="text-[#00C9A7] text-sm font-medium" style={{ fontFamily: 'Space Mono, monospace' }}>
                {trendData.dataPoints[0].date} to {trendData.dataPoints[trendData.dataPoints.length - 1].date}
              </p>
            </div>
            <div className="p-3 bg-[#020D1A]/50 border border-[#00C9A7]/20 rounded-lg">
              <p className="text-gray-400 text-xs mb-1">Location</p>
              <p className="text-[#00C9A7] text-sm font-medium break-words" style={{ fontFamily: 'Space Mono, monospace' }}>
                {trendData.location}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
