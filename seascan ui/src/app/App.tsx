import { useEffect, useState } from 'react';
import { Satellite, Map, BarChart3, Settings, Activity, Database } from 'lucide-react';
import DashboardPage from './components/pages/DashboardPage';
import MapPage from './components/pages/MapPage';
import AnalyticsPage from './components/pages/AnalyticsPage';
import DataPage from './components/pages/DataPage';
import SettingsPage from './components/pages/SettingsPage';
import type { ClassificationRecord } from './components/data-management/types';
import LoginPage from './components/pages/LoginPage';
import {
  clearAccessToken,
  clearStoredUser,
  getAccessToken,
  getStoredUser,
  onAuthChange,
  setStoredUser,
  type AuthUser,
} from './utils/auth';
import { fetchWithRetry } from './utils/network';
import { buildApiUrl } from './utils/apiBase';

type PredictionStats = {
  totalCoastalPixels?: number;
  waterPixels?: number;
  seagrassPixels?: number;
  sandPixels?: number;
  cloudPixels?: number;
  water?: string;
  seagrass?: string;
  sand?: string;
};

export default function App() {
  const [authUser, setAuthUser] = useState<AuthUser | null>(getStoredUser());
  const [isAuthChecked, setIsAuthChecked] = useState(false);
  const [activeSection, setActiveSection] = useState('dashboard');
  const [predictionImage, setPredictionImage] = useState<string | undefined>();
  const [predictionStats, setPredictionStats] = useState<PredictionStats | undefined>();
  const [studyAreaName, setStudyAreaName] = useState<string>('Study Area');
  const [studyAreaLocation, setStudyAreaLocation] = useState<string>('Location not specified');
  const [trendSelection, setTrendSelection] = useState<ClassificationRecord[] | undefined>(undefined);

  const handleLogout = () => {
    clearAccessToken();
    clearStoredUser();
    setAuthUser(null);
  };

  const handlePredictionComplete = (data: any) => {
    if (data?.image_base64) {
      setPredictionImage(`data:image/png;base64,${data.image_base64}`);
    }
    if (data?.stats) {
      setPredictionStats(data.stats);
    }
    // Extract location from metadata if available
    if (data?.metadata?.description) {
      setStudyAreaLocation(data.metadata.description);
    }
  };

  useEffect(() => {
    const verifyAuth = async () => {
      const token = getAccessToken();
      if (!token) {
        setIsAuthChecked(true);
        return;
      }

      try {
        const response = await fetchWithRetry(buildApiUrl('/auth/me'));
        if (!response.ok) {
          throw new Error('Unauthorized');
        }
        const data = await response.json();
        if (data?.user) {
          setStoredUser(data.user);
          setAuthUser(data.user as AuthUser);
        } else {
          clearAccessToken();
          clearStoredUser();
          setAuthUser(null);
        }
      } catch {
        clearAccessToken();
        clearStoredUser();
        setAuthUser(null);
      } finally {
        setIsAuthChecked(true);
      }
    };

    verifyAuth();
  }, []);

  useEffect(() => {
    return onAuthChange(() => {
      const token = getAccessToken();
      if (!token) {
        setAuthUser(null);
        return;
      }
      const stored = getStoredUser();
      if (stored) {
        setAuthUser(stored);
      }
    });
  }, []);

  if (!isAuthChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#020D1A]">
        <span className="text-[#00C9A7] text-sm" style={{ fontFamily: 'Space Mono, monospace' }}>
          Checking access...
        </span>
      </div>
    );
  }

  if (!authUser) {
    return <LoginPage onAuthenticated={setAuthUser} />;
  }

  return (
    <div className="h-screen flex bg-[#020D1A] overflow-hidden" style={{ fontFamily: 'DM Sans, sans-serif' }}>
      {/* Fixed Sidebar - 72px */}
      <div className="w-[72px] bg-[#010812] border-r border-[#00C9A7]/20 flex flex-col items-center py-6 gap-6">
        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#00C9A7] to-[#3DDC84] flex items-center justify-center mb-4">
          <Satellite className="w-6 h-6 text-[#020D1A]" />
        </div>

        <button
          onClick={() => setActiveSection('dashboard')}
          className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors ${
            activeSection === 'dashboard' ? 'bg-[#00C9A7]/20 text-[#00C9A7]' : 'text-gray-500 hover:text-[#00C9A7]'
          }`}
        >
          <Activity className="w-5 h-5" />
        </button>

        <button
          onClick={() => setActiveSection('map')}
          className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors ${
            activeSection === 'map' ? 'bg-[#00C9A7]/20 text-[#00C9A7]' : 'text-gray-500 hover:text-[#00C9A7]'
          }`}
        >
          <Map className="w-5 h-5" />
        </button>

        <button
          onClick={() => {
            setTrendSelection(undefined);
            setActiveSection('analytics');
          }}
          className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors ${
            activeSection === 'analytics' ? 'bg-[#00C9A7]/20 text-[#00C9A7]' : 'text-gray-500 hover:text-[#00C9A7]'
          }`}
        >
          <BarChart3 className="w-5 h-5" />
        </button>

        <button
          onClick={() => setActiveSection('data')}
          className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors ${
            activeSection === 'data' ? 'bg-[#00C9A7]/20 text-[#00C9A7]' : 'text-gray-500 hover:text-[#00C9A7]'
          }`}
        >
          <Database className="w-5 h-5" />
        </button>

        <div className="flex-1" />

        <button
          onClick={() => setActiveSection('settings')}
          className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors ${
            activeSection === 'settings' ? 'bg-[#00C9A7]/20 text-[#00C9A7]' : 'text-gray-500 hover:text-[#00C9A7]'
          }`}
        >
          <Settings className="w-5 h-5" />
        </button>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Navigation Bar */}
        <div className="h-16 bg-[#010812] border-b border-[#00C9A7]/20 flex items-center px-8">
          <h1 className="text-2xl font-bold text-white" style={{ fontFamily: 'Syne, sans-serif' }}>
            SEASCAN
          </h1>
          <span className="ml-3 text-[#00C9A7] text-sm" style={{ fontFamily: 'Space Mono, monospace' }}>
            v2.1.3
          </span>
          <div className="flex-1" />
          <div className="flex items-center gap-4">
            <div className="px-3 py-1.5 rounded-lg bg-[#3DDC84]/20 border border-[#3DDC84]/30">
              <span className="text-[#3DDC84] text-sm" style={{ fontFamily: 'Space Mono, monospace' }}>
                SENTINEL-2 L2A
              </span>
            </div>
            <button
              onClick={handleLogout}
              className="px-3 py-1.5 rounded-lg border border-[#00C9A7]/30 text-[#00C9A7] text-sm hover:bg-[#00C9A7]/10 transition-colors"
              style={{ fontFamily: 'Space Mono, monospace' }}
            >
              Logout ({authUser.username})
            </button>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto px-8 py-6">
          <div className="max-w-[1800px] mx-auto">
            {activeSection === 'dashboard' && (
              <DashboardPage
                predictionImage={predictionImage}
                predictionStats={predictionStats}
                studyAreaName={studyAreaName}
                studyAreaLocation={studyAreaLocation}
                onPredictionComplete={handlePredictionComplete}
              />
            )}
            {activeSection === 'map' && <MapPage mapSrc={predictionImage} predictionStats={predictionStats} />}
            {activeSection === 'analytics' && <AnalyticsPage preselectedClassifications={trendSelection} />}
            {activeSection === 'data' && (
              <DataPage
                canManage={authUser.role === 'admin'}
                onTrendAnalysis={(records) => {
                  setTrendSelection(records);
                  setActiveSection('analytics');
                }}
              />
            )}
            {activeSection === 'settings' && (
              <SettingsPage user={authUser} onLogout={handleLogout} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
