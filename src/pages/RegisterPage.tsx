import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { KeyRound, Mail, UserPlus } from 'lucide-react';
import { usePageMeta } from '../components/Layout';
import { useAuth } from '../context/AuthContext';

export function RegisterPage() {
  usePageMeta('Join EgoRank — Create Competitor Account', 'Register on EgoRank, verify your email, and claim your public competitor handle.');
  const { loginWithGoogle, registerWithEmail } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const refCode = searchParams.get('ref');
    if (refCode) {
      sessionStorage.setItem('egorank_referral_code', refCode.slice(0, 32));
    }
  }, [searchParams]);

  const referralCode = searchParams.get('ref') || sessionStorage.getItem('egorank_referral_code');

  const handleGoogle = async () => {
    setError(null);
    setLoading(true);
    try {
      await loginWithGoogle();
      navigate('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Google registration failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleEmailRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    setLoading(true);
    try {
      await registerWithEmail(email.trim(), password);
      navigate('/dashboard');
    } catch (err: any) {
      if (err?.code === 'auth/operation-not-allowed') {
        setError(
          'Email/Password registration is not enabled in the Firebase console yet. Use Google Sign-In above to create your verified profile immediately.'
        );
      } else {
        setError(err instanceof Error ? err.message : 'Registration failed.');
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
            Enter the Arena
          </p>
          <h1 className="font-display text-2xl font-bold text-white">
            Create Your EgoRank Account
          </h1>
          {referralCode && (
            <p className="text-xs text-[#F5DE9B]">
              Invited via referral code <span className="font-mono">{referralCode}</span>
            </p>
          )}
        </div>

        <button
          type="button"
          onClick={handleGoogle}
          disabled={loading}
          className="w-full py-3 px-4 rounded-lg gold-gradient-bg text-[#080808] text-xs font-semibold tracking-wider uppercase hover:brightness-110 transition cursor-pointer disabled:opacity-60"
        >
          Instant Join with Google
        </button>

        <div className="relative flex items-center justify-center">
          <div className="border-t border-white/10 w-full" />
          <span className="px-3 text-[11px] uppercase tracking-widest text-[#666666] bg-[#151515]">
            or register with email
          </span>
          <div className="border-t border-white/10 w-full" />
        </div>

        <form onSubmit={handleEmailRegister} className="space-y-4">
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

          <div className="space-y-1.5">
            <label className="text-xs text-[#999999] flex items-center gap-1.5">
              <KeyRound className="w-3.5 h-3.5 text-[#D4AF37]" />
              Password (min 6 chars)
            </label>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-lg bg-[#0c0c0c] border border-white/12 text-sm text-white focus:outline-none focus:border-[#D4AF37]"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs text-[#999999] flex items-center gap-1.5">
              <UserPlus className="w-3.5 h-3.5 text-[#D4AF37]" />
              Confirm Password
            </label>
            <input
              type="password"
              required
              minLength={6}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-lg bg-[#0c0c0c] border border-white/12 text-sm text-white focus:outline-none focus:border-[#D4AF37]"
            />
          </div>

          {error && (
            <p className="text-xs text-red-300 bg-red-950/40 border border-red-800/40 rounded-lg p-3">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-lg border border-[#D4AF37]/40 text-xs font-semibold tracking-wider uppercase text-[#F5DE9B] hover:bg-[#D4AF37]/10 transition cursor-pointer disabled:opacity-60"
          >
            {loading ? 'Creating Account...' : 'Register with Email'}
          </button>
        </form>

        <p className="text-center text-xs text-[#999999] pt-2 border-t border-white/10">
          Already competing?{' '}
          <Link to="/login" className="text-[#D4AF37] hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
