import { Download, FileJson, Image, FileText, Database } from 'lucide-react';

export default function ExportPanel() {
  const exportFormats = [
    { name: 'GeoTIFF', icon: Image, color: '#3DDC84', size: '48.2 MB' },
    { name: 'Shapefile', icon: Database, color: '#00C9A7', size: '12.8 MB' },
    { name: 'GeoJSON', icon: FileJson, color: '#4A9EFF', size: '8.4 MB' },
    { name: 'Report PDF', icon: FileText, color: '#E8C97A', size: '2.1 MB' },
  ];

  return (
    <div className="bg-[#010812] border border-[#00C9A7]/30 rounded-2xl p-6">
      <div className="mb-4">
        <h3 className="text-xl font-bold text-white mb-1" style={{ fontFamily: 'Syne, sans-serif' }}>
          Export Results
        </h3>
        <p className="text-[#00C9A7]/70 text-xs" style={{ fontFamily: 'Space Mono, monospace' }}>
          DataExporter | export_raster(), export_vector()
        </p>
      </div>

      <div className="space-y-3 mb-6">
        {exportFormats.map((format, index) => {
          const Icon = format.icon;
          return (
            <button
              key={index}
              className="w-full p-4 bg-[#020D1A]/50 border border-[#00C9A7]/20 rounded-xl hover:border-[#00C9A7]/50 transition-all group"
            >
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center"
                  style={{ backgroundColor: `${format.color}20` }}
                >
                  <Icon className="w-5 h-5" style={{ color: format.color }} />
                </div>
                <div className="flex-1 text-left">
                  <p className="text-white font-medium text-sm">{format.name}</p>
                  <p className="text-gray-400 text-xs" style={{ fontFamily: 'Space Mono, monospace' }}>
                    {format.size}
                  </p>
                </div>
                <Download className="w-5 h-5 text-gray-500 group-hover:text-[#00C9A7] transition-colors" />
              </div>
            </button>
          );
        })}
      </div>

      <button className="w-full py-3 bg-gradient-to-r from-[#00C9A7] to-[#3DDC84] text-[#020D1A] rounded-xl font-bold hover:opacity-90 transition-opacity flex items-center justify-center gap-2">
        <Download className="w-5 h-5" />
        Export All Formats
      </button>

      <div className="mt-6 p-4 bg-gradient-to-r from-[#4A9EFF]/10 to-[#00C9A7]/10 border border-[#4A9EFF]/30 rounded-xl">
        <p className="text-white text-sm font-medium mb-3">Export Options</p>
        <div className="space-y-2">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" defaultChecked className="w-4 h-4 rounded accent-[#00C9A7]" />
            <span className="text-gray-300 text-xs">Include metadata</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" defaultChecked className="w-4 h-4 rounded accent-[#00C9A7]" />
            <span className="text-gray-300 text-xs">Compress files</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" className="w-4 h-4 rounded accent-[#00C9A7]" />
            <span className="text-gray-300 text-xs">Add timestamp</span>
          </label>
        </div>
      </div>
    </div>
  );
}
