export type ClassificationStatus =
  | 'Queued'
  | 'Downloading'
  | 'Processing'
  | 'Processed'
  | 'Failed'
  | 'Archived';

export type ClassificationRecord = {
  id: number;
  study_area_name: string;
  study_area_location?: string | null;
  study_area_bounds?: {
    left: number;
    bottom: number;
    right: number;
    top: number;
  } | null;
  crs?: string | null;
  uploaded_filename?: string | null;
  status?: ClassificationStatus | string | null;
  detection_type?: string | null;
  affected_area_size?: number | null;
  affected_area_unit?: string | null;
  confidence_score?: number | null;
  source?: string | null;
  classification_date?: string | null;
  classification_timestamp?: string | null;
  last_updated?: string | null;
  water_pixels?: number | null;
  seagrass_pixels?: number | null;
  sand_pixels?: number | null;
  cloud_pixels?: number | null;
  total_pixels?: number | null;
  pixel_area_sqm?: number | null;
  avg_confidence_percent?: number | null;
  classified_image_base64?: string | null;
  notes?: string | null;
  created_at?: string | null;
};

export type ClassificationFilters = {
  search: string;
  dateFrom: string;
  dateTo: string;
  status: string;
  detectionType: string;
  size: string;
  sortBy: string;
};

export type LocationGroup = {
  location: string;
  records: ClassificationRecord[];
  totalClassifications: number;
  latestDate: string | null;
};

export type SummaryMetrics = {
  totalClassifications: number;
  processingJobs: number;
  queuedJobs: number;
  archivedResults: number;
  totalLocationsMonitored: number;
};

export type UpdateClassificationPayload = {
  status?: string;
  notes?: string;
};
