import { useState } from 'react';
import { Shield, LogIn, AlertCircle } from 'lucide-react';
import { fetchWithRetry } from '../../utils/network';
import { setAccessToken, setStoredUser, type AuthUser } from '../../utils/auth';
import { buildApiUrl } from '../../utils/apiBase';

type LoginPageProps = {
  onAuthenticated: (user: AuthUser) => void;
};

export default function LoginPage({ onAuthenticated }: LoginPageProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const response = await fetchWithRetry(buildApiUrl('/auth/login'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      if (!response.ok) {
        throw new Error('Invalid username or password');
      }

      const data = await response.json();
      const token = data.access_token as string;
      const user = data.user as AuthUser;

      if (!token || !user) {
        throw new Error('Invalid login response');
      }

      setAccessToken(token);
      setStoredUser(user);
      onAuthenticated(user);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#020D1A] px-6">
      <div className="w-full max-w-md bg-[#010812] border border-[#00C9A7]/25 rounded-2xl p-8 shadow-xl">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-xl bg-[#00C9A7]/15 flex items-center justify-center">
            <Shield className="w-6 h-6 text-[#00C9A7]" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white" style={{ fontFamily: 'Syne, sans-serif' }}>
              SEASCAN Access
            </h2>
            <p className="text-sm text-[#00C9A7]/70" style={{ fontFamily: 'Space Mono, monospace' }}>
              Sign in to continue
            </p>
          </div>
        </div>

        {error && (
          <div className="mb-4 flex items-center gap-2 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">
            <AlertCircle className="w-4 h-4" />
            {error}
          </div>
        )}

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div>
            <label className="block text-xs uppercase tracking-wide text-[#00C9A7]/70 mb-2">Username</label>
            <input
              type="text"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              className="w-full rounded-lg border border-[#00C9A7]/30 bg-[#020D1A] px-3 py-2 text-white focus:border-[#00C9A7] focus:outline-none"
              required
            />
          </div>
          <div>
            <label className="block text-xs uppercase tracking-wide text-[#00C9A7]/70 mb-2">Password</label>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full rounded-lg border border-[#00C9A7]/30 bg-[#020D1A] px-3 py-2 text-white focus:border-[#00C9A7] focus:outline-none"
              required
            />
          </div>
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-lg bg-[#00C9A7] px-4 py-2 text-[#020D1A] font-semibold hover:bg-[#00C9A7]/90 transition-colors flex items-center justify-center gap-2"
          >
            <LogIn className="w-4 h-4" />
            {isSubmitting ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
}
