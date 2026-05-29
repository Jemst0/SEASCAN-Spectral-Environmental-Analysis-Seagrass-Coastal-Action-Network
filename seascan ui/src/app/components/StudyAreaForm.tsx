import { useState } from 'react';
import { MapPin, AlertCircle } from 'lucide-react';

export type StudyAreaMetadata = {
  studyAreaName: string;
  location: string;
  latMin?: number;
  latMax?: number;
  lonMin?: number;
  lonMax?: number;
  notes?: string;
};

type StudyAreaFormProps = {
  onSubmit: (metadata: StudyAreaMetadata) => void;
  isLoading?: boolean;
};

export default function StudyAreaForm({ onSubmit, isLoading }: StudyAreaFormProps) {
  const [formData, setFormData] = useState<StudyAreaMetadata>({
    studyAreaName: '',
    location: '',
    notes: '',
  });

  const [errors, setErrors] = useState<string[]>([]);

  const handleInputChange = (field: keyof StudyAreaMetadata, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const validateForm = () => {
    const newErrors: string[] = [];
    if (!formData.studyAreaName.trim()) {
      newErrors.push('Study Area Name is required');
    }
    if (!formData.location.trim()) {
      newErrors.push('Location description is required');
    }
    // Optional: validate coordinate bounds if provided
    if (formData.latMin !== undefined || formData.latMax !== undefined) {
      if (formData.latMin === undefined || formData.latMax === undefined || formData.latMin >= formData.latMax) {
        newErrors.push('Valid latitude bounds required (min < max)');
      }
    }
    if (formData.lonMin !== undefined || formData.lonMax !== undefined) {
      if (formData.lonMin === undefined || formData.lonMax === undefined || formData.lonMin >= formData.lonMax) {
        newErrors.push('Valid longitude bounds required (min < max)');
      }
    }
    setErrors(newErrors);
    return newErrors.length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validateForm()) {
      onSubmit(formData);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="bg-[#010812] border border-[#00C9A7]/30 rounded-2xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <MapPin className="w-5 h-5 text-[#00C9A7]" />
          <h3 className="text-lg font-bold text-white" style={{ fontFamily: 'Syne, sans-serif' }}>
            Define Study Area
          </h3>
        </div>

        {errors.length > 0 && (
          <div className="mb-4 p-3 bg-red-500/20 border border-red-500/50 rounded-lg flex gap-2">
            <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
            <div className="text-red-300 text-sm space-y-1">
              {errors.map((err, i) => <div key={i}>{err}</div>)}
            </div>
          </div>
        )}

        <div className="space-y-4">
          {/* Study Area Name */}
          <div>
            <label className="block text-white text-sm font-medium mb-1">Study Area Name *</label>
            <input
              type="text"
              placeholder="e.g., Coastal Area - May 2026"
              value={formData.studyAreaName}
              onChange={(e) => handleInputChange('studyAreaName', e.target.value)}
              disabled={isLoading}
              className="w-full px-3 py-2 bg-[#020D1A] border border-[#00C9A7]/30 rounded-lg text-white placeholder-gray-500 focus:border-[#00C9A7] focus:outline-none disabled:opacity-50"
            />
          </div>

          {/* Location */}
          <div>
            <label className="block text-white text-sm font-medium mb-1">Location Description *</label>
            <input
              type="text"
              placeholder="e.g., Mediterranean Coast, Spain"
              value={formData.location}
              onChange={(e) => handleInputChange('location', e.target.value)}
              disabled={isLoading}
              className="w-full px-3 py-2 bg-[#020D1A] border border-[#00C9A7]/30 rounded-lg text-white placeholder-gray-500 focus:border-[#00C9A7] focus:outline-none disabled:opacity-50"
            />
          </div>

          {/* Coordinate Bounds (optional) */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-white text-sm font-medium mb-1">Lat Min</label>
              <input
                type="number"
                step="0.0001"
                placeholder="e.g., 38.5"
                value={formData.latMin || ''}
                onChange={(e) => handleInputChange('latMin', e.target.value ? parseFloat(e.target.value) : undefined)}
                disabled={isLoading}
                className="w-full px-3 py-2 bg-[#020D1A] border border-[#00C9A7]/30 rounded-lg text-white placeholder-gray-500 focus:border-[#00C9A7] focus:outline-none disabled:opacity-50"
              />
            </div>
            <div>
              <label className="block text-white text-sm font-medium mb-1">Lat Max</label>
              <input
                type="number"
                step="0.0001"
                placeholder="e.g., 39.5"
                value={formData.latMax || ''}
                onChange={(e) => handleInputChange('latMax', e.target.value ? parseFloat(e.target.value) : undefined)}
                disabled={isLoading}
                className="w-full px-3 py-2 bg-[#020D1A] border border-[#00C9A7]/30 rounded-lg text-white placeholder-gray-500 focus:border-[#00C9A7] focus:outline-none disabled:opacity-50"
              />
            </div>
            <div>
              <label className="block text-white text-sm font-medium mb-1">Lon Min</label>
              <input
                type="number"
                step="0.0001"
                placeholder="e.g., 2.0"
                value={formData.lonMin || ''}
                onChange={(e) => handleInputChange('lonMin', e.target.value ? parseFloat(e.target.value) : undefined)}
                disabled={isLoading}
                className="w-full px-3 py-2 bg-[#020D1A] border border-[#00C9A7]/30 rounded-lg text-white placeholder-gray-500 focus:border-[#00C9A7] focus:outline-none disabled:opacity-50"
              />
            </div>
            <div>
              <label className="block text-white text-sm font-medium mb-1">Lon Max</label>
              <input
                type="number"
                step="0.0001"
                placeholder="e.g., 3.0"
                value={formData.lonMax || ''}
                onChange={(e) => handleInputChange('lonMax', e.target.value ? parseFloat(e.target.value) : undefined)}
                disabled={isLoading}
                className="w-full px-3 py-2 bg-[#020D1A] border border-[#00C9A7]/30 rounded-lg text-white placeholder-gray-500 focus:border-[#00C9A7] focus:outline-none disabled:opacity-50"
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-white text-sm font-medium mb-1">Notes (optional)</label>
            <textarea
              placeholder="Any additional context about this study area..."
              value={formData.notes || ''}
              onChange={(e) => handleInputChange('notes', e.target.value)}
              disabled={isLoading}
              rows={3}
              className="w-full px-3 py-2 bg-[#020D1A] border border-[#00C9A7]/30 rounded-lg text-white placeholder-gray-500 focus:border-[#00C9A7] focus:outline-none disabled:opacity-50 resize-none"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full px-4 py-2 bg-[#00C9A7] text-[#020D1A] rounded-lg font-medium hover:bg-[#00C9A7]/90 disabled:opacity-50 transition-colors"
          >
            {isLoading ? 'Processing...' : 'Continue to Upload'}
          </button>
        </div>
      </div>
    </form>
  );
}
