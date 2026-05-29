import type { ClassificationRecord, UpdateClassificationPayload } from './types';
import { fetchWithRetry } from '../../utils/network';
import { buildApiUrl } from '../../utils/apiBase';

export type TrendDataPoint = {
  date: string;
  classification_date?: string;
  location: string;
  water_pixels: number;
  seagrass_pixels: number;
  sand_pixels: number;
  cloud_pixels: number;
  total_pixels: number;
};

export type LocationTrendData = {
  location: string;
  dataPoints: TrendDataPoint[];
  statistics: {
    water: { min: number; max: number; avg: number };
    seagrass: { min: number; max: number; avg: number };
    sand: { min: number; max: number; avg: number };
    cloud: { min: number; max: number; avg: number };
  };
};

/**
 * Fetch all classification records from the backend.
 */
export async function fetchAllClassifications(): Promise<ClassificationRecord[]> {
  const response = await fetchWithRetry(buildApiUrl('/classifications'));
  if (!response.ok) {
    throw new Error('Failed to fetch classifications');
  }

  const data = await response.json();
  return (data.classifications || []) as ClassificationRecord[];
}

/**
 * Delete a classification record by ID.
 */
export async function deleteClassification(classificationId: number): Promise<void> {
  const response = await fetchWithRetry(buildApiUrl(`/classification/${classificationId}`), {
    method: 'DELETE',
  });

  if (!response.ok) {
    throw new Error('Failed to delete classification');
  }
}

/**
 * Update classification status or notes.
 */
export async function updateClassification(
  classificationId: number,
  payload: UpdateClassificationPayload,
): Promise<void> {
  const response = await fetchWithRetry(buildApiUrl(`/classification/${classificationId}`), {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error('Failed to update classification');
  }
}

/**
 * Return distinct locations for trend analysis.
 */
export async function getUniqueTrendLocations(
  classifications: ClassificationRecord[],
): Promise<string[]> {
  const locations = new Set<string>();
  classifications.forEach((record) => {
    const location = record.study_area_location || record.study_area_name;
    if (location) {
      locations.add(location);
    }
  });
  return Array.from(locations).sort();
}

/**
 * Build trend data and summary stats for a location.
 */
export async function getTrendDataForLocation(
  classifications: ClassificationRecord[],
  location: string,
): Promise<LocationTrendData> {
  // Filter records for this location
  const filtered = classifications.filter(
    (record) => (record.study_area_location || record.study_area_name) === location,
  );

  // Sort by classification_date
  const sorted = [...filtered].sort((a, b) => {
    const dateA = new Date(a.classification_date || a.created_at || '').getTime();
    const dateB = new Date(b.classification_date || b.created_at || '').getTime();
    return dateA - dateB;
  });

  // Convert to trend data points
  const dataPoints: TrendDataPoint[] = sorted.map((record) => ({
    date: new Date(record.classification_date || record.created_at || '').toLocaleDateString(),
    classification_date: record.classification_date,
    location,
    water_pixels: record.water_pixels || 0,
    seagrass_pixels: record.seagrass_pixels || 0,
    sand_pixels: record.sand_pixels || 0,
    cloud_pixels: record.cloud_pixels || 0,
    total_pixels: record.total_pixels || 0,
  }));

  // Calculate statistics
  const calculateStats = (values: number[]) => {
    if (values.length === 0) return { min: 0, max: 0, avg: 0 };
    const min = Math.min(...values);
    const max = Math.max(...values);
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    return { min, max, avg };
  };

  const statistics = {
    water: calculateStats(dataPoints.map((d) => d.water_pixels)),
    seagrass: calculateStats(dataPoints.map((d) => d.seagrass_pixels)),
    sand: calculateStats(dataPoints.map((d) => d.sand_pixels)),
    cloud: calculateStats(dataPoints.map((d) => d.cloud_pixels)),
  };

  return {
    location,
    dataPoints,
    statistics,
  };
}
