export default function BandSelector() {
  const bands = [
    { id: 'B02', name: 'Blue', wavelength: '490nm', active: true },
    { id: 'B03', name: 'Green', wavelength: '560nm', active: true },
    { id: 'B04', name: 'Red', wavelength: '665nm', active: true },
    { id: 'B05', name: 'Red Edge 1', wavelength: '705nm', active: false },
    { id: 'B06', name: 'Red Edge 2', wavelength: '740nm', active: false },
    { id: 'B07', name: 'Red Edge 3', wavelength: '783nm', active: false },
    { id: 'B08', name: 'NIR', wavelength: '842nm', active: true },
  ];

  return (
    <div className="bg-[#010812] border border-[#00C9A7]/30 rounded-2xl p-6 h-full">
      <div className="mb-4">
        <h3 className="text-xl font-bold text-white mb-1" style={{ fontFamily: 'Syne, sans-serif' }}>
          Band Selector
        </h3>
        <p className="text-[#00C9A7]/70 text-xs" style={{ fontFamily: 'Space Mono, monospace' }}>
          BandProcessor | select_bands(), compute_indices()
        </p>
      </div>

      <div className="space-y-2">
        {bands.map((band) => (
          <div
            key={band.id}
            className={`p-3 rounded-lg border transition-all cursor-pointer ${
              band.active
                ? 'bg-[#00C9A7]/10 border-[#00C9A7]/50'
                : 'bg-[#020D1A]/50 border-[#00C9A7]/20 hover:border-[#00C9A7]/40'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div
                  className={`w-2 h-2 rounded-full ${
                    band.active ? 'bg-[#00C9A7]' : 'bg-gray-600'
                  }`}
                />
                <div>
                  <p className="text-white font-medium text-sm" style={{ fontFamily: 'Space Mono, monospace' }}>
                    {band.id}
                  </p>
                  <p className="text-gray-400 text-xs">{band.name}</p>
                </div>
              </div>
              <span className="text-[#E8C97A] text-xs" style={{ fontFamily: 'Space Mono, monospace' }}>
                {band.wavelength}
              </span>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 p-4 bg-gradient-to-r from-[#4A9EFF]/10 to-[#3DDC84]/10 border border-[#4A9EFF]/30 rounded-lg">
        <p className="text-white text-sm font-medium mb-2">Active Indices</p>
        <div className="flex flex-wrap gap-2">
          <span className="px-2 py-1 bg-[#3DDC84]/20 text-[#3DDC84] text-xs rounded" style={{ fontFamily: 'Space Mono, monospace' }}>
            NDVI
          </span>
          <span className="px-2 py-1 bg-[#4A9EFF]/20 text-[#4A9EFF] text-xs rounded" style={{ fontFamily: 'Space Mono, monospace' }}>
            NDWI
          </span>
          <span className="px-2 py-1 bg-[#E8C97A]/20 text-[#E8C97A] text-xs rounded" style={{ fontFamily: 'Space Mono, monospace' }}>
            SABI
          </span>
        </div>
      </div>
    </div>
  );
}
