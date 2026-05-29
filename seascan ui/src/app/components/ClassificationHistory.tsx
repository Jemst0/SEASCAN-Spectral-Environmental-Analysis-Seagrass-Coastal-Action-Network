import { useEffect, useState } from 'react';
import { AlertCircle, Loader2, Download, Trash2, Eye } from 'lucide-react';
import { fetchWithRetry } from '../utils/network';
import { buildApiUrl } from '../utils/apiBase';

type ClassificationRecord = {
  id: number;
  study_area_name: string;
  location: string;
  timestamp: string;
  status?: string;
  detection_type?: string;
  affected_area_size?: number | null;
  affected_area_unit?: string;
  confidence_score?: number | null;
  source?: string;
  classification_date?: string;
  last_updated?: string;
  water_pixels: number;
  seagrass_pixels: number;
  sand_pixels: number;
  cloud_pixels: number;
  total_pixels: number;
  notes: string;
};

type ClassificationHistoryProps = {
  studyAreaName?: string; // If provided, only show records for this area
};

export default function ClassificationHistory({ studyAreaName }: ClassificationHistoryProps) {
  const [records, setRecords] = useState<ClassificationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  useEffect(() => {
    fetchRecords();
  }, [studyAreaName]);

  const fetchRecords = async () => {
    setLoading(true);
    setError(null);

    try {
      let endpoint = buildApiUrl('/study-areas');
      
      if (studyAreaName) {
        endpoint = buildApiUrl(`/study-areas/${encodeURIComponent(studyAreaName)}`);
      }

      const response = await fetchWithRetry(endpoint);
      if (!response.ok) throw new Error('Failed to fetch records');

      const data = await response.json();
      
      // Extract classifications from response
      if (studyAreaName && data.classifications) {
        setRecords(data.classifications);
      } else if (data.study_areas) {
        // For all areas view, flatten the data
        const allRecords: ClassificationRecord[] = [];
        data.study_areas.forEach((area: any) => {
          if (area.classifications) {
            allRecords.push(...area.classifications);
          }
        });
        setRecords(allRecords);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch records');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this classification?')) return;

    try {
      const response = await fetchWithRetry(buildApiUrl(`/classification/${id}`), {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Failed to delete');
      
      setRecords(records.filter(r => r.id !== id));
    } catch (err) {
      alert('Failed to delete classification');
    }
  };

  const formatDate = (timestamp: string) => {
    return new Date(timestamp).toLocaleDateString() + ' ' + 
           new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatPixels = (value: number) => {
    if (value >= 1000000) return (value / 1000000).toFixed(1) + 'M';
    if (value >= 1000) return (value / 1000).toFixed(1) + 'K';
    return value.toString();
  };

  return (
    <div className="space-y-4">
      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-400" />
          <span className="text-red-400 text-sm">{error}</span>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 text-[#00C9A7] animate-spin mr-2" />
          <span className="text-gray-400">Loading classification history...</span>
        </div>
      ) : records.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-400 text-sm">No classifications found</p>
        </div>
      ) : (
        <div className="space-y-2">
          {records.map((record) => (
            <div
              key={record.id}
              className="bg-[#010812] border border-[#00C9A7]/20 rounded-lg overflow-hidden"
            >
              <button
                onClick={() => setExpandedId(expandedId === record.id ? null : record.id)}
                className="w-full px-4 py-3 flex items-center gap-3 hover:bg-[#020D1A] transition-colors text-left"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-white font-medium text-sm truncate">{record.study_area_name}</p>
                  <p className="text-gray-400 text-xs font-mono truncate">{record.location}</p>
                  <p className="text-gray-500 text-xs mt-1">{formatDate(record.timestamp)}</p>
                  <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
                    <span className="px-2 py-0.5 rounded-full bg-[#00C9A7]/10 text-[#00C9A7] border border-[#00C9A7]/20">
                      {record.status || 'Processed'}
                    </span>
                    {record.detection_type && (
                      <span className="px-2 py-0.5 rounded-full bg-[#4A9EFF]/10 text-[#4A9EFF] border border-[#4A9EFF]/20">
                        {record.detection_type}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3 text-xs">
                  <div className="text-right">
                    <p className="text-[#4A9EFF] font-medium">{formatPixels(record.water_pixels)}</p>
                    <p className="text-gray-500">Water</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[#3DDC84] font-medium">{formatPixels(record.seagrass_pixels)}</p>
                    <p className="text-gray-500">Seagrass</p>
                  </div>
                </div>
              </button>

              {expandedId === record.id && (
                <div className="px-4 py-3 bg-[#020D1A] border-t border-[#00C9A7]/10 space-y-3">
                  <div className="grid grid-cols-4 gap-3 text-xs">
                    <div>
                      <p className="text-gray-400 mb-1">Water</p>
                      <p className="text-[#4A9EFF] font-medium">{record.water_pixels.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-gray-400 mb-1">Seagrass</p>
                      <p className="text-[#3DDC84] font-medium">{record.seagrass_pixels.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-gray-400 mb-1">Sand</p>
                      <p className="text-[#E8C97A] font-medium">{record.sand_pixels.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-gray-400 mb-1">Clouds</p>
                      <p className="text-gray-400 font-medium">{record.cloud_pixels.toLocaleString()}</p>
                    </div>
                  </div>

                  {record.notes && (
                    <div>
                      <p className="text-gray-400 text-xs mb-1">Notes</p>
                      <p className="text-gray-300 text-sm">{record.notes}</p>
                    </div>
                  )}

                  <div className="grid grid-cols-3 gap-3 text-xs">
                    <div>
                      <p className="text-gray-400 mb-1">Confidence</p>
                      <p className="text-white font-medium">
                        {record.confidence_score != null ? `${record.confidence_score}%` : 'N/A'}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-400 mb-1">Affected Area</p>
                      <p className="text-white font-medium">
                        {record.affected_area_size != null
                          ? `${record.affected_area_size} ${record.affected_area_unit || ''}`.trim()
                          : 'N/A'}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-400 mb-1">Source</p>
                      <p className="text-white font-medium">{record.source || 'N/A'}</p>
                    </div>
                  </div>

                  <div className="flex gap-2 pt-2">
                    <button className="flex-1 px-3 py-2 bg-[#00C9A7]/20 border border-[#00C9A7]/30 text-[#00C9A7] rounded text-xs font-medium hover:bg-[#00C9A7]/30 transition-colors flex items-center justify-center gap-1">
                      <Download className="w-3 h-3" />
                      Export
                    </button>
                    <button
                      onClick={() => handleDelete(record.id)}
                      className="flex-1 px-3 py-2 bg-red-500/20 border border-red-500/30 text-red-400 rounded text-xs font-medium hover:bg-red-500/30 transition-colors flex items-center justify-center gap-1"
                    >
                      <Trash2 className="w-3 h-3" />
                      Delete
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
