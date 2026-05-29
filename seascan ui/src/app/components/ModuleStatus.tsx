import { Check, Loader2, AlertCircle, Clock } from 'lucide-react';

export default function ModuleStatus() {
  const modules = [
    { name: 'Atmospheric Correction', status: 'complete', time: '2.3s' },
    { name: 'Cloud Masking', status: 'complete', time: '1.8s' },
    { name: 'Water Segmentation', status: 'complete', time: '4.1s' },
    { name: 'CNN Feature Extraction', status: 'running', time: '12.5s' },
    { name: 'Seagrass Classification', status: 'pending', time: '--' },
    { name: 'Density Estimation', status: 'pending', time: '--' },
    { name: 'Metadata Export', status: 'pending', time: '--' },
  ];

  return (
    <div className="bg-[#010812] border border-[#00C9A7]/30 rounded-2xl p-6 h-full">
      <div className="mb-4">
        <h3 className="text-xl font-bold text-white mb-1" style={{ fontFamily: 'Syne, sans-serif' }}>
          Module Status
        </h3>
        <p className="text-[#00C9A7]/70 text-xs" style={{ fontFamily: 'Space Mono, monospace' }}>
          ProcessingModule | execute(), monitor_progress()
        </p>
      </div>

      <div className="space-y-2">
        {modules.map((module, index) => (
          <div
            key={index}
            className="flex items-center gap-3 p-3 bg-[#020D1A]/50 border border-[#00C9A7]/20 rounded-lg"
          >
            <div className="w-6 h-6 flex items-center justify-center">
              {module.status === 'complete' ? (
                <Check className="w-5 h-5 text-[#3DDC84]" />
              ) : module.status === 'running' ? (
                <Loader2 className="w-5 h-5 text-[#4A9EFF] animate-spin" />
              ) : module.status === 'error' ? (
                <AlertCircle className="w-5 h-5 text-red-400" />
              ) : (
                <Clock className="w-5 h-5 text-gray-600" />
              )}
            </div>
            <div className="flex-1">
              <p className={`text-sm font-medium ${module.status === 'pending' ? 'text-gray-500' : 'text-white'}`}>
                {module.name}
              </p>
            </div>
            <span
              className={`text-xs ${
                module.status === 'running' ? 'text-[#4A9EFF]' : 'text-gray-600'
              }`}
              style={{ fontFamily: 'Space Mono, monospace' }}
            >
              {module.time}
            </span>
          </div>
        ))}
      </div>

      <div className="mt-6 p-4 bg-gradient-to-r from-[#00C9A7]/10 to-[#3DDC84]/10 border border-[#00C9A7]/30 rounded-lg">
        <div className="flex items-center justify-between mb-2">
          <span className="text-white text-sm font-medium">Overall Progress</span>
          <span className="text-[#00C9A7] text-sm" style={{ fontFamily: 'Space Mono, monospace' }}>
            57%
          </span>
        </div>
        <div className="w-full h-2 bg-[#020D1A] rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-r from-[#00C9A7] to-[#3DDC84]" style={{ width: '57%' }} />
        </div>
      </div>
    </div>
  );
}
