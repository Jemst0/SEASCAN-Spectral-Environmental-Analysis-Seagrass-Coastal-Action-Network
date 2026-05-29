'use client';

import { useState, useEffect } from 'react';
import LocationSelector from '../data-management/LocationSelector';
import TrendAnalysisChart from '../data-management/TrendAnalysisChart';
import {
  fetchAllClassifications,
  getUniqueTrendLocations,
  getTrendDataForLocation,
} from '../data-management/api';
import type { ClassificationRecord } from '../data-management/types';
import type { LocationTrendData } from '../data-management/api';
import { BarChart3, PieChart, Activity } from 'lucide-react';
import { fetchWithRetry } from '../../utils/network';
import { buildApiUrl } from '../../utils/apiBase';

type TrendMetric = 'all' | 'water' | 'seagrass' | 'sand' | 'cloud' | 'total';

type AnalyticsPageProps = {
  preselectedClassifications?: ClassificationRecord[];
};

export default function AnalyticsPage({ preselectedClassifications }: AnalyticsPageProps) {
  const [classifications, setClassifications] = useState<ClassificationRecord[]>([]);
  const [locations, setLocations] = useState<string[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<string | null>(null);
  const [trendData, setTrendData] = useState<LocationTrendData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [trendMetric, setTrendMetric] = useState<TrendMetric>('all');

  // Load classifications on mount
  useEffect(() => {
    const loadClassifications = async () => {
      try {
        setIsLoading(true);
        const data = preselectedClassifications && preselectedClassifications.length > 0
          ? preselectedClassifications
          : await fetchAllClassifications();
        setClassifications(data);

        // Get unique locations
        const uniqueLocations = await getUniqueTrendLocations(data);
        setLocations(uniqueLocations);

        // Auto-select first location if available
        if (uniqueLocations.length > 0) {
          setSelectedLocation(uniqueLocations[0]);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load classifications');
        console.error('Error loading classifications:', err);
      } finally {
        setIsLoading(false);
      }
    };

    loadClassifications();
  }, [preselectedClassifications]);

  // Load trend data when location changes
  useEffect(() => {
    const loadTrendData = async () => {
      if (!selectedLocation || classifications.length === 0) {
        setTrendData(null);
        return;
      }

      try {
        const data = await getTrendDataForLocation(classifications, selectedLocation);
        setTrendData(data);
      } catch (err) {
        console.error('Error loading trend data:', err);
        setTrendData(null);
      }
    };

    loadTrendData();
  }, [selectedLocation, classifications]);

  const handleExportPDF = async () => {
    try {
      if (!selectedLocation) {
        setError('Select a location before exporting');
        return;
      }

      const recordsToExport = classifications.filter(
        (r) => (r.study_area_location || r.study_area_name) === selectedLocation,
      );
      const ids = recordsToExport.map((r) => r.id).filter((id) => Number.isFinite(id));

      if (ids.length === 0) {
        setError('No classifications available for export');
        return;
      }

      const metric = trendMetric === 'all' ? 'total' : trendMetric;
      const response = await fetchWithRetry(buildApiUrl('/export-analytics-pdf'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids, metric }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || 'Failed to export PDF');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `seascan_trend_report_${selectedLocation.replace(/\s+/g, '_')}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  // Calculate summary metrics from classifications
  const calculateMetrics = () => {
    if (classifications.length === 0) {
      return [
        { label: 'Total Classifications', value: '0', unit: '', change: '—', color: '#00C9A7', Icon: BarChart3 },
        { label: 'Locations Monitored', value: '0', unit: '', change: '—', color: '#3DDC84', Icon: PieChart },
        { label: 'Successfully Processed', value: '0', unit: '/0', change: '—', color: '#E8C97A', Icon: Activity },
      ];
    }

    const totalClassifications = classifications.length;
    const uniqueLocations = locations.length;
    const processedCount = classifications.filter((c) => c.status === 'Processed').length;

    return [
      {
        label: 'Total Classifications',
        value: totalClassifications.toString(),
        unit: '',
        change: '+100%',
        color: '#00C9A7',
        Icon: BarChart3,
      },
      {
        label: 'Locations Monitored',
        value: uniqueLocations.toString(),
        unit: '',
        change: uniqueLocations > 1 ? '+25%' : 'First',
        color: '#3DDC84',
        Icon: PieChart,
      },
      {
        label: 'Successfully Processed',
        value: processedCount.toString(),
        unit: `/${totalClassifications}`,
        change: processedCount === totalClassifications ? '100%' : `${Math.round((processedCount / totalClassifications) * 100)}%`,
        color: '#E8C97A',
        Icon: Activity,
      },
    ];
  };

  const metrics = calculateMetrics();

  return (
    <div className="space-y-6">
      <div className="mb-4">
        <h2 className="text-2xl font-bold text-white mb-1" style={{ fontFamily: 'Syne, sans-serif' }}>
          Analytics & Trend Analysis
        </h2>
        <div className="flex items-center gap-3">
          <p className="text-[#00C9A7]/70 text-sm" style={{ fontFamily: 'Space Mono, monospace' }}>
          {isLoading
            ? 'Loading classifications...'
            : preselectedClassifications && preselectedClassifications.length > 0
              ? `Comparing ${classifications.length} selected classifications across ${locations.length} locations`
              : `Analyzing ${classifications.length} classifications across ${locations.length} locations`}
          </p>
          <button
            onClick={() => handleExportPDF()}
            className="ml-auto inline-flex items-center gap-2 rounded-lg border border-[#00C9A7]/20 bg-[#00C9A7]/10 px-3 py-2 text-sm text-[#00C9A7] transition-colors hover:bg-[#00C9A7]/20"
          >
            Export PDF
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-900/20 border border-red-500/30 rounded-xl">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      {/* Key Metrics Grid */}
      <div className="grid grid-cols-3 gap-6">
        {metrics.map((metric, index) => (
          <div
            key={index}
            className="p-6 bg-[#010812] border border-[#00C9A7]/30 rounded-2xl"
          >
            <div className="flex items-center justify-between mb-3">
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: `${metric.color}20` }}
              >
                <metric.Icon className="w-5 h-5" style={{ color: metric.color }} />
              </div>
              <div
                className="px-2 py-1 rounded text-xs font-medium"
                style={{
                  backgroundColor: metric.change.includes('+') || metric.change.includes('✓') ? '#3DDC8420' : '#ff4a4a20',
                  color: metric.change.includes('+') || metric.change.includes('✓') ? '#3DDC84' : '#ff4a4a',
                }}
              >
                {metric.change}
              </div>
            </div>
            <p className="text-gray-400 text-xs mb-2">{metric.label}</p>
            <div className="flex items-baseline gap-2">
              <span
                className="text-3xl font-bold"
                style={{ fontFamily: 'Space Mono, monospace', color: metric.color }}
              >
                {metric.value}
              </span>
              <span className="text-gray-500 text-sm" style={{ fontFamily: 'Space Mono, monospace' }}>
                {metric.unit}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Location Selector and Trend Analysis */}
      {classifications.length > 0 && (
        <>
          <div className="bg-[#010812] border border-[#00C9A7]/30 rounded-2xl p-6">
            <h3 className="text-lg font-bold text-white mb-4" style={{ fontFamily: 'Syne, sans-serif' }}>
              Select Location for Trend Analysis
            </h3>
            <LocationSelector
              locations={locations}
              selectedLocation={selectedLocation}
              onSelect={setSelectedLocation}
              isLoading={isLoading}
            />
          </div>

          {/* Trend Analysis Chart */}
          <TrendAnalysisChart
            trendData={trendData}
            isLoading={isLoading}
            metric={trendMetric}
            onMetricChange={setTrendMetric}
          />
        </>
      )}

      {/* Empty State */}
      {!isLoading && classifications.length === 0 && (
        <div className="bg-[#010812] border border-[#00C9A7]/30 rounded-2xl p-12">
          <div className="text-center">
            <BarChart3 className="w-12 h-12 text-[#00C9A7]/30 mx-auto mb-3" />
            <p className="text-gray-400 mb-2">No classifications available</p>
            <p className="text-gray-500 text-sm">
              Upload and classify coastal imagery to see trend analysis here.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
