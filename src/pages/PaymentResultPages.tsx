import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CheckCircle2, Clock, XCircle } from 'lucide-react';
import { usePageMeta } from '../components/Layout';
import { useAuth } from '../context/AuthContext';

export function PaymentSuccessPage() {
  usePageMeta('Payment Verification — EgoRank', 'Server-side verification for your EgoRank featured placement order.');
  const [searchParams] = useSearchParams();
  const { user, getIdToken, refreshProfile } = useAuth();

  const provider = searchParams.get('provider') || 'paypal';
  const orderId = searchParams.get('order_id') || searchParams.get('token') || '';

  const [status, setStatus] = useState<'verifying' | 'paid' | 'pending' | 'error'>('verifying');
  const [message, setMessage] = useState('Verifying transaction status directly with the payment provider...');
  const [txId, setTxId] = useState('');

  useEffect(() => {
    let active = true;
    async function verify() {
      if (!user || !orderId) {
        if (active) {
          setStatus('pending');
          setMessage(
            'Awaiting signed webhook confirmation. Purchases never activate solely from a redirect URL.'
          );
        }
        return;
      }

      try {
        const token = await getIdToken();
        if (provider === 'paypal') {
          const capRes = await fetch('/api/payments/paypal/capture', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ orderId }),
          });
          const capData = await capRes.json();
          if (!active) return;
          if (capRes.ok && capData.status === 'paid') {
            setStatus('paid');
            setTxId(capData.transactionId || '');
            setMessage('PayPal capture verified server-side. Your featured placement is now active.');
            await refreshProfile();
            return;
          }
        }

        const statusRes = await fetch(
          `/api/payments/status?provider=${encodeURIComponent(provider)}&order_id=${encodeURIComponent(orderId)}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        const statusData = await statusRes.json();
        if (!active) return;
        if (statusRes.ok && statusData.status === 'paid') {
          setStatus('paid');
          setTxId(statusData.transactionId || '');
          setMessage('Server-side verification confirmed. Your featured placement is active.');
          await refreshProfile();
        } else {
          setStatus('pending');
          setMessage(
            'Payment is pending signed webhook confirmation from the provider. Your profile will activate automatically once verified.'
          );
        }
      } catch (err) {
        if (active) {
          setStatus('error');
          setMessage(err instanceof Error ? err.message : 'Verification error.');
        }
      }
    }
    void verify();
    return () => {
      active = false;
    };
  }, [user, orderId, provider, getIdToken, refreshProfile]);

  return (
    <div className="max-w-[600px] mx-auto px-6 py-20">
      <div className="luxury-card-featured rounded-2xl p-8 text-center space-y-5">
        {status === 'paid' ? (
          <CheckCircle2 className="w-12 h-12 text-[#D4AF37] mx-auto" />
        ) : (
          <Clock className="w-12 h-12 text-[#F5DE9B] mx-auto" />
        )}

        <h1 className="font-display text-2xl font-bold text-white">
          {status === 'paid' ? 'Placement Verified & Active' : 'Verifying Payment Status'}
        </h1>

        <p className="text-sm text-[#CCCCCC] leading-relaxed">{message}</p>

        {orderId && (
          <div className="rounded-lg bg-[#0c0c0c] border border-white/10 p-4 text-xs font-mono text-[#999999] space-y-1">
            <p>Provider: {provider.toUpperCase()}</p>
            <p>Order ID: {orderId}</p>
            {txId && <p className="text-[#F5DE9B]">Transaction ID: {txId}</p>}
          </div>
        )}

        <div className="flex flex-wrap justify-center gap-3 pt-2">
          <Link
            to="/dashboard"
            className="px-5 py-2.5 rounded-lg gold-gradient-bg text-[#080808] text-xs font-semibold uppercase tracking-wider"
          >
            Go to Dashboard
          </Link>
          <Link
            to="/leaderboard"
            className="px-5 py-2.5 rounded-lg border border-white/15 text-xs text-white"
          >
            View Leaderboard
          </Link>
        </div>
      </div>
    </div>
  );
}

export function PaymentCancelledPage() {
  usePageMeta('Payment Cancelled — EgoRank', 'Your checkout session was cancelled. No charges were applied.');
  return (
    <div className="max-w-[560px] mx-auto px-6 py-20">
      <div className="luxury-card rounded-2xl p-8 text-center space-y-5">
        <XCircle className="w-12 h-12 text-[#999999] mx-auto" />
        <h1 className="font-display text-2xl font-bold text-white">Checkout Cancelled</h1>
        <p className="text-sm text-[#999999] leading-relaxed">
          Your payment was cancelled before capture. No charges were applied to your account.
        </p>
        <div className="flex justify-center gap-3 pt-2">
          <Link
            to="/checkout"
            className="px-5 py-2.5 rounded-lg gold-gradient-bg text-[#080808] text-xs font-semibold uppercase tracking-wider"
          >
            Return to Checkout
          </Link>
          <Link
            to="/dashboard"
            className="px-5 py-2.5 rounded-lg border border-white/15 text-xs text-white"
          >
            Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
