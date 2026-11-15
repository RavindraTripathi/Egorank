import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export function usePageMeta(title: string, description?: string) {
  useEffect(() => {
    document.title = title;
    if (description) {
      const meta = document.querySelector('meta[name="description"]');
      if (meta) meta.setAttribute('content', description);
      const ogTitle = document.querySelector('meta[property="og:title"]');
      if (ogTitle) ogTitle.setAttribute('content', title);
      const ogDesc = document.querySelector('meta[property="og:description"]');
      if (ogDesc) ogDesc.setAttribute('content', description);
    }
  }, [title, description]);
}

export function Layout({ children }: { children: React.ReactNode }) {
  const { user, profile } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  const navLinks = [
    { label: 'Leaderboard', to: '/leaderboard' },
    { label: 'Hall of Fame', to: '/hall-of-fame' },
    { label: 'How It Works', to: '/#how-it-works' },
    { label: 'Pricing', to: '/checkout' },
    { label: user ? 'Dashboard' : 'Login', to: user ? '/dashboard' : '/login' },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-[#080808] text-white">
      {/* Strict 3-Zone Top Bar Contract */}
      <header className="sticky top-0 z-40 border-b border-[#D4AF37]/15 bg-[#080808]/90 backdrop-blur-md">
        <div className="max-w-[1200px] mx-auto px-6 h-16 flex items-center justify-between gap-8">
          {/* Zone 1: Single-line Brand Wordmark */}
          <Link
            to="/"
            className="font-display text-xl font-bold tracking-[0.18em] gold-gradient-text whitespace-nowrap shrink-0"
          >
            EGORANK
          </Link>

          {/* Zone 2: 5 concise single-line nav links */}
          <nav className="hidden md:flex items-center gap-7 text-sm text-[#999999]">
            {navLinks.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className={`whitespace-nowrap shrink-0 transition-colors hover:text-[#F5DE9B] ${
                  location.pathname === item.to ? 'text-[#F5DE9B]' : ''
                }`}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          {/* Zone 3: 1 Primary CTA */}
          <div className="flex items-center gap-3 shrink-0">
            <Link
              to={user ? (profile ? `/u/${profile.username}` : '/dashboard') : '/register'}
              className="hidden sm:inline-flex items-center justify-center px-4 py-2 rounded-lg gold-gradient-bg text-[#080808] text-xs font-semibold tracking-wider uppercase hover:brightness-110 transition whitespace-nowrap shrink-0"
            >
              {user ? (profile ? `@${profile.username}` : 'My Profile') : 'Join Now'}
            </Link>

            <button
              type="button"
              onClick={() => setMobileOpen((prev) => !prev)}
              aria-label="Toggle navigation menu"
              className="md:hidden p-2 rounded-lg border border-white/10 text-[#F5DE9B] hover:border-[#D4AF37]/40 transition cursor-pointer"
            >
              {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Drawer */}
        {mobileOpen && (
          <div className="md:hidden border-t border-[#D4AF37]/15 bg-[#0c0c0c] px-6 py-4 space-y-3">
            {navLinks.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className="block py-2 text-sm text-[#CCCCCC] hover:text-[#F5DE9B] transition"
              >
                {item.label}
              </Link>
            ))}
            <Link
              to={user ? '/dashboard' : '/register'}
              className="block text-center py-2.5 rounded-lg gold-gradient-bg text-[#080808] text-xs font-semibold tracking-wider uppercase"
            >
              {user ? 'Open Dashboard' : 'Join Now'}
            </Link>
          </div>
        )}
      </header>

      <main className="flex-1">{children}</main>

      {/* Quiet Luxury Footer */}
      <footer className="border-t border-[#D4AF37]/15 bg-[#060606] mt-20">
        <div className="max-w-[1200px] mx-auto px-6 py-12 grid grid-cols-1 md:grid-cols-4 gap-10">
          <div className="space-y-3">
            <span className="font-display text-lg font-bold tracking-[0.18em] gold-gradient-text">
              EGORANK
            </span>
            <p className="text-xs tracking-[0.2em] text-[#D4AF37]/80 uppercase">
              Pay. Challenge. Dominate.
            </p>
            <p className="text-sm text-[#999999] leading-relaxed">
              Global internet competition platform for verified profiles, featured visibility, and enduring Hall of Fame recognition.
            </p>
          </div>

          <div className="space-y-2.5 text-sm">
            <h4 className="font-display text-xs tracking-[0.16em] text-[#F5DE9B] uppercase">
              Competition
            </h4>
            <ul className="space-y-2 text-[#999999]">
              <li><Link to="/leaderboard" className="hover:text-white transition">Global Leaderboard</Link></li>
              <li><Link to="/hall-of-fame" className="hover:text-white transition">Hall of Fame</Link></li>
              <li><Link to="/checkout" className="hover:text-white transition">Featured Placements</Link></li>
              <li><Link to="/dashboard" className="hover:text-white transition">Competitor Dashboard</Link></li>
            </ul>
          </div>

          <div className="space-y-2.5 text-sm">
            <h4 className="font-display text-xs tracking-[0.16em] text-[#F5DE9B] uppercase">
              Company & Trust
            </h4>
            <ul className="space-y-2 text-[#999999]">
              <li><Link to="/about" className="hover:text-white transition">About EgoRank</Link></li>
              <li><Link to="/contact" className="hover:text-white transition">Contact Concierge</Link></li>
              <li><Link to="/admin" className="hover:text-white transition">Admin Console</Link></li>
            </ul>
          </div>

          <div className="space-y-2.5 text-sm">
            <h4 className="font-display text-xs tracking-[0.16em] text-[#F5DE9B] uppercase">
              Legal & Connect
            </h4>
            <ul className="space-y-2 text-[#999999]">
              <li><Link to="/privacy" className="hover:text-white transition">Privacy Policy</Link></li>
              <li><Link to="/terms" className="hover:text-white transition">Terms & Conditions</Link></li>
              <li><Link to="/refund" className="hover:text-white transition">Refund Policy</Link></li>
              <li className="pt-2 flex items-center gap-4 text-xs text-[#D4AF37]">
                <a href="https://x.com" target="_blank" rel="noopener noreferrer" className="hover:text-[#F5DE9B]">X</a>
                <a href="https://linkedin.com" target="_blank" rel="noopener noreferrer" className="hover:text-[#F5DE9B]">LinkedIn</a>
                <a href="https://instagram.com" target="_blank" rel="noopener noreferrer" className="hover:text-[#F5DE9B]">Instagram</a>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-white/5 py-5 px-6 text-center text-xs text-[#666666]">
          © {new Date().getFullYear()} EgoRank. All rights reserved. Fixed-price featured placements powered by Cashfree (India · INR) & PayPal (International · USD).
        </div>
      </footer>
    </div>
  );
}
