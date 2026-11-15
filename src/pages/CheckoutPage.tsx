import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, Check, Globe2, Lock, ShieldCheck, Sparkles } from 'lucide-react';
import { usePageMeta } from '../components/Layout';
import { useAuth } from '../context/AuthContext';
import { PackageOption, PaymentCurrency, PaymentProvider } from '../types/egorank';

interface CountryOption {
  code: string;
  name: string;
  currency: PaymentCurrency;
  provider: PaymentProvider;
}

interface CatalogResponse {
  countryCode: string;
  countryName: string;
  currency: PaymentCurrency;
  provider: PaymentProvider;
  providerConfigured: boolean;
  providerEnv: string;
  countries: CountryOption[];
  packages: PackageOption[];
  escalatingLiveEnabled: boolean;
}

export function CheckoutPage() {
  usePageMeta(
    'Featured Placements & Checkout — EgoRank',
    'Select your country for automatic Cashfree (India · INR) or PayPal (International · USD) featured placement checkout.'
  );

  const { user, getIdToken } = useAuth();
  const [selectedCountry, setSelectedCountry] = useState<string>('IN');
  const [catalog, setCatalog] = useState<CatalogResponse | null>(null);
  const [loadingCatalog, setLoadingCatalog] = useState(true);
  const [phone, setPhone] = useState('');

  const [processingPkg, setProcessingPkg] = useState<string | null>(null);
  const [errorBox, setErrorBox] = useState<{
    message: string;
    missingVars?: string[];
    provider?: string;
  } | null>(null);

  useEffect(() => {
    let active = true;
    setLoadingCatalog(true);
    fetch(`/api/payments/catalog?country=${encodeURIComponent(selectedCountry)}`)
      .then((r) => r.json())
      .then((data: CatalogResponse) => {
        if (active) setCatalog(data);
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoadingCatalog(false);
      });
    return () => {
      active = false;
    };
  }, [selectedCountry]);

  const handleCheckout = async (packageId: 'featured_7d' | 'premium_30d' | 'sponsored') => {
    setErrorBox(null);
    if (!user) {
      setErrorBox({
        message: 'Please sign in or create an account before initiating checkout.',
      });
      return;
    }
    setProcessingPkg(packageId);
    try {
      const token = await getIdToken();
      const res = await fetch('/api/payments/create-order', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          packageId,
          countryCode: selectedCountry,
          customerPhone: phone.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorBox({
          message: data.error || 'Unable to initiate payment order.',
          missingVars: data.missingVars,
          provider: data.provider,
        });
        return;
      }

      if (data.checkoutUrl) {
        window.location.assign(data.checkoutUrl);
      } else {
        setErrorBox({
          message: 'Payment gateway created an order without a redirect URL.',
        });
      }
    } catch (err) {
      setErrorBox({
        message: err instanceof Error ? err.message : 'Checkout request failed.',
      });
    } finally {
      setProcessingPkg(null);
    }
  };

  return (
    <div className="max-w-[1200px] mx-auto px-6 py-12 space-y-10">
      {/* Header & Country Selector */}
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div className="space-y-2 max-w-2xl">
          <p className="text-xs tracking-[0.2em] text-[#D4AF37] uppercase">
            Featured Placements
          </p>
          <h1 className="font-display text-3xl sm:text-4xl font-bold text-white">
            Elevate Your Visibility
          </h1>
          <p className="text-sm text-[#999999] leading-relaxed">
            Fixed-price featured packages calculated and validated server-side. Customers in India check out in INR via Cashfree (UPI &amp; Domestic Cards); international customers check out in USD via PayPal.
          </p>
        </div>

        {/* Automatic Country-Based Gateway Selector */}
        <div className="luxury-card rounded-xl p-4 min-w-[280px] space-y-2">
          <label className="text-xs text-[#999999] flex items-center gap-1.5">
            <Globe2 className="w-3.5 h-3.5 text-[#D4AF37]" />
            Billing Country (Validated Server-Side)
          </label>
          <select
            value={selectedCountry}
            onChange={(e) => {
              setSelectedCountry(e.target.value);
              setErrorBox(null);
            }}
            className="w-full px-3 py-2 rounded-lg bg-[#0c0c0c] border border-[#D4AF37]/30 text-sm text-white focus:outline-none focus:border-[#D4AF37]"
          >
            <option value="IN">India — INR (Cashfree: UPI, Cards)</option>
            <option value="US">United States — USD (PayPal)</option>
            <option value="GB">United Kingdom — USD (PayPal)</option>
            <option value="SG">Singapore — USD (PayPal)</option>
            <option value="AE">United Arab Emirates — USD (PayPal)</option>
            <option value="CA">Canada — USD (PayPal)</option>
            <option value="AU">Australia — USD (PayPal)</option>
            <option value="DE">Germany — USD (PayPal)</option>
          </select>
          {catalog && (
            <p className="text-[11px] text-[#D4AF37]">
              Active Provider: <span className="uppercase font-mono">{catalog.provider}</span> ({catalog.providerEnv}) · {catalog.currency}
            </p>
          )}
        </div>
      </div>

      {/* Optional Phone Input for Cashfree India UPI */}
      {catalog?.provider === 'cashfree' && (
        <div className="luxury-card rounded-xl p-5 flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-0.5">
            <p className="text-sm font-medium text-white">Cashfree India (INR · UPI &amp; Cards)</p>
            <p className="text-xs text-[#999999]">
              Optional 10-digit Indian mobile number for faster UPI intent checkout.
            </p>
          </div>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="9876543210"
            maxLength={15}
            className="px-3.5 py-2 rounded-lg bg-[#0c0c0c] border border-white/15 text-sm font-mono text-white w-56 focus:outline-none focus:border-[#D4AF37]"
          />
        </div>
      )}

      {/* Server Credential Notice (Honest, Zero Fake Success) */}
      {catalog && !catalog.providerConfigured && (
        <div className="luxury-card rounded-xl p-5 border-[#D4AF37]/30 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-[#D4AF37] shrink-0 mt-0.5" />
          <div className="space-y-1 text-xs">
            <p className="text-white font-medium">
              {catalog.provider.toUpperCase()} ({catalog.providerEnv}) credentials are not yet configured in server environment variables.
            </p>
            <p className="text-[#999999]">
              The server-side order API, country validator, and webhook signature verifier are live and ready. Add your sandbox keys to <span className="font-mono text-[#F5DE9B]">.env</span> to launch hosted {catalog.provider.toUpperCase()} checkout.
            </p>
          </div>
        </div>
      )}

      {errorBox && (
        <div className="rounded-xl p-5 bg-red-950/40 border border-red-800/50 space-y-2 text-xs text-red-200">
          <p className="font-medium">{errorBox.message}</p>
          {errorBox.missingVars && (
            <p className="font-mono text-red-300">
              Required environment variables: {errorBox.missingVars.join(', ')}
            </p>
          )}
        </div>
      )}

      {/* Package Grid (Free + 3 Paid Featured Packages) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Free Basic Profile */}
        <div className="luxury-card rounded-xl p-6 flex flex-col justify-between space-y-6">
          <div className="space-y-3">
            <p className="text-xs text-[#999999] uppercase tracking-wider">Free Tier</p>
            <h2 className="font-display text-xl text-white">Basic Profile</h2>
            <p className="font-mono text-3xl font-bold text-white tabular-nums">
              {catalog?.currency === 'INR' ? '₹0' : '$0'}
            </p>
            <p className="text-xs text-[#999999] leading-relaxed">
              Public competitor profile, unique handle, First Member badge, and downloadable Champion Card.
            </p>
          </div>
          <Link
            to={user ? '/dashboard' : '/register'}
            className="block text-center py-2.5 rounded-lg border border-white/15 text-xs font-semibold uppercase tracking-wider text-white hover:border-[#D4AF37]/50 transition"
          >
            {user ? 'Manage Free Profile' : 'Create Free Profile'}
          </Link>
        </div>

        {/* Paid Packages */}
        {(loadingCatalog ? [] : catalog?.packages || []).map((pkg) => {
          const isHighlight = pkg.id === 'premium_30d';
          return (
            <div
              key={pkg.id}
              className={`${
                isHighlight ? 'luxury-card-featured' : 'luxury-card'
              } rounded-xl p-6 flex flex-col justify-between space-y-6`}
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs text-[#D4AF37] uppercase tracking-wider">
                  <span>{pkg.durationDays} Days</span>
                  {isHighlight && <Sparkles className="w-3.5 h-3.5" />}
                </div>
                <h2 className="font-display text-xl text-white">{pkg.name}</h2>
                <p className="font-mono text-3xl font-bold text-[#F5DE9B] tabular-nums">
                  {pkg.displayPrice}
                  <span className="text-xs font-sans text-[#999999] ml-1.5">
                    {pkg.currency}
                  </span>
                </p>
                <p className="text-xs text-[#CCCCCC] leading-relaxed">{pkg.description}</p>
                <ul className="space-y-1.5 pt-2 text-xs text-[#999999]">
                  <li className="flex items-center gap-1.5">
                    <Check className="w-3.5 h-3.5 text-[#D4AF37]" />
                    Server-verified webhook activation
                  </li>
                  <li className="flex items-center gap-1.5">
                    <Check className="w-3.5 h-3.5 text-[#D4AF37]" />
                    Featured Profile badge unlocked
                  </li>
                </ul>
              </div>

              <button
                type="button"
                disabled={processingPkg !== null}
                onClick={() => void handleCheckout(pkg.id)}
                className="w-full py-3 rounded-lg gold-gradient-bg text-[#080808] text-xs font-semibold uppercase tracking-wider hover:brightness-110 transition cursor-pointer disabled:opacity-60"
              >
                {processingPkg === pkg.id
                  ? 'Creating Secure Order...'
                  : catalog?.provider === 'cashfree'
                  ? 'Pay via Cashfree (INR)'
                  : 'Pay via PayPal (USD)'}
              </button>
            </div>
          );
        })}
      </div>

      {/* Transparency & Compliance Notice */}
      <div className="luxury-card rounded-xl p-6 grid grid-cols-1 md:grid-cols-2 gap-6 text-xs text-[#999999]">
        <div className="flex items-start gap-3">
          <Lock className="w-4 h-4 text-[#D4AF37] shrink-0 mt-0.5" />
          <p className="leading-relaxed">
            <strong className="text-white">Zero Client-Side Price Trust:</strong> Country, currency, provider routing, and package totals are resolved and enforced strictly on the backend. Purchases activate solely via signed Cashfree or PayPal webhooks / server capture.
          </p>
        </div>
        <div className="flex items-start gap-3">
          <ShieldCheck className="w-4 h-4 text-[#D4AF37] shrink-0 mt-0.5" />
          <p className="leading-relaxed">
            <strong className="text-white">Modular Gateway Architecture:</strong> Cashfree (India · INR) and PayPal (International · USD) run in sandbox mode by default. Stripe remains cleanly decoupled for future activation once approved.
          </p>
        </div>
      </div>
    </div>
  );
}
