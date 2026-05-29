import InteractiveCoastalMap from './InteractiveCoastalMap';

const defaultClassifiedMap = new URL('../../imports/classified_overlay_unknown_date.png', import.meta.url).href;

export default function MapViewer({ mapSrc }: { mapSrc?: string }) {
  return (
    <InteractiveCoastalMap
      imageSrc={mapSrc || defaultClassifiedMap}
      title="Classified Coastal Map"
      subtitle="MapRenderer | render_classification(), apply_colormap()"
      legendItems={[
        { label: 'Water', color: '#4A9EFF' },
        { label: 'Seagrass', color: '#3DDC84' },
        { label: 'Sand', color: '#E8C97A' },
        { label: 'Cloud', color: '#FFFFFF' },
      ]}
    />
  );
}
