import { useState } from 'react';
import { Save, AlertCircle, Loader2, CheckCircle } from 'lucide-react';

type SaveClassificationPanelProps = {
  studyAreaName: string;
  location: string;
  imageSrc: string;
  stats: {
    totalCoastalPixels?: number;
    waterPixels?: number;
    seagrassPixels?: number;
    sandPixels?: number;
    cloudPixels?: number;
  };
  onSave: (data: {
    study_area_name: string;
    location: string;
    date: string;
    status: string;
    detection_type: string;
    affected_area_size: number | null;
    affected_area_unit: string;
    confidence_score: number | null;
    source: string;
    notes: string;
  }) => Promise<void>;
  onCancel: () => void;
};

export default function SaveClassificationPanel({
  studyAreaName,
  location,
  imageSrc,
  stats,
  onSave,
  onCancel,
}: SaveClassificationPanelProps) {
  const [inputStudyArea, setInputStudyArea] = useState(studyAreaName);
  const [inputLocation, setInputLocation] = useState(location);
  const [inputDate, setInputDate] = useState(new Date().toISOString().split('T')[0]);
  const [status, setStatus] = useState('Processed');
  const [detectionType, setDetectionType] = useState('');
  const [affectedAreaSize, setAffectedAreaSize] = useState('');
  const [affectedAreaUnit, setAffectedAreaUnit] = useState('sq km');
  const [confidenceScore, setConfidenceScore] = useState('');
  const [source, setSource] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    setSaving(true);
    setError(null);

    if (!inputStudyArea.trim()) {
      setError('Study area name is required');
      setSaving(false);
      return;
    }

    if (!inputLocation.trim()) {
      setError('Location is required');
      setSaving(false);
      return;
    }

    try {
      // Call the parent's onSave with editable values
      await onSave({
        study_area_name: inputStudyArea.trim(),
        location: inputLocation.trim(),
        date: inputDate,
        status,
        detection_type: detectionType.trim(),
        affected_area_size: affectedAreaSize ? Number(affectedAreaSize) : null,
        affected_area_unit: affectedAreaUnit.trim(),
        confidence_score: confidenceScore ? Number(confidenceScore) : null,
        source: source.trim(),
        notes: notes.trim(),
      });
      setSaved(true);
      setTimeout(() => {
        onCancel(); // Close the panel after success
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save classification');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" style={{ zIndex: 100000 }}>
      <div className="bg-[#010812] border border-[#00C9A7]/30 rounded-2xl p-8 w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {saved ? (
          <div className="flex flex-col items-center gap-4 py-8">
            <CheckCircle className="w-12 h-12 text-green-400 animate-pulse" />
            <h3 className="text-xl font-bold text-white text-center" style={{ fontFamily: 'Syne, sans-serif' }}>
              Classification Saved!
            </h3>
            <p className="text-[#00C9A7]/70 text-sm text-center">
              Your classification for <strong>{inputStudyArea}</strong> has been saved to the database.
            </p>
          </div>
        ) : (
          <>
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-4">
                <Save className="w-5 h-5 text-[#00C9A7]" />
                <h3 className="text-xl font-bold text-white" style={{ fontFamily: 'Syne, sans-serif' }}>
                  Save Classification
                </h3>
              </div>
              <p className="text-gray-300 text-sm">
                Store this classification result for future analysis and temporal comparison.
              </p>
            </div>

            {error && (
              <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg flex gap-2">
                <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                <p className="text-red-400 text-sm">{error}</p>
              </div>
            )}

            <div className="space-y-4 mb-6">
              {/* Study Area Input */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Study Area Name <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={inputStudyArea}
                  onChange={(e) => setInputStudyArea(e.target.value)}
                  placeholder="e.g., Coastal Region A, Test Site 1"
                  className="w-full px-3 py-2 bg-[#020D1A] border border-[#00C9A7]/30 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-[#00C9A7] transition-colors"
                  style={{ fontFamily: 'Space Mono, monospace' }}
                />
              </div>

              {/* Location Input */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Location <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={inputLocation}
                  onChange={(e) => setInputLocation(e.target.value)}
                  placeholder="e.g., 13.82°N, 121.06°E"
                  className="w-full px-3 py-2 bg-[#020D1A] border border-[#00C9A7]/30 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-[#00C9A7] transition-colors"
                  style={{ fontFamily: 'Space Mono, monospace' }}
                />
              </div>

              {/* Date Input */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Satellite Date
                </label>
                <input
                  type="date"
                  value={inputDate}
                  onChange={(e) => setInputDate(e.target.value)}
                  className="w-full px-3 py-2 bg-[#020D1A] border border-[#00C9A7]/30 rounded-lg text-white focus:outline-none focus:border-[#00C9A7] transition-colors"
                  style={{ fontFamily: 'Space Mono, monospace' }}
                />
                <p className="text-xs text-gray-500 mt-1">Date when the satellite image was captured (from Copernicus/GEE).</p>
              </div>

              {/* Status and Detection */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Status
                  </label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    className="w-full px-3 py-2 bg-[#020D1A] border border-[#00C9A7]/30 rounded-lg text-white focus:outline-none focus:border-[#00C9A7] transition-colors"
                    style={{ fontFamily: 'Space Mono, monospace' }}
                  >
                    <option value="Queued">Queued</option>
                    <option value="Downloading">Downloading</option>
                    <option value="Processing">Processing</option>
                    <option value="Processed">Processed</option>
                    <option value="Failed">Failed</option>
                    <option value="Archived">Archived</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Detection Type
                  </label>
                  <input
                    type="text"
                    value={detectionType}
                    onChange={(e) => setDetectionType(e.target.value)}
                    placeholder="e.g., Coastal Change"
                    className="w-full px-3 py-2 bg-[#020D1A] border border-[#00C9A7]/30 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-[#00C9A7] transition-colors"
                    style={{ fontFamily: 'Space Mono, monospace' }}
                  />
                </div>
              </div>

              {/* Affected Area and Confidence */}
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Affected Area Size
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={affectedAreaSize}
                      onChange={(e) => setAffectedAreaSize(e.target.value)}
                      placeholder="0.00"
                      className="w-full px-3 py-2 bg-[#020D1A] border border-[#00C9A7]/30 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-[#00C9A7] transition-colors"
                      style={{ fontFamily: 'Space Mono, monospace' }}
                      aria-label="Affected area size"
                    />
                    <div className="flex items-center gap-2">
                      <select
                        value={affectedAreaUnit}
                        onChange={(e) => setAffectedAreaUnit(e.target.value)}
                        className="w-full px-3 py-2 bg-[#020D1A] border border-[#00C9A7]/30 rounded-lg text-white focus:outline-none focus:border-[#00C9A7] transition-colors"
                        style={{ fontFamily: 'Space Mono, monospace' }}
                        aria-label="Affected area unit"
                      >
                        <option value="sq km">sq km</option>
                        <option value="ha">hectares</option>
                        <option value="m2">m²</option>
                      </select>
                      <button
                        type="button"
                        onClick={() => {
                          // Auto-calc if pixel area available in stats
                          // Expecting stats.pixelAreaSqM (area of one pixel in square meters)
                          if (stats?.totalCoastalPixels && (stats as any).pixelAreaSqM) {
                            const pixelArea = (stats as any).pixelAreaSqM; // m^2
                            const totalPixels = stats.totalCoastalPixels;
                            let areaValue = (totalPixels * pixelArea) / 1e6; // in sq km
                            // convert to selected unit
                            if (affectedAreaUnit === 'ha') areaValue = areaValue * 100; // 1 sqkm = 100 ha
                            if (affectedAreaUnit === 'm2') areaValue = areaValue * 1e6; // convert to m^2
                            setAffectedAreaSize(areaValue.toFixed(2).toString());
                            setError(null);
                          } else {
                            setError('Auto-calc unavailable: provide pixel area (pixelAreaSqM) in stats');
                          }
                        }}
                        className="px-2 py-1 bg-[#020D1A] border border-[#00C9A7]/20 text-[#00C9A7] rounded-md text-sm hover:bg-[#020D1A]/90"
                        aria-label="Auto-calculate affected area"
                      >
                        Auto-calc
                      </button>
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">Leave blank to auto-calculate from pixel count if pixel area is available.</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Confidence
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.1"
                      value={confidenceScore}
                      onChange={(e) => setConfidenceScore(e.target.value)}
                      placeholder="e.g., 92.5"
                      className="w-full pr-10 px-3 py-2 bg-[#020D1A] border border-[#00C9A7]/30 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-[#00C9A7] transition-colors"
                      style={{ fontFamily: 'Space Mono, monospace' }}
                      aria-label="Confidence percentage"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">%</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">Enter confidence as a percent (0–100). Defaults to model average if left empty.</p>
                </div>
              </div>

              {/* Source */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Source
                </label>
                <input
                  type="text"
                  value={source}
                  onChange={(e) => setSource(e.target.value)}
                  placeholder="e.g., Sentinel-2, Drone Survey"
                  className="w-full px-3 py-2 bg-[#020D1A] border border-[#00C9A7]/30 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-[#00C9A7] transition-colors"
                  style={{ fontFamily: 'Space Mono, monospace' }}
                />
              </div>

              {/* Classification Stats */}
              <div className="bg-[#020D1A] border border-[#00C9A7]/20 rounded-lg p-4">
                <p className="text-gray-400 text-xs font-bold mb-3">CLASSIFICATION SUMMARY</p>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-300">Water</span>
                    <span className="text-[#4A9EFF] font-medium">
                      {stats.waterPixels?.toLocaleString() || 0} px
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-300">Seagrass</span>
                    <span className="text-[#3DDC84] font-medium">
                      {stats.seagrassPixels?.toLocaleString() || 0} px
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-300">Sand</span>
                    <span className="text-[#E8C97A] font-medium">
                      {stats.sandPixels?.toLocaleString() || 0} px
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-300">Clouds</span>
                    <span className="text-gray-400 font-medium">
                      {stats.cloudPixels?.toLocaleString() || 0} px
                    </span>
                  </div>
                  <div className="flex justify-between pt-2 border-t border-[#00C9A7]/20">
                    <span className="text-gray-300 font-medium">Total Pixels</span>
                    <span className="text-[#00C9A7] font-bold">
                      {stats.totalCoastalPixels?.toLocaleString() || 0}
                    </span>
                  </div>
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Additional Notes (Optional)
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g., weather conditions, special observations, data source..."
                  rows={3}
                  className="w-full px-3 py-2 bg-[#020D1A] border border-[#00C9A7]/30 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-[#00C9A7] resize-none"
                  style={{ fontFamily: 'Space Mono, monospace' }}
                />
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3">
              <button
                onClick={onCancel}
                disabled={saving}
                className="flex-1 px-4 py-2 bg-[#020D1A] border border-[#00C9A7]/30 text-gray-300 rounded-lg font-medium hover:text-white disabled:opacity-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 px-4 py-2 bg-[#00C9A7] text-[#020D1A] rounded-lg font-bold hover:bg-[#00C9A7]/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    Save to Database
                  </>
                )}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
