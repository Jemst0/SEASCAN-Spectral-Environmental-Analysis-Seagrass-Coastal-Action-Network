import { useState } from 'react';
import { Shield, Users, SlidersHorizontal, LogOut, RefreshCw } from 'lucide-react';
import type { AuthUser } from '../../utils/auth';
import { fetchWithRetry } from '../../utils/network';
import {
  buildApiUrl,
  clearApiBase,
  getApiBase,
  getDefaultApiBase,
  setApiBase,
} from '../../utils/apiBase';

type SettingsPageProps = {
  user: AuthUser;
  onLogout: () => void;
};

type NewUserForm = {
  username: string;
  password: string;
  role: 'admin' | 'user';
};

export default function SettingsPage({ user, onLogout }: SettingsPageProps) {
  const [apiBase, setApiBaseInput] = useState(getApiBase());
  const [apiStatus, setApiStatus] = useState<string | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);

  const [newUser, setNewUser] = useState<NewUserForm>({
    username: '',
    password: '',
    role: 'user',
  });
  const [createStatus, setCreateStatus] = useState<string | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const defaultApiBase = getDefaultApiBase();

  const handleSaveApiBase = () => {
    setApiStatus(null);
    setApiError(null);

    const nextValue = apiBase.trim();
    if (!nextValue) {
      setApiError('API base URL is required.');
      return;
    }
    if (!/^https?:\/\//i.test(nextValue)) {
      setApiError('Use a full URL like http://localhost:8000.');
      return;
    }

    setApiBase(nextValue);
    setApiStatus('Saved. Reload the app to apply everywhere.');
  };

  const handleResetApiBase = () => {
    clearApiBase();
    setApiBaseInput(getApiBase());
    setApiStatus('Reset to default API base.');
    setApiError(null);
  };

  const handleCreateUser = async (event: React.FormEvent) => {
    event.preventDefault();
    setCreateStatus(null);
    setCreateError(null);

    const payload = {
      username: newUser.username.trim(),
      password: newUser.password,
      role: newUser.role,
    };

    if (!payload.username || !payload.password) {
      setCreateError('Username and password are required.');
      return;
    }

    try {
      setIsCreating(true);
      const response = await fetchWithRetry(buildApiUrl('/auth/users'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorBody = await response.json().catch(() => null);
        throw new Error(errorBody?.detail || 'Failed to create user.');
      }

      setCreateStatus('User created successfully.');
      setNewUser({ username: '', password: '', role: 'user' });
    } catch (error) {
      setCreateError(error instanceof Error ? error.message : 'Failed to create user.');
    } finally {
      setIsCreating(false);
    }
  };

  const roleBadgeClass =
    user.role === 'admin'
      ? 'border-[#E8C97A]/40 text-[#E8C97A] bg-[#E8C97A]/10'
      : 'border-[#4A9EFF]/40 text-[#4A9EFF] bg-[#4A9EFF]/10';

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white mb-2" style={{ fontFamily: 'Syne, sans-serif' }}>
          Settings
        </h2>
        <p className="text-[#00C9A7]/70 text-sm" style={{ fontFamily: 'Space Mono, monospace' }}>
          Manage account access, connection details, and admin tools.
        </p>
      </div>

      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-5 bg-[#010812] border border-[#00C9A7]/30 rounded-2xl p-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[#00C9A7]/10 flex items-center justify-center">
              <Shield className="w-5 h-5 text-[#00C9A7]" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white" style={{ fontFamily: 'Syne, sans-serif' }}>
                Account
              </h3>
              <p className="text-xs text-gray-400">Signed-in profile</p>
            </div>
          </div>

          <div className="mt-5 space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-gray-400">Username</span>
              <span className="text-white font-medium">{user.username}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-400">Role</span>
              <span className={`px-2 py-1 rounded-full border text-xs uppercase tracking-wide ${roleBadgeClass}`}>
                {user.role}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-400">Data scope</span>
              <span className="text-white">Per-user database</span>
            </div>
          </div>
        </div>

        <div className="col-span-7 bg-[#010812] border border-[#00C9A7]/30 rounded-2xl p-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[#00C9A7]/10 flex items-center justify-center">
              <SlidersHorizontal className="w-5 h-5 text-[#00C9A7]" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white" style={{ fontFamily: 'Syne, sans-serif' }}>
                API Connection
              </h3>
              <p className="text-xs text-gray-400">Override the backend base URL</p>
            </div>
          </div>

          <div className="mt-5 space-y-3">
            <label className="block text-xs uppercase tracking-wide text-[#00C9A7]/70">Base URL</label>
            <input
              value={apiBase}
              onChange={(event) => {
                setApiBaseInput(event.target.value);
                setApiStatus(null);
                setApiError(null);
              }}
              className="w-full rounded-lg border border-[#00C9A7]/30 bg-[#020D1A] px-3 py-2 text-white focus:border-[#00C9A7] focus:outline-none"
              placeholder="http://localhost:8000"
            />
            <p className="text-xs text-gray-500">Default: {defaultApiBase}</p>

            {apiError && <p className="text-xs text-red-400">{apiError}</p>}
            {apiStatus && <p className="text-xs text-[#3DDC84]">{apiStatus}</p>}

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={handleSaveApiBase}
                className="px-4 py-2 rounded-lg bg-[#00C9A7] text-[#020D1A] text-sm font-semibold hover:bg-[#00C9A7]/90 transition-colors"
              >
                Save URL
              </button>
              <button
                type="button"
                onClick={handleResetApiBase}
                className="px-4 py-2 rounded-lg border border-[#00C9A7]/30 text-[#00C9A7] text-sm hover:bg-[#00C9A7]/10 transition-colors flex items-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                Reset
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-5 bg-[#010812] border border-[#00C9A7]/30 rounded-2xl p-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[#00C9A7]/10 flex items-center justify-center">
              <LogOut className="w-5 h-5 text-[#00C9A7]" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white" style={{ fontFamily: 'Syne, sans-serif' }}>
                Session
              </h3>
              <p className="text-xs text-gray-400">Sign out of SEASCAN</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onLogout}
            className="mt-5 px-4 py-2 rounded-lg border border-[#00C9A7]/30 text-[#00C9A7] text-sm hover:bg-[#00C9A7]/10 transition-colors"
          >
            Logout
          </button>
        </div>

        <div className="col-span-7 bg-[#010812] border border-[#00C9A7]/30 rounded-2xl p-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[#00C9A7]/10 flex items-center justify-center">
              <Users className="w-5 h-5 text-[#00C9A7]" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white" style={{ fontFamily: 'Syne, sans-serif' }}>
                Admin Tools
              </h3>
              <p className="text-xs text-gray-400">Create and manage user accounts</p>
            </div>
          </div>

          {user.role !== 'admin' ? (
            <p className="mt-5 text-sm text-gray-400">
              Admin access required to add users.
            </p>
          ) : (
            <form className="mt-5 space-y-4" onSubmit={handleCreateUser}>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs uppercase tracking-wide text-[#00C9A7]/70 mb-2">Username</label>
                  <input
                    value={newUser.username}
                    onChange={(event) =>
                      setNewUser((prev) => ({
                        ...prev,
                        username: event.target.value,
                      }))
                    }
                    className="w-full rounded-lg border border-[#00C9A7]/30 bg-[#020D1A] px-3 py-2 text-white focus:border-[#00C9A7] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs uppercase tracking-wide text-[#00C9A7]/70 mb-2">Role</label>
                  <select
                    value={newUser.role}
                    onChange={(event) =>
                      setNewUser((prev) => ({
                        ...prev,
                        role: event.target.value as 'admin' | 'user',
                      }))
                    }
                    className="w-full rounded-lg border border-[#00C9A7]/30 bg-[#020D1A] px-3 py-2 text-white focus:border-[#00C9A7] focus:outline-none"
                  >
                    <option value="user">User</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs uppercase tracking-wide text-[#00C9A7]/70 mb-2">Password</label>
                <input
                  type="password"
                  value={newUser.password}
                  onChange={(event) =>
                    setNewUser((prev) => ({
                      ...prev,
                      password: event.target.value,
                    }))
                  }
                  className="w-full rounded-lg border border-[#00C9A7]/30 bg-[#020D1A] px-3 py-2 text-white focus:border-[#00C9A7] focus:outline-none"
                />
              </div>

              {createError && <p className="text-xs text-red-400">{createError}</p>}
              {createStatus && <p className="text-xs text-[#3DDC84]">{createStatus}</p>}

              <button
                type="submit"
                disabled={isCreating}
                className="px-4 py-2 rounded-lg bg-[#00C9A7] text-[#020D1A] text-sm font-semibold hover:bg-[#00C9A7]/90 transition-colors disabled:opacity-60"
              >
                {isCreating ? 'Creating...' : 'Create User'}
              </button>
              <p className="text-xs text-gray-500">
                New users get their own data database the first time they sign in.
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
