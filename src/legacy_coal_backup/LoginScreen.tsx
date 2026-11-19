import React, { useState } from 'react';
import { Flame, Lock } from 'lucide-react';

interface LoginScreenProps {
  onLogin: (token: string) => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const res = await fetch('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await res.json();
      if (data.success) {
        onLogin(data.token);
      } else {
        setError(data.error || 'Invalid credentials');
      }
    } catch (err) {
      setError('Connection error. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center p-4">
      <div className="w-full max-w-sm rounded-2xl border border-neutral-800 bg-[#151515] p-8 shadow-2xl">
        <div className="mb-8 flex flex-col items-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[#1A1A1A] text-[#D32F2F] shadow-inner">
            <Lock className="h-8 w-8" />
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-white">Staff Login</h2>
          <p className="mt-2 text-sm text-neutral-400 text-center">
            Enter your credentials to access the Coal Restaurant Staff Dashboard.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="rounded-lg bg-red-950/50 p-3 text-center text-sm font-medium text-red-400 border border-red-900/50">
              {error}
            </div>
          )}
          
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-neutral-400">
              Username
            </label>
            <input
              type="text"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full rounded-xl border border-neutral-800 bg-[#1A1A1A] px-4 py-3 text-white placeholder-neutral-600 focus:border-[#D32F2F] focus:outline-none focus:ring-1 focus:ring-[#D32F2F]"
              placeholder="e.g. coal"
            />
          </div>
          
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-neutral-400">
              Password
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl border border-neutral-800 bg-[#1A1A1A] px-4 py-3 text-white placeholder-neutral-600 focus:border-[#D32F2F] focus:outline-none focus:ring-1 focus:ring-[#D32F2F]"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="mt-6 w-full flex items-center justify-center gap-2 rounded-xl bg-[#D32F2F] px-4 py-3 font-bold text-white transition hover:bg-[#B71C1C] disabled:opacity-50"
          >
            {isLoading ? 'Authenticating...' : 'Secure Login'}
          </button>
        </form>
      </div>
    </div>
  );
};
