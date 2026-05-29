import InteractiveCoastalMap from '../InteractiveCoastalMap';
import MetricsPanel from '../MetricsPanel';

const classifiedMap = new URL('../../../imports/classified_overlay_unknown_date.png', import.meta.url).href;

type MapPageProps = {
  mapSrc?: string;
  predictionStats?: any;
};

export default function MapPage({ mapSrc, predictionStats }: MapPageProps) {

  return (
    <div className="space-y-6">
      <div className="mb-4">
        <h2 className="text-2xl font-bold text-white mb-1" style={{ fontFamily: 'Syne, sans-serif' }}>
          Interactive Map View
        </h2>
        <p className="text-[#00C9A7]/70 text-sm" style={{ fontFamily: 'Space Mono, monospace' }}>
          Leaflet map | drag, zoom, fit to image, and inspect class counts
        </p>
      </div>

      <InteractiveCoastalMap
        imageSrc={mapSrc || classifiedMap}
        title="Interactive Classified Map"
        subtitle="MapRenderer | drag, zoom, reset, and inspect class distribution"
        legendItems={[
          { label: 'Water', color: '#4A9EFF' },
          { label: 'Seagrass', color: '#3DDC84' },
          { label: 'Sand', color: '#E8C97A' },
          { label: 'Cloud', color: '#FFFFFF' },
        ]}
      />

      <MetricsPanel stats={predictionStats} />
    </div>
  );
}
