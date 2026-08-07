import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { authApi } from '../services/api';
import { Zap, Download, Smartphone } from 'lucide-react';
import { useInstallPrompt } from '../hooks/useInstallPrompt';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const { canInstall, isIos, install } = useInstallPrompt();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setError('Email and password are required');
      return;
    }
    setLoading(true);
    setError('');

    try {
      const data: any = await authApi.login(email, password);
      localStorage.setItem('token', data.data.token);
      if (data.data.user) localStorage.setItem('user', JSON.stringify(data.data.user));
      toast.success('Signed in successfully');
      window.location.href = '/today';
    } catch (err: any) {
      const msg = err.response?.data?.error?.message || 'Login failed';
      setError(msg);
      toast.error('Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#f5f5f5] px-4 animate-in pb-safe">
      <div className="max-w-md w-full card-blueprint p-8 space-y-8">
        <div className="text-center">
          <div className="w-16 h-16 bg-[#0a0a0a] rounded-3xl flex items-center justify-center mx-auto mb-4">
            <Zap className="w-8 h-8 text-white fill-white" />
          </div>
          <h1 className="text-2xl font-bold text-[#0a0a0a] tracking-tight">NepalCan Ops</h1>
          <p className="text-[#737373] mt-2 text-sm">Sign in to access your tasks</p>
        </div>
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[#0a0a0a] mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              className="input-blueprint w-full"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#0a0a0a] mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Your password"
              className="input-blueprint w-full"
              required
            />
          </div>
          {error && <p className="text-[#dc3545] text-xs">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full cursor-pointer disabled:opacity-50"
          >
            {loading ? 'Connecting...' : 'Sign In'}
          </button>
        </form>

        {(canInstall || isIos) && (
          <div className="pt-2">
            <button
              onClick={() => { install(); if (!canInstall) {} }}
              className="btn-outline w-full cursor-pointer"
            >
              <Download className="w-4 h-4" />
              {canInstall ? 'Install App' : 'Install app from your browser menu'}
            </button>
            {isIos && !canInstall && (
              <p className="flex items-center justify-center gap-1.5 text-[11px] text-[#737373] mt-2">
                <Smartphone className="w-3.5 h-3.5" />
                Share → Add to Home Screen
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}