import { Loader2 } from 'lucide-react';

export default function PipelineStatus() {
  return (
    <div className="bg-gradient-to-br from-[#010812] to-[#020D1A] border border-[#00C9A7]/30 rounded-2xl p-6">
      <div className="flex items-start gap-4">
        <Loader2 className="w-6 h-6 text-[#4A9EFF] animate-spin mt-1" />
        <div>
          <h2 className="text-2xl font-bold text-white mb-1" style={{ fontFamily: 'Syne, sans-serif' }}>
            Processing Classification Request
          </h2>
          <p className="text-[#00C9A7]/80 text-sm" style={{ fontFamily: 'Space Mono, monospace' }}>
            Upload received. Running preprocessing, CNN inference, coastal masking, and metric extraction.
          </p>
        </div>
      </div>
    </div>
  );
}
