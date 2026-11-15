import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  Database,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react';
import { usePageMeta } from '../components/Layout';
import { useAuth } from '../context/AuthContext';
import {
  adminFetchAllPayments,
  adminFetchAllProfiles,
  adminFetchAuditLogs,
  adminFetchReports,
  adminResolveReport,
  adminSeedDemoArena,
  adminToggleSuspendProfile,
  adminUpdateFeaturedTier,
} from '../lib/firestoreService';
import {
  AuditLogRecord,
  FeaturedTier,
  formatMoney,
  PaymentRecord,
  Profile,
  ReportRecord,
} from '../types/egorank';

export function AdminPage() {
  usePageMeta('Admin Console — EgoRank', 'Protected EgoRank moderation, multi-gateway payment monitoring, refunds, and audit logs.');
  const { user, isAdmin, loading: authLoading, getIdToken } = useAuth();

  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [reports, setReports] = useState<ReportRecord[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<'users' | 'payments' | 'reports' | 'audit'>('users');
  const [actionMsg, setActionMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const loadAdminData = useCallback(async () => {
    if (!isAdmin) return;
    setLoading(true);
    try {
      const [p, pay, rep, logs] = await Promise.all([
        adminFetchAllProfiles().catch(() => []),
        adminFetchAllPayments().catch(() => []),
        adminFetchReports().catch(() => []),
        adminFetchAuditLogs().catch(() => []),
      ]);
      setProfiles(p);
      setPayments(pay);
      setReports(rep);
      setAuditLogs(logs);
    } finally {
      setLoading(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    if (isAdmin) {
      void loadAdminData();
    } else if (!authLoading) {
      setLoading(false);
    }
  }, [isAdmin, authLoading, loadAdminData]);

  const metrics = useMemo(() => {
    const paid = payments.filter((p) => p.payment_status === 'paid');
    const failed = payments.filter((p) => p.payment_status === 'failed');
    const refunded = payments.filter((p) => p.payment_status === 'refunded');
    const inrMinor = paid
      .filter((p) => p.currency === 'INR')
      .reduce((s, p) => s + p.amount, 0);
    const usdMinor = paid
      .filter((p) => p.currency === 'USD')
      .reduce((s, p) => s + p.amount, 0);
    const activeFeatured = profiles.filter((p) => p.featuredTier !== 'none' && !p.isSuspended);
    const openReports = reports.filter((r) => r.status === 'open');
    return {
      totalUsers: profiles.length,
      totalPayments: payments.length,
      inrMinor,
      usdMinor,
      activeFeatured: activeFeatured.length,
      failedCount: failed.length,
      refundedCount: refunded.length,
      openReports: openReports.length,
    };
  }, [profiles, payments, reports]);

  const filteredProfiles = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return profiles;
    return profiles.filter(
      (p) =>
        p.username.toLowerCase().includes(q) ||
        p.displayName.toLowerCase().includes(q) ||
        p.uid.toLowerCase().includes(q)
    );
  }, [profiles, search]);

  if (authLoading || loading) {
    return (
      <div className="max-w-[1200px] mx-auto px-6 py-16">
        <div className="luxury-card rounded-xl h-64 animate-pulse" />
      </div>
    );
  }

  if (!user || !isAdmin) {
    return (
      <div className="max-w-[600px] mx-auto px-6 py-20 text-center space-y-4">
        <ShieldAlert className="w-10 h-10 text-[#D4AF37] mx-auto" />
        <h1 className="font-display text-2xl text-white">Administrator Access Required</h1>
        <p className="text-sm text-[#999999]">
          This route is strictly protected by Firebase authentication and server-side administrator verification.
        </p>
        <Link
          to={user ? '/dashboard' : '/login'}
          className="inline-flex px-5 py-2.5 rounded-lg gold-gradient-bg text-[#080808] text-xs font-semibold uppercase tracking-wider"
        >
          {user ? 'Return to Dashboard' : 'Sign In'}
        </Link>
      </div>
    );
  }

  const handleSeed = async () => {
    setBusy(true);
    setActionMsg(null);
    try {
      await adminSeedDemoArena(user.uid);
      setActionMsg('Firestore arena initialized with starter profiles, leaderboard state, and Hall of Fame history.');
      await loadAdminData();
    } catch (err) {
      setActionMsg(err instanceof Error ? err.message : 'Seed failed.');
    } finally {
      setBusy(false);
    }
  };

  const handleReconcile = async () => {
    setBusy(true);
    setActionMsg(null);
    try {
      const token = await getIdToken();
      const res = await fetch('/api/admin/reconcile', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setActionMsg(`Reconciled ${data.reconciledCount ?? 0} pending orders against Cashfree/PayPal APIs.`);
      await loadAdminData();
    } catch (err) {
      setActionMsg(err instanceof Error ? err.message : 'Reconciliation failed.');
    } finally {
      setBusy(false);
    }
  };

  const handleRefund = async (pay: PaymentRecord) => {
    setBusy(true);
    setActionMsg(null);
    try {
      const token = await getIdToken();
      const res = await fetch('/api/admin/refund', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          provider: pay.provider,
          orderId: pay.provider_order_id,
          transactionId: pay.provider_transaction_id,
          amountMinor: pay.amount,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Refund failed.');
      setActionMsg(`Refund initiated (${data.refundId || 'processed'}) for order ${pay.provider_order_id}.`);
      await loadAdminData();
    } catch (err) {
      setActionMsg(err instanceof Error ? err.message : 'Refund error.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-[1200px] mx-auto px-6 py-12 space-y-8">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs tracking-[0.2em] text-[#D4AF37] uppercase flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5" />
            Executive Control
          </p>
          <h1 className="font-display text-3xl font-bold text-white mt-1">
            Admin Operations Console
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={busy}
            onClick={() => void handleSeed()}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-[#D4AF37]/40 text-xs text-[#F5DE9B] hover:bg-[#D4AF37]/10 transition cursor-pointer disabled:opacity-50"
          >
            <Database className="w-3.5 h-3.5" />
            Initialize Arena Seed
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void handleReconcile()}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg gold-gradient-bg text-[#080808] text-xs font-semibold cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Reconcile Pending Payments
          </button>
        </div>
      </div>

      {actionMsg && (
        <div className="rounded-lg border border-[#D4AF37]/30 bg-[#D4AF37]/10 px-4 py-3 text-xs text-[#F5DE9B]">
          {actionMsg}
        </div>
      )}

      {/* KPI Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
        {[
          { label: 'Total Users', val: String(metrics.totalUsers) },
          { label: 'Active Featured', val: String(metrics.activeFeatured) },
          { label: 'Total Payments', val: String(metrics.totalPayments) },
          { label: 'Revenue (INR)', val: formatMoney(metrics.inrMinor, 'INR') },
          { label: 'Revenue (USD)', val: formatMoney(metrics.usdMinor, 'USD') },
          { label: 'Failures / Refunds', val: `${metrics.failedCount} / ${metrics.refundedCount}` },
          { label: 'Open Reports', val: String(metrics.openReports) },
        ].map((kpi) => (
          <div key={kpi.label} className="luxury-card rounded-xl p-4 space-y-1">
            <p className="text-[11px] text-[#999999]">{kpi.label}</p>
            <p className="font-mono text-lg font-semibold text-white tabular-nums">{kpi.val}</p>
          </div>
        ))}
      </div>

      {/* Navigation Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-white/10 pb-3">
        {(
          [
            { id: 'users', label: `Users & Moderation (${profiles.length})` },
            { id: 'payments', label: `Unified Payments (${payments.length})` },
            { id: 'reports', label: `Reports (${reports.length})` },
            { id: 'audit', label: `Audit Logs (${auditLogs.length})` },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`px-4 py-2 rounded-lg text-xs font-medium transition cursor-pointer ${
              tab === t.id
                ? 'bg-[#D4AF37] text-[#080808]'
                : 'bg-[#151515] text-[#999999] hover:text-white border border-white/10'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab: Users */}
      {tab === 'users' && (
        <div className="space-y-4">
          <div className="relative max-w-md">
            <Search className="w-4 h-4 text-[#999999] absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search users by handle, name, or UID..."
              className="w-full pl-10 pr-4 py-2 rounded-lg bg-[#151515] border border-white/12 text-sm text-white focus:outline-none focus:border-[#D4AF37]"
            />
          </div>

          <div className="luxury-card rounded-xl overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-white/10 text-[#999999] uppercase">
                  <th className="py-3 px-4">Competitor</th>
                  <th className="py-3 px-4">Featured Package</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Moderation</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/8">
                {filteredProfiles.map((p) => (
                  <tr key={p.uid}>
                    <td className="py-3.5 px-4">
                      <p className="text-white font-medium">{p.displayName}</p>
                      <p className="font-mono text-[#999999]">@{p.username}</p>
                    </td>
                    <td className="py-3.5 px-4">
                      <select
                        value={p.featuredTier}
                        onChange={async (e) => {
                          await adminUpdateFeaturedTier(
                            user.uid,
                            p.uid,
                            e.target.value as FeaturedTier
                          );
                          await loadAdminData();
                        }}
                        className="px-2.5 py-1.5 rounded bg-[#0c0c0c] border border-white/15 text-xs text-white"
                      >
                        <option value="none">None</option>
                        <option value="featured_7d">Featured (7d)</option>
                        <option value="premium_30d">Premium (30d)</option>
                        <option value="sponsored">Sponsored</option>
                      </select>
                    </td>
                    <td className="py-3.5 px-4">
                      {p.isSuspended ? (
                        <span className="text-red-400">Suspended</span>
                      ) : (
                        <span className="text-[#F5DE9B]">Active</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <button
                        type="button"
                        onClick={async () => {
                          await adminToggleSuspendProfile(user.uid, p.uid, !p.isSuspended);
                          await loadAdminData();
                        }}
                        className="px-3 py-1.5 rounded border border-white/15 text-white hover:border-[#D4AF37]/50 cursor-pointer"
                      >
                        {p.isSuspended ? 'Restore' : 'Suspend'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab: Payments */}
      {tab === 'payments' && (
        <div className="luxury-card rounded-xl overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-white/10 text-[#999999] uppercase">
                <th className="py-3 px-4">Provider</th>
                <th className="py-3 px-4">Order / Transaction ID</th>
                <th className="py-3 px-4">Package</th>
                <th className="py-3 px-4">Amount</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Refund</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/8">
              {payments.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-[#999999]">
                    No payment orders recorded yet.
                  </td>
                </tr>
              ) : (
                payments.map((pay) => (
                  <tr key={pay.id}>
                    <td className="py-3.5 px-4 font-mono uppercase text-[#D4AF37]">
                      {pay.provider} ({pay.country_code})
                    </td>
                    <td className="py-3.5 px-4 font-mono text-[#CCCCCC]">
                      <div>{pay.provider_order_id}</div>
                      {pay.provider_transaction_id && (
                        <div className="text-[11px] text-[#999999]">
                          tx: {pay.provider_transaction_id}
                        </div>
                      )}
                    </td>
                    <td className="py-3.5 px-4">{pay.package_type}</td>
                    <td className="py-3.5 px-4 font-mono tabular-nums text-white">
                      {formatMoney(pay.amount, pay.currency)}
                    </td>
                    <td className="py-3.5 px-4 uppercase font-mono">{pay.payment_status}</td>
                    <td className="py-3.5 px-4 text-right">
                      {pay.payment_status === 'paid' && (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void handleRefund(pay)}
                          className="px-3 py-1 rounded border border-red-700/50 text-red-300 hover:bg-red-950/40 cursor-pointer"
                        >
                          Issue Refund
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Tab: Reports */}
      {tab === 'reports' && (
        <div className="luxury-card rounded-xl divide-y divide-white/8">
          {reports.length === 0 ? (
            <div className="p-8 text-center text-sm text-[#999999]">No user reports filed.</div>
          ) : (
            reports.map((rep) => (
              <div key={rep.id} className="p-5 flex flex-wrap items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-xs text-[#D4AF37]">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>@{rep.targetUsername}</span>
                    <span className="text-[#999999]">· {rep.status}</span>
                  </div>
                  <p className="text-sm text-white">{rep.reason}</p>
                </div>
                {rep.status === 'open' && (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={async () => {
                        await adminResolveReport(user.uid, rep.id, 'reviewed');
                        await loadAdminData();
                      }}
                      className="px-3 py-1.5 rounded bg-[#D4AF37] text-[#080808] text-xs font-semibold cursor-pointer"
                    >
                      Mark Reviewed
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        await adminResolveReport(user.uid, rep.id, 'dismissed');
                        await loadAdminData();
                      }}
                      className="px-3 py-1.5 rounded border border-white/15 text-xs text-[#999999] cursor-pointer"
                    >
                      Dismiss
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* Tab: Audit Logs */}
      {tab === 'audit' && (
        <div className="luxury-card rounded-xl divide-y divide-white/8">
          {auditLogs.length === 0 ? (
            <div className="p-8 text-center text-sm text-[#999999]">No audit events recorded yet.</div>
          ) : (
            auditLogs.map((log) => (
              <div key={log.id} className="p-4 flex flex-wrap items-center justify-between gap-3 text-xs">
                <div>
                  <span className="font-mono text-[#D4AF37] uppercase">{log.action}</span>
                  <span className="text-[#999999]"> · {log.details}</span>
                </div>
                <span className="font-mono text-[#666666] tabular-nums">
                  {new Date(log.createdAt).toLocaleString()}
                </span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
