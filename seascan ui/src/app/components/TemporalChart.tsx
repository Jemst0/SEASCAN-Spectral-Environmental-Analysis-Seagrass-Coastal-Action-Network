import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

export default function TemporalChart() {
  const data = [
    { month: 'Jan', dense: 3.2, medium: 2.8, sparse: 1.9 },
    { month: 'Feb', dense: 3.5, medium: 3.1, sparse: 2.1 },
    { month: 'Mar', dense: 4.1, medium: 3.4, sparse: 2.3 },
    { month: 'Apr', dense: 4.6, medium: 3.8, sparse: 2.6 },
    { month: 'May', dense: 5.2, medium: 4.2, sparse: 2.9 },
    { month: 'Jun', dense: 5.8, medium: 4.6, sparse: 3.2 },
    { month: 'Jul', dense: 6.1, medium: 4.9, sparse: 3.4 },
    { month: 'Aug', dense: 5.9, medium: 4.7, sparse: 3.3 },
    { month: 'Sep', dense: 5.4, medium: 4.3, sparse: 3.0 },
    { month: 'Oct', dense: 4.8, medium: 3.9, sparse: 2.7 },
  ];

  return (
    <div className="bg-[#010812] border border-[#00C9A7]/30 rounded-2xl p-6">
      <div className="mb-4">
        <h3 className="text-xl font-bold text-white mb-1" style={{ fontFamily: 'Syne, sans-serif' }}>
          Temporal Coverage Change
        </h3>
        <p className="text-[#00C9A7]/70 text-xs" style={{ fontFamily: 'Space Mono, monospace' }}>
          TemporalAnalyzer | track_changes(), compute_trends()
        </p>
      </div>

      <div style={{ width: '100%', height: 320 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#00C9A7" opacity={0.1} />
            <XAxis
              dataKey="month"
              stroke="#6B7280"
              style={{ fontSize: '12px', fontFamily: 'Space Mono, monospace' }}
            />
            <YAxis
              stroke="#6B7280"
              style={{ fontSize: '12px', fontFamily: 'Space Mono, monospace' }}
              label={{ value: 'Area (km²)', angle: -90, position: 'insideLeft', style: { fill: '#9CA3AF' } }}
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
            />
            <Legend
              wrapperStyle={{ fontFamily: 'DM Sans, sans-serif', fontSize: '12px' }}
              iconType="circle"
            />
            <Bar dataKey="dense" fill="#3DDC84" name="Dense" radius={[4, 4, 0, 0]} />
            <Bar dataKey="medium" fill="#00C9A7" name="Medium" radius={[4, 4, 0, 0]} />
            <Bar dataKey="sparse" fill="#E8C97A" name="Sparse" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-4 p-4 bg-[#020D1A]/50 border border-[#00C9A7]/20 rounded-xl">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-gray-400 text-xs mb-1">Trend</p>
            <p className="text-[#3DDC84] font-medium" style={{ fontFamily: 'Space Mono, monospace' }}>
              +18.3% Growth
            </p>
          </div>
          <div>
            <p className="text-gray-400 text-xs mb-1">Period</p>
            <p className="text-white font-medium" style={{ fontFamily: 'Space Mono, monospace' }}>
              Jan - Oct 2023
            </p>
          </div>
          <div>
            <p className="text-gray-400 text-xs mb-1">Peak Month</p>
            <p className="text-[#4A9EFF] font-medium" style={{ fontFamily: 'Space Mono, monospace' }}>
              July
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
