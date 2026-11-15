import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { KeyRound, Mail } from 'lucide-react';
import { usePageMeta } from '../components/Layout';
import { useAuth } from '../context/AuthContext';

export function LoginPage() {
  usePageMeta('Sign In — EgoRank', 'Sign in to manage your EgoRank competitor profile, featured placements, and referrals.');
  const { loginWithGoogle, loginWithEmail, sendResetEmail } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<'login' | 'forgot'>('login');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const handleGoogle = async () => {
    setError(null);
    setLoading(true);
    try {
      await loginWithGoogle();
      navigate('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Google Sign-In failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setLoading(true);
    try {
      if (mode === 'forgot') {
        await sendResetEmail(email.trim());
        setInfo('Password reset link sent. Check your inbox to choose a new password.');
      } else {
        await loginWithEmail(email.trim(), password);
        navigate('/dashboard');
      }
    } catch (err: any) {
      if (err?.code === 'auth/operation-not-allowed') {
        setError(
          'Email/Password sign-in is not enabled in the Firebase console for this project yet. Use Google Sign-In below or enable Email/Password in Firebase Authentication.'
        );
      } else {
        setError(err instanceof Error ? err.message : 'Authentication failed.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-[460px] mx-auto px-6 py-16">
      <div className="luxury-card rounded-2xl p-8 space-y-6">
        <div className="space-y-2 text-center">
          <p className="text-xs tracking-[0.2em] text-[#D4AF37] uppercase">
            Competitor Access
          </p>
          <h1 className="font-display text-2xl font-bold text-white">
            {mode === 'login' ? 'Sign In to EgoRank' : 'Reset Your Password'}
          </h1>
        </div>

        <button
          type="button"
          onClick={handleGoogle}
          disabled={loading}
          className="w-full py-3 px-4 rounded-lg gold-gradient-bg text-[#080808] text-xs font-semibold tracking-wider uppercase hover:brightness-110 transition cursor-pointer disabled:opacity-60"
        >
          Continue with Google
        </button>

        <div className="relative flex items-center justify-center">
          <div className="border-t border-white/10 w-full" />
          <span className="px-3 text-[11px] uppercase tracking-widest text-[#666666] bg-[#151515]">
            or
          </span>
          <div className="border-t border-white/10 w-full" />
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs text-[#999999] flex items-center gap-1.5">
              <Mail className="w-3.5 h-3.5 text-[#D4AF37]" />
              Email Address
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@domain.com"
              className="w-full px-3.5 py-2.5 rounded-lg bg-[#0c0c0c] border border-white/12 text-sm text-white focus:outline-none focus:border-[#D4AF37]"
            />
          </div>

          {mode === 'login' && (
            <div className="space-y-1.5">
              <label className="text-xs text-[#999999] flex items-center gap-1.5">
                <KeyRound className="w-3.5 h-3.5 text-[#D4AF37]" />
                Password
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-3.5 py-2.5 rounded-lg bg-[#0c0c0c] border border-white/12 text-sm text-white focus:outline-none focus:border-[#D4AF37]"
              />
            </div>
          )}

          {error && (
            <p className="text-xs text-red-300 bg-red-950/40 border border-red-800/40 rounded-lg p-3">
              {error}
            </p>
          )}
          {info && (
            <p className="text-xs text-[#F5DE9B] bg-[#D4AF37]/10 border border-[#D4AF37]/30 rounded-lg p-3">
              {info}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-lg border border-[#D4AF37]/40 text-xs font-semibold tracking-wider uppercase text-[#F5DE9B] hover:bg-[#D4AF37]/10 transition cursor-pointer disabled:opacity-60"
          >
            {loading
              ? 'Processing...'
              : mode === 'login'
              ? 'Sign In with Email'
              : 'Send Password Reset Link'}
          </button>
        </form>

        <div className="flex items-center justify-between text-xs text-[#999999] pt-2 border-t border-white/10">
          <button
            type="button"
            onClick={() => {
              setMode(mode === 'login' ? 'forgot' : 'login');
              setError(null);
              setInfo(null);
            }}
            className="hover:text-[#F5DE9B] transition cursor-pointer"
          >
            {mode === 'login' ? 'Forgot password?' : 'Back to login'}
          </button>
          <Link to="/register" className="text-[#D4AF37] hover:underline">
            Create an account
          </Link>
        </div>
      </div>
    </div>
  );
}
