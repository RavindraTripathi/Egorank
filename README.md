# EgoRank — Pay. Challenge. Dominate.

EgoRank is a global competitive profile and leaderboard platform featuring a black-and-gold luxury aesthetic, Firebase Authentication & Firestore persistence, atomic sandbox throne challenges, downloadable Champion Cards, and a **modular multi-provider payment architecture** supporting **Cashfree (India · INR)**, **PayPal (International · USD)**, and a modular **Stripe** adapter.

---

## Key Features

- **16 Complete Routes**: `/`, `/leaderboard`, `/u/:username`, `/hall-of-fame`, `/login`, `/register`, `/dashboard`, `/checkout`, `/success`, `/cancelled`, `/about`, `/contact`, `/privacy`, `/terms`, `/refund`, and `/admin`.
- **Automatic Country-Based Checkout**:
  - **India (`IN`)** → Server resolves `INR` pricing (`₹399`, `₹1,199`, `₹3,999`) and routes to **Cashfree** (UPI, domestic cards, netbanking).
  - **International (`US`, `GB`, `SG`, `AE`, `CA`, `AU`, `DE`, etc.)** → Server resolves `USD` pricing (`$5`, `$15`, `$49`) and routes to **PayPal Checkout**.
  - **Zero Client Trust**: Country, currency, package pricing, and provider selection are validated strictly on the backend (`/api/payments/catalog` and `/api/payments/create-order`).
- **Separate Verified Webhooks & Idempotency**:
  - `/api/webhooks/cashfree`: HMAC-SHA256 verification (`x-webhook-signature`, `x-webhook-timestamp`).
  - `/api/webhooks/paypal`: PayPal `/v1/notifications/verify-webhook-signature` verification.
  - `/api/webhooks/stripe`: Modular Stripe webhook adapter ready for future activation.
  - Purchases **never** activate from frontend `/success` redirects alone.
- **Modular Challenge Sandbox**:
  - Original +$1 escalating throne mechanic is isolated in an atomic Firestore transaction simulator on `/leaderboard` (zero real charges).
- **Viral Growth & SEO**:
  - Server-generated SVG Champion Cards (`/api/og/champion/:username`), client-side `1200×630` PNG export, social sharing (X, LinkedIn, WhatsApp, Instagram Story workflow), referral tracking (`?ref=`), `/sitemap.xml`, `/robots.txt`, and JSON-LD Schema.org metadata.

---

## Environment Variables

Copy `.env.example` to `.env` and populate sandbox credentials before running live checkout tests:

```bash
# Cashfree (India - INR)
CASHFREE_ENV="sandbox"
CASHFREE_CLIENT_ID="..."
CASHFREE_CLIENT_SECRET="..."
CASHFREE_WEBHOOK_SECRET="..."

# PayPal (International - USD)
PAYPAL_ENV="sandbox"
PAYPAL_CLIENT_ID="..."
PAYPAL_CLIENT_SECRET="..."
PAYPAL_WEBHOOK_ID="..."

# Resend (Optional Transactional Email)
RESEND_API_KEY="..."
```

Do not switch `CASHFREE_ENV` or `PAYPAL_ENV` to production/live until the respective payment provider approves EgoRank's business model in writing.

---

## Local Development & Build

```bash
npm install
npm run dev      # Starts Express + Vite full-stack server on port 3000
npm run lint     # TypeScript type-check (tsc --noEmit)
npm run build    # Production Vite build
npm run start    # Production server serving dist/ + API routes
```

---

## Database & Security

- **Live Runtime**: Provisioned Firebase Authentication + Cloud Firestore (`firebase-applet-config.json`) secured by Zero-Trust rules in `firestore.rules`.
- **PostgreSQL / Supabase Migration**: Included in `supabase/migrations/001_egorank_schema.sql` with unified `payments` and `webhook_events` tables, RLS policies, and atomic SQL functions.
