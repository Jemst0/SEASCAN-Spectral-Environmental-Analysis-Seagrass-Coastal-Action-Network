import { useState, useEffect } from 'react';
import { Trash2, Eye, Download } from 'lucide-react';
import useDatabase from '../../../hooks/useDatabase';

interface Classification {
  id: number;
  studyAreaName: string;
  location: string;
  timestamp: string;
  stats: {
    totalCoastalPixels?: number;
    seagrassPixels?: number;
    waterPixels?: number;
    sandPixels?: number;
    cloudPixels?: number;
  };
}

export default function ClassificationsHistory() {
  const [classifications, setClassifications] = useState<Classification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [selectedStudyArea, setSelectedStudyArea] = useState<string | null>(null);
  const db = useDatabase();

  useEffect(() => {
    loadClassifications();
  }, [db]);

  const loadClassifications = async () => {
    if (!db) return;
    setIsLoading(true);
    const result = await db.getAllClassifications();
    if (result.success) {
      setClassifications(result.data || []);
    }
    setIsLoading(false);
  };

  const handleDelete = async (id: number) => {
    if (!db) return;
    if (window.confirm('Delete this classification? This cannot be undone.')) {
      const result = await db.deleteClassification(id);
      if (result.success) {
        loadClassifications();
      }
    }
  };

  const groupedByStudyArea = classifications.reduce((acc, c) => {
    if (!acc[c.studyAreaName]) {
      acc[c.studyAreaName] = [];
    }
    acc[c.studyAreaName].push(c);
    return acc;
  }, {} as Record<string, Classification[]>);

  const displayClassifications = selectedStudyArea
    ? groupedByStudyArea[selectedStudyArea] || []
    : classifications;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white mb-1" style={{ fontFamily: 'Syne, sans-serif' }}>
          Classifications History
        </h2>
        <p className="text-[#00C9A7]/70 text-sm" style={{ fontFamily: 'Space Mono, monospace' }}>
          Browse and compare temporal classifications from your study areas.
        </p>
      </div>

      {isLoading ? (
        <div className="bg-[#010812] border border-[#00C9A7]/30 rounded-2xl p-12 text-center">
          <p className="text-gray-400">Loading classifications...</p>
        </div>
      ) : classifications.length === 0 ? (
        <div className="bg-[#010812] border border-[#00C9A7]/30 rounded-2xl p-12 text-center">
          <p className="text-gray-400">No classifications saved yet. Run an analysis on the Dashboard to create one.</p>
        </div>
      ) : (
        <div className="grid grid-cols-12 gap-6">
          {/* Study Area Selector */}
          <div className="col-span-3">
            <div className="bg-[#010812] border border-[#00C9A7]/30 rounded-2xl p-4 sticky top-6">
              <h3 className="text-white font-bold mb-3 text-sm">Study Areas</h3>
              <div className="space-y-2">
                <button
                  onClick={() => setSelectedStudyArea(null)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                    selectedStudyArea === null
                      ? 'bg-[#00C9A7]/20 text-[#00C9A7]'
                      : 'text-gray-400 hover:text-[#00C9A7]'
                  }`}
                >
                  All ({classifications.length})
                </button>
                {Object.entries(groupedByStudyArea).map(([area, items]) => (
                  <button
                    key={area}
                    onClick={() => setSelectedStudyArea(area)}
                    className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                      selectedStudyArea === area
                        ? 'bg-[#00C9A7]/20 text-[#00C9A7]'
                        : 'text-gray-400 hover:text-[#00C9A7]'
                    }`}
                  >
                    {area} ({items.length})
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Classifications List */}
          <div className="col-span-9">
            <div className="space-y-3">
              {displayClassifications.length === 0 ? (
                <div className="bg-[#010812] border border-[#00C9A7]/30 rounded-2xl p-8 text-center">
                  <p className="text-gray-400 text-sm">No classifications in this study area.</p>
                </div>
              ) : (
                displayClassifications.map((classification) => (
                  <div
                    key={classification.id}
                    className="bg-[#010812] border border-[#00C9A7]/20 rounded-xl p-4 hover:border-[#00C9A7]/50 transition-colors cursor-pointer"
                    onClick={() => setSelectedId(selectedId === classification.id ? null : classification.id)}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <p className="text-white font-medium">{classification.studyAreaName}</p>
                        <p className="text-gray-400 text-xs">{classification.location}</p>
                        <p className="text-[#00C9A7]/70 text-xs font-mono">
                          {new Date(classification.timestamp).toLocaleString()}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          className="p-2 text-gray-400 hover:text-[#4A9EFF] transition-colors"
                          title="View details"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          className="p-2 text-gray-400 hover:text-[#3DDC84] transition-colors"
                          title="Download"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(classification.id);
                          }}
                          className="p-2 text-gray-400 hover:text-red-400 transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Expanded Details */}
                    {selectedId === classification.id && (
                      <div className="mt-4 pt-4 border-t border-[#00C9A7]/20 space-y-2">
                        <div className="grid grid-cols-5 gap-2 text-xs">
                          <div>
                            <p className="text-gray-500">Water</p>
                            <p className="text-[#4A9EFF] font-mono">
                              {(classification.stats.waterPixels || 0).toLocaleString()}
                            </p>
                          </div>
                          <div>
                            <p className="text-gray-500">Seagrass</p>
                            <p className="text-[#3DDC84] font-mono">
                              {(classification.stats.seagrassPixels || 0).toLocaleString()}
                            </p>
                          </div>
                          <div>
                            <p className="text-gray-500">Sand</p>
                            <p className="text-[#E8C97A] font-mono">
                              {(classification.stats.sandPixels || 0).toLocaleString()}
                            </p>
                          </div>
                          <div>
                            <p className="text-gray-500">Cloud</p>
                            <p className="text-gray-400 font-mono">
                              {(classification.stats.cloudPixels || 0).toLocaleString()}
                            </p>
                          </div>
                          <div>
                            <p className="text-gray-500">Total</p>
                            <p className="text-[#00C9A7] font-mono">
                              {(classification.stats.totalCoastalPixels || 0).toLocaleString()}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
