import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { Layers, RotateCcw, ZoomIn, ZoomOut } from 'lucide-react';
import 'leaflet/dist/leaflet.css';

type LegendItem = {
  label: string;
  color: string;
};

type InteractiveCoastalMapProps = {
  imageSrc?: string;
  title: string;
  subtitle: string;
  legendItems: LegendItem[];
};

export default function InteractiveCoastalMap({
  imageSrc,
  title,
  subtitle,
  legendItems,
}: InteractiveCoastalMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const overlayRef = useRef<L.ImageOverlay | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(0);
  const [imageSize, setImageSize] = useState<{ width: number; height: number } | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) {
      return;
    }

    const map = L.map(containerRef.current, {
      crs: L.CRS.Simple,
      zoomControl: false,
      attributionControl: false,
      minZoom: -4,
      maxZoom: 6,
      scrollWheelZoom: true,
    });

    mapRef.current = map;

    const updateZoomState = () => {
      setZoomLevel(map.getZoom());
    };

    map.on('zoomend', updateZoomState);
    map.on('moveend', updateZoomState);
    L.control.scale({ metric: true, imperial: false, position: 'bottomleft' }).addTo(map);

    requestAnimationFrame(() => map.invalidateSize());
    setMapReady(true);

    return () => {
      map.off('zoomend', updateZoomState);
      map.off('moveend', updateZoomState);
      map.remove();
      mapRef.current = null;
      overlayRef.current = null;
      setMapReady(false);
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!mapReady || !map || !imageSrc) {
      return;
    }

    let cancelled = false;
    setIsReady(false);

    const image = new window.Image();
    image.crossOrigin = 'anonymous';
    image.src = imageSrc;

    image.onload = () => {
      if (cancelled || !mapRef.current) {
        return;
      }

      const width = image.naturalWidth || image.width || 1;
      const height = image.naturalHeight || image.height || 1;
      const bounds = L.latLngBounds([[0, 0], [height, width]]);

      overlayRef.current?.remove();
      overlayRef.current = L.imageOverlay(imageSrc, bounds, { interactive: false }).addTo(map);

      map.fitBounds(bounds, { padding: [24, 24], animate: false });
      map.setMaxBounds(bounds.pad(0.35));
      map.invalidateSize();

      setImageSize({ width, height });
      setZoomLevel(map.getZoom());
      setIsReady(true);
    };

    image.onerror = () => {
      if (!cancelled) {
        setIsReady(false);
      }
    };

    return () => {
      cancelled = true;
    };
  }, [imageSrc, mapReady]);

  const zoomIn = () => mapRef.current?.zoomIn();
  const zoomOut = () => mapRef.current?.zoomOut();
  const fitToImage = () => {
    const map = mapRef.current;
    const overlay = overlayRef.current;
    if (!map || !overlay) {
      return;
    }

    map.fitBounds(overlay.getBounds(), { padding: [24, 24], animate: false });
  };

  return (
    <div className="bg-[#010812] border border-[#00C9A7]/30 rounded-2xl p-6">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h3 className="text-xl font-bold text-white mb-1" style={{ fontFamily: 'Syne, sans-serif' }}>
            {title}
          </h3>
          <p className="text-[#00C9A7]/70 text-xs" style={{ fontFamily: 'Space Mono, monospace' }}>
            {subtitle}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={zoomIn}
            className="p-2 bg-[#020D1A] border border-[#00C9A7]/30 rounded-lg text-gray-400 hover:text-[#00C9A7] transition-colors"
            aria-label="Zoom in"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={zoomOut}
            className="p-2 bg-[#020D1A] border border-[#00C9A7]/30 rounded-lg text-gray-400 hover:text-[#00C9A7] transition-colors"
            aria-label="Zoom out"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={fitToImage}
            className="p-2 bg-[#020D1A] border border-[#00C9A7]/30 rounded-lg text-gray-400 hover:text-[#00C9A7] transition-colors"
            aria-label="Fit to image"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="relative overflow-hidden rounded-xl border border-[#00C9A7]/20" style={{ minHeight: '520px' }}>
        <div ref={containerRef} className="absolute inset-0" />

        <div className="absolute top-4 left-4 z-[500] rounded-lg border border-[#00C9A7]/30 bg-[#020D1A]/90 px-3 py-2 backdrop-blur-sm">
          <p className="text-[#E8C97A] text-xs" style={{ fontFamily: 'Space Mono, monospace' }}>
            {isReady
              ? `Zoom ${zoomLevel.toFixed(1)} | ${imageSize ? `${imageSize.width} x ${imageSize.height} px` : 'Image loaded'}`
              : 'Loading classified map...'}
          </p>
        </div>

        <div className="absolute top-4 right-4 z-[500] w-[220px] rounded-lg border border-[#00C9A7]/30 bg-[#020D1A]/90 p-4 backdrop-blur-sm">
          <div className="mb-3 flex items-center gap-2 text-white text-sm font-medium">
            <Layers className="w-4 h-4 text-[#00C9A7]" />
            Legend
          </div>
          <div className="space-y-2">
            {legendItems.map((item) => (
              <div key={item.label} className="flex items-center gap-2">
                <div className="w-4 h-4 rounded" style={{ backgroundColor: item.color }} />
                <span className="text-gray-300 text-xs">{item.label}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="absolute bottom-4 left-4 z-[500] rounded-lg border border-[#00C9A7]/30 bg-[#020D1A]/90 px-3 py-2 backdrop-blur-sm">
          <p className="text-white text-xs mb-1">Interact</p>
          <p className="text-gray-300 text-xs" style={{ fontFamily: 'Space Mono, monospace' }}>
            Drag to pan, scroll to zoom, or use the controls above.
          </p>
        </div>
      </div>
    </div>
  );
}