import { ChevronDown, MapPin } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';

interface LocationSelectorProps {
  locations: string[];
  selectedLocation: string | null;
  onSelect: (location: string) => void;
  isLoading?: boolean;
}

export default function LocationSelector({
  locations,
  selectedLocation,
  onSelect,
  isLoading = false,
}: LocationSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative w-full" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={isLoading || locations.length === 0}
        className="w-full px-4 py-3 bg-[#010812] border border-[#00C9A7]/30 rounded-xl text-white flex items-center justify-between hover:border-[#00C9A7]/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <div className="flex items-center gap-2">
          <MapPin className="w-4 h-4 text-[#00C9A7]" />
          <span className="text-sm">
            {isLoading ? 'Loading locations...' : selectedLocation || 'Select a location'}
          </span>
        </div>
        <ChevronDown
          className={`w-4 h-4 text-[#00C9A7] transition-transform ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {isOpen && locations.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-[#010812] border border-[#00C9A7]/30 rounded-xl shadow-lg z-50 max-h-64 overflow-y-auto">
          {locations.map((location) => (
            <button
              key={location}
              onClick={() => {
                onSelect(location);
                setIsOpen(false);
              }}
              className={`w-full text-left px-4 py-3 border-b border-[#00C9A7]/10 last:border-b-0 transition-colors ${
                selectedLocation === location
                  ? 'bg-[#00C9A7]/20 text-[#00C9A7]'
                  : 'text-gray-300 hover:bg-[#020D1A] hover:text-white'
              }`}
            >
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4" />
                <span className="text-sm">{location}</span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
