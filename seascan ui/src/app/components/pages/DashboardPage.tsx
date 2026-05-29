import { useState } from 'react';
import ImageUpload from '../ImageUpload';
import MapViewer from '../MapViewer';
import MetricsPanel from '../MetricsPanel';
import SaveClassificationPanel from '../SaveClassificationPanel';
import { AlertCircle, Save } from 'lucide-react';
import { fetchWithRetry } from '../../utils/network';
import { buildApiUrl } from '../../utils/apiBase';

type PredictionStats = {
  water?: string;
  seagrass?: string;
  sand?: string;
  waterPixels?: number;
  seagrassPixels?: number;
  sandPixels?: number;
  cloudPixels?: number;
  totalCoastalPixels?: number;
  pixelAreaSqM?: number;
};

type DashboardPageProps = {
  predictionImage?: string;
  predictionStats?: PredictionStats;
  studyAreaName?: string;
  studyAreaLocation?: string;
  onPredictionComplete?: (data: any) => void;
};

export default function DashboardPage({
  predictionImage,
  predictionStats,
  studyAreaName = 'Unnamed Study Area',
  studyAreaLocation = 'Location not specified',
  onPredictionComplete,
}: DashboardPageProps) {
  const [showSavePanel, setShowSavePanel] = useState(false);
  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div>
        <h2 className="text-2xl font-bold text-white mb-2" style={{ fontFamily: 'Syne, sans-serif' }}>
          Coastal Seagrass Classifier
        </h2>
        <p className="text-[#00C9A7]/70 text-sm" style={{ fontFamily: 'Space Mono, monospace' }}>
          Upload Sentinel-2 satellite imagery to classify coastal features
        </p>
      </div>

      {/* Info Banner */}
      <div className="bg-[#00C9A7]/10 border border-[#00C9A7]/30 rounded-xl p-4 flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-[#00C9A7] flex-shrink-0 mt-0.5" />
        <div className="text-sm text-[#00C9A7]">
          <p className="font-medium mb-1">Getting started:</p>
          <p className="text-[#00C9A7]/80">Upload a ZIP file or folder containing Sentinel-2 TIFF bands (B01-B12) and a Ground_Truth.csv label file to classify coastal areas.</p>
        </div>
      </div>

      {/* Upload and Results Grid */}
      <div className="grid grid-cols-12 gap-6">
        {/* Upload Panel - Left Side */}
        <div className="col-span-4">
          <ImageUpload onPredictionComplete={onPredictionComplete} />
        </div>

        {/* Results Panel - Right Side */}
        <div className="col-span-8">
          {!predictionImage ? (
            <div className="bg-[#010812] border border-[#00C9A7]/30 rounded-2xl p-12 h-full flex flex-col items-center justify-center">
              <div className="text-center">
                <div className="w-16 h-16 rounded-lg bg-[#00C9A7]/10 flex items-center justify-center mx-auto mb-4">
                  <AlertCircle className="w-8 h-8 text-[#00C9A7]/50" />
                </div>
                <p className="text-gray-400 text-sm">
                  No classification yet. Upload imagery to see results.
                </p>
              </div>
            </div>
          ) : (
            <MapViewer mapSrc={predictionImage} />
          )}
        </div>
      </div>

      {/* Metrics Row */}
      {predictionImage && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-white" style={{ fontFamily: 'Syne, sans-serif' }}>
              Classification Results
            </h3>
            <button
              onClick={() => setShowSavePanel(true)}
              className="px-4 py-2 bg-[#00C9A7] text-[#020D1A] rounded-lg font-medium hover:bg-[#00C9A7]/90 transition-colors flex items-center gap-2"
            >
              <Save className="w-4 h-4" />
              Save Classification
            </button>
          </div>
          <MetricsPanel stats={predictionStats} />
        </div>
      )}

      {/* Save Classification Modal */}
      {showSavePanel && predictionImage && (
        <SaveClassificationPanel
          studyAreaName={studyAreaName}
          location={studyAreaLocation}
          imageSrc={predictionImage}
          stats={predictionStats || {}}
          onSave={async (data) => {
            // Call the backend save endpoint with form data and editable values
            const response = await fetchWithRetry(buildApiUrl('/save-classification'), {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                study_area_name: data.study_area_name,
                study_area_location: data.location,
                classification_date: data.date,
                status: data.status,
                detection_type: data.detection_type,
                affected_area_size: data.affected_area_size,
                affected_area_unit: data.affected_area_unit,
                confidence_score: data.confidence_score ? data.confidence_score : (predictionStats?.avgConfidencePercent ?? null),
                avg_confidence_percent: predictionStats?.avgConfidencePercent ?? null,
                source: data.source,
                uploaded_filename: 'classification_result.tiff',
                water_pixels: predictionStats?.waterPixels || 0,
                seagrass_pixels: predictionStats?.seagrassPixels || 0,
                sand_pixels: predictionStats?.sandPixels || 0,
                cloud_pixels: predictionStats?.cloudPixels || 0,
                total_pixels: predictionStats?.totalCoastalPixels || 0,
                pixel_area_sqm: predictionStats?.pixelAreaSqM ?? null,
                classified_image_base64: predictionImage.split(',')[1] || predictionImage,
                notes: data.notes,
              }),
            });
            if (!response.ok) {
              const errorData = await response.json();
              throw new Error(errorData.detail || 'Failed to save classification');
            }
            return response.json();
          }}
          onCancel={() => setShowSavePanel(false)}
        />
      )}
    </div>
  );
}
