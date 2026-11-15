import dotenv from 'dotenv';
dotenv.config();

import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { Resend } from 'resend';
import { z } from 'zod';
import { initializeApp, getApps } from 'firebase-admin/app';
import { getAuth, DecodedIdToken } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import firebaseConfig from './firebase-applet-config.json' with { type: 'json' };
import {
  CashfreeGateway,
  getGatewayConfigStatus,
  PACKAGE_CATALOG,
  PackageId,
  PaymentCurrency,
  PaymentProvider,
  PayPalGateway,
  resolveCountryCheckoutContext,
  StripeGateway,
  SUPPORTED_COUNTRIES,
} from './src/lib/paymentProviders.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

if (!getApps().length) {
  initializeApp({
    projectId: firebaseConfig.projectId,
  });
}

const adminAuth = getAuth();
const adminDb = getFirestore(firebaseConfig.firestoreDatabaseId);

const cashfreeGateway = new CashfreeGateway();
const paypalGateway = new PayPalGateway();
const stripeGateway = new StripeGateway();

const rawResendKey = process.env.RESEND_API_KEY || '';
const resendConfigured =
  rawResendKey.length > 8 && !rawResendKey.includes('your_resend');
const resend = resendConfigured ? new Resend(rawResendKey) : null;

// In-memory idempotency & unified payment status cache (mirrors Firestore payments collection)
const processedWebhookEvents = new Set<string>();

interface ServerPaymentRecord {
  id: string;
  user_id: string;
  provider: PaymentProvider;
  provider_order_id: string;
  provider_transaction_id: string;
  package_type: PackageId;
  country_code: string;
  amount: number;
  currency: PaymentCurrency;
  payment_status: 'pending' | 'paid' | 'failed' | 'refunded' | 'cancelled' | 'disputed';
  created_at: string;
  completed_at: string | null;
}

const serverPaymentLedger = new Map<string, ServerPaymentRecord>();

// Sliding-window Rate Limiter
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();
function rateLimit(maxRequests: number, windowMs: number) {
  return (req: Request, res: Response, next: NextFunction) => {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const key = `${req.path}:${ip}`;
    const now = Date.now();
    const entry = rateLimitStore.get(key);
    if (!entry || entry.resetAt <= now) {
      rateLimitStore.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }
    if (entry.count >= maxRequests) {
      return res.status(429).json({
        error: 'Too many requests. Please wait a moment before trying again.',
      });
    }
    entry.count += 1;
    return next();
  };
}

interface AuthRequest extends Request {
  user?: DecodedIdToken;
}

async function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required.' });
  }
  const token = authHeader.slice(7).trim();
  try {
    const decoded = await adminAuth.verifyIdToken(token);
    req.user = decoded;
    return next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired authentication token.' });
  }
}

async function requireAdmin(req: AuthRequest, res: Response, next: NextFunction) {
  await requireAuth(req, res, async () => {
    if (!req.user) return;
    const isBootstrapAdmin =
      req.user.email === 'tripathiravindra212@gmail.com' &&
      req.user.email_verified === true;
    if (isBootstrapAdmin) return next();
    try {
      const adminDoc = await adminDb.collection('admins').doc(req.user.uid).get();
      if (adminDoc.exists) return next();
    } catch {
      // Ignore if Firestore Admin ADC unavailable locally
    }
    return res.status(403).json({ error: 'Forbidden: Administrator privileges required.' });
  });
}

async function persistPaymentRecord(record: ServerPaymentRecord) {
  serverPaymentLedger.set(`${record.provider}:${record.provider_order_id}`, record);
  try {
    await adminDb.collection('payments').doc(record.id).set(record, { merge: true });
  } catch {
    // Firestore Admin write optional in local dev without ADC
  }
}

async function recordIdempotentWebhookEvent(
  provider: PaymentProvider,
  providerEventId: string,
  eventType: string
): Promise<boolean> {
  const dedupeKey = `${provider}:${providerEventId}`;
  if (processedWebhookEvents.has(dedupeKey)) {
    return false;
  }

  try {
    const ref = adminDb.collection('webhook_events').doc(dedupeKey.replace(/[^a-zA-Z0-9_-]/g, '_'));
    const snap = await ref.get();
    if (snap.exists) {
      processedWebhookEvents.add(dedupeKey);
      return false;
    }
    await ref.set({
      provider,
      provider_event_id: providerEventId,
      event_type: eventType,
      processed_at: new Date().toISOString(),
    });
  } catch {
    // Continue with in-memory idempotency if Firestore Admin ADC unavailable
  }

  processedWebhookEvents.add(dedupeKey);
  return true;
}

async function sendConfirmationEmail(
  to: string,
  packageName: string,
  amountMinor: number,
  currency: PaymentCurrency,
  provider: PaymentProvider
) {
  if (!resend) return false;
  const formatted =
    currency === 'INR'
      ? `₹${(amountMinor / 100).toLocaleString('en-IN')}`
      : `$${(amountMinor / 100).toFixed(2)} USD`;

  try {
    await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL || 'EgoRank <onboarding@resend.dev>',
      to,
      subject: `EgoRank Placement Confirmed — ${packageName}`,
      html: `
        <div style="background:#080808;color:#ffffff;padding:32px;font-family:Inter,Arial,sans-serif;">
          <h1 style="color:#D4AF37;font-family:Georgia,serif;letter-spacing:2px;">EGORANK</h1>
          <p style="color:#F5DE9B;font-size:14px;">PAY. CHALLENGE. DOMINATE.</p>
          <hr style="border:0;border-top:1px solid #262626;margin:24px 0;" />
          <h2 style="font-size:20px;margin-bottom:8px;">Your Featured Placement Is Active</h2>
          <p style="color:#cccccc;line-height:1.6;">
            Your purchase of <strong>${packageName}</strong> (${formatted} via ${provider.toUpperCase()})
            has been verified server-side and activated on your EgoRank profile.
          </p>
        </div>
      `,
    });
    return true;
  } catch (err) {
    console.error('Resend email error:', err);
    return false;
  }
}

async function activatePlacementFromVerifiedPayment(params: {
  uid: string;
  packageId: PackageId;
  provider: PaymentProvider;
  providerOrderId: string;
  providerTransactionId: string;
  amountMinor: number;
  currency: PaymentCurrency;
  countryCode: string;
  email?: string | null;
}) {
  const pkg = PACKAGE_CATALOG[params.packageId];
  if (!pkg) return;

  const now = new Date();
  const expiresAt = new Date(now.getTime() + pkg.durationDays * 86400 * 1000).toISOString();
  const paymentDocId = `${params.provider}_${params.providerOrderId}`.replace(/[^a-zA-Z0-9_-]/g, '_');

  const completedRecord: ServerPaymentRecord = {
    id: paymentDocId,
    user_id: params.uid,
    provider: params.provider,
    provider_order_id: params.providerOrderId,
    provider_transaction_id: params.providerTransactionId,
    package_type: params.packageId,
    country_code: params.countryCode,
    amount: params.amountMinor,
    currency: params.currency,
    payment_status: 'paid',
    created_at:
      serverPaymentLedger.get(`${params.provider}:${params.providerOrderId}`)?.created_at ||
      now.toISOString(),
    completed_at: now.toISOString(),
  };

  serverPaymentLedger.set(`${params.provider}:${params.providerOrderId}`, completedRecord);

  try {
    const profileRef = adminDb.collection('profiles').doc(params.uid);
    await adminDb.runTransaction(async (tx) => {
      const snap = await tx.get(profileRef);
      const existingBadges: string[] =
        snap.exists && Array.isArray(snap.data()?.badges)
          ? snap.data()!.badges
          : ['First Member'];
      const updatedBadges = existingBadges.includes('Featured Profile')
        ? existingBadges
        : [...existingBadges, 'Featured Profile'];

      if (snap.exists) {
        tx.update(profileRef, {
          featuredTier: pkg.tier,
          featuredExpiresAt: expiresAt,
          badges: updatedBadges,
          updatedAt: now.toISOString(),
        });
      }

      tx.set(adminDb.collection('payments').doc(paymentDocId), completedRecord, { merge: true });

      tx.set(adminDb.collection('notifications').doc(), {
        uid: params.uid,
        type: 'package_activated',
        title: `${pkg.name} Activated`,
        message: `Verified via ${params.provider.toUpperCase()} (${params.currency}). Active until ${new Date(expiresAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}.`,
        read: false,
        createdAt: now.toISOString(),
      });

      tx.set(adminDb.collection('audit_logs').doc(), {
        actorUid: `${params.provider}_webhook`,
        action: 'payment_succeeded',
        target: params.uid,
        details: `Activated ${pkg.id} (${params.amountMinor} ${params.currency}) order=${params.providerOrderId} tx=${params.providerTransactionId}`,
        createdAt: now.toISOString(),
      });
    });
  } catch (err) {
    console.error('Firestore Admin transaction warning during payment activation:', err);
  }

  if (params.email) {
    await sendConfirmationEmail(
      params.email,
      pkg.name,
      params.amountMinor,
      params.currency,
      params.provider
    );
  }
}

async function markPaymentStatusChange(params: {
  provider: PaymentProvider;
  providerOrderId: string;
  status: 'failed' | 'refunded' | 'cancelled' | 'disputed';
  transactionId?: string;
  revokeFeatured?: boolean;
}) {
  const key = `${params.provider}:${params.providerOrderId}`;
  const existing = serverPaymentLedger.get(key);
  if (existing) {
    existing.payment_status = params.status;
    if (params.transactionId) existing.provider_transaction_id = params.transactionId;
    serverPaymentLedger.set(key, existing);
  }

  const paymentDocId = `${params.provider}_${params.providerOrderId}`.replace(/[^a-zA-Z0-9_-]/g, '_');
  try {
    const paymentRef = adminDb.collection('payments').doc(paymentDocId);
    const snap = await paymentRef.get();
    if (snap.exists) {
      const data = snap.data() as ServerPaymentRecord;
      await paymentRef.update({
        payment_status: params.status,
        ...(params.transactionId ? { provider_transaction_id: params.transactionId } : {}),
      });
      if (params.revokeFeatured && data.user_id) {
        await adminDb.collection('profiles').doc(data.user_id).update({
          featuredTier: 'none',
          featuredExpiresAt: null,
          updatedAt: new Date().toISOString(),
        });
      }
      await adminDb.collection('audit_logs').add({
        actorUid: `${params.provider}_webhook`,
        action: `payment_${params.status}`,
        target: data.user_id || params.providerOrderId,
        details: `${params.provider.toUpperCase()} order ${params.providerOrderId} transitioned to ${params.status}`,
        createdAt: new Date().toISOString(),
      });
    }
  } catch {
    // Ignore if Firestore Admin ADC unavailable
  }
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

async function startServer() {
  const app = express();
  app.set('trust proxy', 1);

  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
  });

  // ============================================================================
  // SEPARATE RAW-BODY WEBHOOK ENDPOINTS (Mounted BEFORE express.json)
  // ============================================================================

  // 1. CASHFREE WEBHOOK (HMAC-SHA256 Signature Verification)
  app.post(
    '/api/webhooks/cashfree',
    express.raw({ type: 'application/json' }),
    async (req: Request, res: Response) => {
      const rawBody = req.body instanceof Buffer ? req.body.toString('utf8') : '';
      const timestamp = String(req.headers['x-webhook-timestamp'] || '');
      const signature = String(req.headers['x-webhook-signature'] || '');

      if (!cashfreeGateway.verifyWebhookSignature(rawBody, timestamp, signature)) {
        return res.status(400).json({ error: 'Invalid Cashfree webhook signature.' });
      }

      let payload: Record<string, any>;
      try {
        payload = JSON.parse(rawBody);
      } catch {
        return res.status(400).json({ error: 'Malformed JSON payload.' });
      }

      const eventType = String(payload.type || 'PAYMENT_EVENT');
      const orderId = String(payload.data?.order?.order_id || '');
      const cfPaymentId = String(payload.data?.payment?.cf_payment_id || '');
      const eventId = `${eventType}_${orderId}_${cfPaymentId || timestamp}`;

      const isNew = await recordIdempotentWebhookEvent('cashfree', eventId, eventType);
      if (!isNew) {
        return res.json({ received: true, duplicate: true });
      }

      try {
        if (eventType === 'PAYMENT_SUCCESS_WEBHOOK' && orderId) {
          const verified = await cashfreeGateway.verifyOrderStatus(orderId);
          if (verified.status === 'paid') {
            const cached = serverPaymentLedger.get(`cashfree:${orderId}`);
            const tags = payload.data?.order?.order_tags || {};
            const uid = cached?.user_id || tags.uid;
            const packageId = (cached?.package_type || tags.package_id) as PackageId;
            if (uid && packageId && PACKAGE_CATALOG[packageId]) {
              await activatePlacementFromVerifiedPayment({
                uid,
                packageId,
                provider: 'cashfree',
                providerOrderId: orderId,
                providerTransactionId: verified.transactionId || cfPaymentId,
                amountMinor: PACKAGE_CATALOG[packageId].pricing.INR,
                currency: 'INR',
                countryCode: 'IN',
                email: payload.data?.customer_details?.customer_email,
              });
            }
          }
        } else if (eventType === 'PAYMENT_FAILED_WEBHOOK' && orderId) {
          await markPaymentStatusChange({
            provider: 'cashfree',
            providerOrderId: orderId,
            status: 'failed',
            transactionId: cfPaymentId,
          });
        } else if (eventType === 'REFUND_STATUS_WEBHOOK' && orderId) {
          if (payload.data?.refund?.refund_status === 'SUCCESS') {
            await markPaymentStatusChange({
              provider: 'cashfree',
              providerOrderId: orderId,
              status: 'refunded',
              revokeFeatured: true,
            });
          }
        }
      } catch (err) {
        console.error('Cashfree webhook processing error:', err);
        return res.status(500).json({ error: 'Cashfree webhook handler error.' });
      }

      return res.json({ received: true });
    }
  );

  // 2. PAYPAL WEBHOOK (PayPal Verification API)
  app.post(
    '/api/webhooks/paypal',
    express.raw({ type: 'application/json' }),
    async (req: Request, res: Response) => {
      const rawBody = req.body instanceof Buffer ? req.body.toString('utf8') : '';
      let event: Record<string, any>;
      try {
        event = JSON.parse(rawBody);
      } catch {
        return res.status(400).json({ error: 'Malformed PayPal webhook payload.' });
      }

      const verified = await paypalGateway.verifyWebhookSignature(req.headers, event);
      if (!verified) {
        return res.status(400).json({ error: 'PayPal webhook signature verification failed.' });
      }

      const eventId = String(event.id || '');
      const eventType = String(event.event_type || '');
      if (!eventId) {
        return res.status(400).json({ error: 'Missing PayPal event id.' });
      }

      const isNew = await recordIdempotentWebhookEvent('paypal', eventId, eventType);
      if (!isNew) {
        return res.json({ received: true, duplicate: true });
      }

      try {
        const resource = event.resource || {};
        if (eventType === 'PAYMENT.CAPTURE.COMPLETED') {
          const orderId = String(resource.supplementary_data?.related_ids?.order_id || '');
          const captureId = String(resource.id || '');
          let uid: string | undefined;
          let packageId: PackageId | undefined;
          try {
            const parsedCustom = JSON.parse(resource.custom_id || '{}');
            uid = parsedCustom.uid;
            packageId = parsedCustom.packageId;
          } catch {
            // Fallback to ledger
          }
          const cached = orderId ? serverPaymentLedger.get(`paypal:${orderId}`) : undefined;
          const resolvedUid = uid || cached?.user_id;
          const resolvedPkg = packageId || cached?.package_type;
          if (resolvedUid && resolvedPkg && PACKAGE_CATALOG[resolvedPkg]) {
            await activatePlacementFromVerifiedPayment({
              uid: resolvedUid,
              packageId: resolvedPkg,
              provider: 'paypal',
              providerOrderId: orderId || captureId,
              providerTransactionId: captureId,
              amountMinor: PACKAGE_CATALOG[resolvedPkg].pricing.USD,
              currency: 'USD',
              countryCode: cached?.country_code || 'US',
            });
          }
        } else if (
          eventType === 'PAYMENT.CAPTURE.DENIED' ||
          eventType === 'PAYMENT.CAPTURE.DECLINED'
        ) {
          const orderId = String(resource.supplementary_data?.related_ids?.order_id || '');
          if (orderId) {
            await markPaymentStatusChange({
              provider: 'paypal',
              providerOrderId: orderId,
              status: 'failed',
            });
          }
        } else if (eventType === 'PAYMENT.CAPTURE.REFUNDED') {
          const orderId = String(resource.supplementary_data?.related_ids?.order_id || '');
          if (orderId) {
            await markPaymentStatusChange({
              provider: 'paypal',
              providerOrderId: orderId,
              status: 'refunded',
              revokeFeatured: true,
            });
          }
        }
      } catch (err) {
        console.error('PayPal webhook processing error:', err);
        return res.status(500).json({ error: 'PayPal webhook handler error.' });
      }

      return res.json({ received: true });
    }
  );

  // 3. MODULAR STRIPE WEBHOOK (Kept ready for future activation)
  app.post(
    '/api/webhooks/stripe',
    express.raw({ type: 'application/json' }),
    async (req: Request, res: Response) => {
      if (!stripeGateway.isConfigured()) {
        return res.status(503).json({ error: 'Stripe module is currently disabled.' });
      }
      const sig = req.headers['stripe-signature'];
      if (!sig || typeof sig !== 'string') {
        return res.status(400).json({ error: 'Missing stripe-signature.' });
      }
      try {
        const event = stripeGateway.constructWebhookEvent(req.body as Buffer, sig);
        const isNew = await recordIdempotentWebhookEvent('stripe', event.id, event.type);
        if (!isNew) return res.json({ received: true, duplicate: true });
        return res.json({ received: true });
      } catch (err) {
        return res.status(400).json({
          error: err instanceof Error ? err.message : 'Stripe signature invalid.',
        });
      }
    }
  );

  app.use(express.json({ limit: '256kb' }));
  app.use('/api', rateLimit(100, 60_000));

  // ============================================================================
  // PUBLIC HEALTH & SERVER-VALIDATED COUNTRY CHECKOUT CATALOG
  // ============================================================================
  app.get('/api/health', (_req, res) => {
    const gatewayStatus = getGatewayConfigStatus();
    res.json({
      ok: true,
      ...gatewayStatus,
      resendConfigured,
      escalatingLiveEnabled: false,
    });
  });

  app.get('/api/payments/catalog', (req, res) => {
    const rawCountry = typeof req.query.country === 'string' ? req.query.country : 'US';
    const context = resolveCountryCheckoutContext(rawCountry);
    const gatewayStatus = getGatewayConfigStatus();

    const packages = Object.values(PACKAGE_CATALOG).map((pkg) => {
      const amountMinor = pkg.pricing[context.currency];
      const displayPrice =
        context.currency === 'INR'
          ? `₹${(amountMinor / 100).toLocaleString('en-IN')}`
          : `$${(amountMinor / 100).toFixed(0)}`;
      return {
        id: pkg.id,
        name: pkg.name,
        durationDays: pkg.durationDays,
        tier: pkg.tier,
        description: pkg.description,
        amountMinor,
        displayPrice,
        currency: context.currency,
      };
    });

    const providerConfigured =
      context.provider === 'cashfree'
        ? gatewayStatus.cashfreeConfigured
        : gatewayStatus.paypalConfigured;

    res.json({
      countryCode: context.countryCode,
      countryName: context.countryName,
      currency: context.currency,
      provider: context.provider,
      providerConfigured,
      providerEnv:
        context.provider === 'cashfree'
          ? gatewayStatus.cashfreeEnv
          : gatewayStatus.paypalEnv,
      countries: SUPPORTED_COUNTRIES,
      packages,
      escalatingLiveEnabled: false,
    });
  });

  // ============================================================================
  // CREATE ORDER (Backend validates country, price, currency, and provider!)
  // ============================================================================
  const createOrderSchema = z.object({
    packageId: z.enum(['featured_7d', 'premium_30d', 'sponsored']),
    countryCode: z.string().length(2),
    customerPhone: z.string().max(20).optional(),
  });

  app.post(
    '/api/payments/create-order',
    rateLimit(15, 60_000),
    requireAuth,
    async (req: AuthRequest, res: Response) => {
      const parsed = createOrderSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: 'Invalid package or country code.' });
      }

      const { packageId, countryCode, customerPhone } = parsed.data;
      const context = resolveCountryCheckoutContext(countryCode);
      const pkg = PACKAGE_CATALOG[packageId];
      const amountMinor = pkg.pricing[context.currency];
      const gatewayStatus = getGatewayConfigStatus();
      const uid = req.user!.uid;
      const now = new Date().toISOString();

      const origin =
        process.env.APP_URL ||
        process.env.NEXT_PUBLIC_SITE_URL ||
        `${req.protocol}://${req.get('host')}`;

      if (context.provider === 'cashfree') {
        if (!gatewayStatus.cashfreeConfigured) {
          return res.status(503).json({
            code: 'PROVIDER_NOT_CONFIGURED',
            provider: 'cashfree',
            currency: 'INR',
            error:
              'Cashfree sandbox credentials are not configured on the server. Set CASHFREE_CLIENT_ID, CASHFREE_CLIENT_SECRET, and CASHFREE_WEBHOOK_SECRET in .env.',
            missingVars: [
              'CASHFREE_CLIENT_ID',
              'CASHFREE_CLIENT_SECRET',
              'CASHFREE_WEBHOOK_SECRET',
            ],
          });
        }

        const internalOrderId = `cf_${uid.slice(0, 8)}_${Date.now()}`;
        try {
          const cfOrder = await cashfreeGateway.createOrder({
            orderId: internalOrderId,
            amountPaise: amountMinor,
            customerUid: uid,
            customerEmail: req.user?.email || 'competitor@egorank.app',
            customerName: req.user?.name || 'EgoRank Competitor',
            customerPhone,
            returnUrl: `${origin}/success?provider=cashfree&order_id=${internalOrderId}`,
            notifyUrl: `${origin}/api/webhooks/cashfree`,
            packageId,
          });

          await persistPaymentRecord({
            id: `cashfree_${cfOrder.providerOrderId}`,
            user_id: uid,
            provider: 'cashfree',
            provider_order_id: cfOrder.providerOrderId,
            provider_transaction_id: '',
            package_type: packageId,
            country_code: 'IN',
            amount: amountMinor,
            currency: 'INR',
            payment_status: 'pending',
            created_at: now,
            completed_at: null,
          });

          return res.json({
            provider: 'cashfree',
            currency: 'INR',
            amount: amountMinor,
            orderId: cfOrder.providerOrderId,
            paymentSessionId: cfOrder.paymentSessionId,
            checkoutUrl: cfOrder.checkoutUrl,
            env: gatewayStatus.cashfreeEnv,
          });
        } catch (err) {
          return res.status(502).json({
            error: err instanceof Error ? err.message : 'Cashfree API error.',
          });
        }
      }

      // International -> PayPal (USD)
      if (!gatewayStatus.paypalConfigured) {
        return res.status(503).json({
          code: 'PROVIDER_NOT_CONFIGURED',
          provider: 'paypal',
          currency: 'USD',
          error:
            'PayPal sandbox credentials are not configured on the server. Set PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET, and PAYPAL_WEBHOOK_ID in .env.',
          missingVars: [
            'PAYPAL_CLIENT_ID',
            'PAYPAL_CLIENT_SECRET',
            'PAYPAL_WEBHOOK_ID',
          ],
        });
      }

      const internalOrderId = `pp_${uid.slice(0, 8)}_${Date.now()}`;
      try {
        const ppOrder = await paypalGateway.createOrder({
          internalOrderId,
          amountCents: amountMinor,
          packageName: pkg.name,
          packageId,
          uid,
          returnUrl: `${origin}/success?provider=paypal`,
          cancelUrl: `${origin}/cancelled?provider=paypal`,
        });

        await persistPaymentRecord({
          id: `paypal_${ppOrder.providerOrderId}`,
          user_id: uid,
          provider: 'paypal',
          provider_order_id: ppOrder.providerOrderId,
          provider_transaction_id: '',
          package_type: packageId,
          country_code: context.countryCode,
          amount: amountMinor,
          currency: 'USD',
          payment_status: 'pending',
          created_at: now,
          completed_at: null,
        });

        return res.json({
          provider: 'paypal',
          currency: 'USD',
          amount: amountMinor,
          orderId: ppOrder.providerOrderId,
          checkoutUrl: ppOrder.approvalUrl,
          env: gatewayStatus.paypalEnv,
        });
      } catch (err) {
        return res.status(502).json({
          error: err instanceof Error ? err.message : 'PayPal API error.',
        });
      }
    }
  );

  // ============================================================================
  // SERVER-SIDE PAYPAL CAPTURE & PAYMENT STATUS VERIFICATION
  // ============================================================================
  const paypalCaptureSchema = z.object({
    orderId: z.string().min(4).max(128),
  });

  app.post(
    '/api/payments/paypal/capture',
    rateLimit(15, 60_000),
    requireAuth,
    async (req: AuthRequest, res: Response) => {
      const parsed = paypalCaptureSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: 'Valid PayPal orderId is required.' });
      }
      const { orderId } = parsed.data;
      const cached = serverPaymentLedger.get(`paypal:${orderId}`);
      if (cached && cached.user_id !== req.user!.uid) {
        return res.status(403).json({ error: 'Order does not belong to current user.' });
      }
      if (cached && cached.payment_status === 'paid') {
        return res.json({
          status: 'paid',
          duplicatePrevented: true,
          transactionId: cached.provider_transaction_id,
        });
      }

      try {
        const result = await paypalGateway.captureOrder(orderId);
        if (result.status === 'paid') {
          const packageId = result.packageId || cached?.package_type || 'featured_7d';
          await activatePlacementFromVerifiedPayment({
            uid: req.user!.uid,
            packageId,
            provider: 'paypal',
            providerOrderId: orderId,
            providerTransactionId: result.transactionId,
            amountMinor: PACKAGE_CATALOG[packageId].pricing.USD,
            currency: 'USD',
            countryCode: cached?.country_code || 'US',
            email: req.user?.email,
          });
        }
        return res.json({
          status: result.status,
          transactionId: result.transactionId,
        });
      } catch (err) {
        return res.status(502).json({
          error: err instanceof Error ? err.message : 'PayPal capture failed.',
        });
      }
    }
  );

  // Server-side Status Check (Never activates solely from frontend redirect)
  app.get('/api/payments/status', requireAuth, async (req: AuthRequest, res: Response) => {
    const provider = String(req.query.provider || '') as PaymentProvider;
    const orderId = String(req.query.order_id || '');
    if (!orderId || (provider !== 'cashfree' && provider !== 'paypal')) {
      return res.status(400).json({ error: 'Valid provider and order_id are required.' });
    }

    const cached = serverPaymentLedger.get(`${provider}:${orderId}`);
    if (cached && cached.user_id !== req.user!.uid) {
      return res.status(403).json({ error: 'Forbidden.' });
    }

    try {
      if (provider === 'cashfree') {
        const verified = await cashfreeGateway.verifyOrderStatus(orderId);
        return res.json({
          provider,
          orderId,
          status: cached?.payment_status === 'paid' ? 'paid' : verified.status,
          transactionId: verified.transactionId || cached?.provider_transaction_id || '',
          webhookConfirmed: cached?.payment_status === 'paid',
        });
      } else {
        const verified = await paypalGateway.getOrderStatus(orderId);
        return res.json({
          provider,
          orderId,
          status: cached?.payment_status === 'paid' ? 'paid' : verified.status,
          transactionId: verified.transactionId || cached?.provider_transaction_id || '',
          webhookConfirmed: cached?.payment_status === 'paid',
        });
      }
    } catch (err) {
      return res.status(404).json({
        error: err instanceof Error ? err.message : 'Unable to verify order status.',
      });
    }
  });

  // ============================================================================
  // ADMIN REFUND & RECONCILIATION ENDPOINTS
  // ============================================================================
  const adminRefundSchema = z.object({
    provider: z.enum(['cashfree', 'paypal', 'stripe']),
    orderId: z.string().min(3).max(150),
    transactionId: z.string().max(150).optional(),
    amountMinor: z.number().int().positive(),
  });

  app.post('/api/admin/refund', requireAdmin, async (req: AuthRequest, res: Response) => {
    const parsed = adminRefundSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid refund payload.' });
    }
    const { provider, orderId, transactionId, amountMinor } = parsed.data;
    try {
      if (provider === 'cashfree') {
        const result = await cashfreeGateway.refundOrder({
          orderId,
          amountPaise: amountMinor,
          refundId: `ref_${Date.now()}`,
        });
        await markPaymentStatusChange({
          provider: 'cashfree',
          providerOrderId: orderId,
          status: 'refunded',
          revokeFeatured: true,
        });
        return res.json(result);
      }
      if (provider === 'paypal') {
        if (!transactionId) {
          return res.status(400).json({ error: 'PayPal capture/transaction ID is required for refund.' });
        }
        const result = await paypalGateway.refundCapture(transactionId, amountMinor);
        await markPaymentStatusChange({
          provider: 'paypal',
          providerOrderId: orderId,
          status: 'refunded',
          revokeFeatured: true,
        });
        return res.json(result);
      }
      if (provider === 'stripe') {
        if (!transactionId) {
          return res.status(400).json({ error: 'Stripe PaymentIntent ID is required.' });
        }
        const result = await stripeGateway.refundPaymentIntent(transactionId);
        return res.json(result);
      }
      return res.status(400).json({ error: 'Unsupported provider.' });
    } catch (err) {
      return res.status(400).json({
        error: err instanceof Error ? err.message : 'Refund processing failed.',
      });
    }
  });

  // Admin Reconciliation: checks pending server-side orders against provider APIs
  app.post('/api/admin/reconcile', requireAdmin, async (_req: AuthRequest, res: Response) => {
    const results: Array<{ provider: string; orderId: string; status: string }> = [];
    for (const record of serverPaymentLedger.values()) {
      if (record.payment_status !== 'pending') continue;
      try {
        if (record.provider === 'cashfree') {
          const cf = await cashfreeGateway.verifyOrderStatus(record.provider_order_id);
          if (cf.status === 'paid') {
            await activatePlacementFromVerifiedPayment({
              uid: record.user_id,
              packageId: record.package_type,
              provider: 'cashfree',
              providerOrderId: record.provider_order_id,
              providerTransactionId: cf.transactionId,
              amountMinor: record.amount,
              currency: 'INR',
              countryCode: record.country_code,
            });
          } else if (cf.status === 'failed') {
            await markPaymentStatusChange({
              provider: 'cashfree',
              providerOrderId: record.provider_order_id,
              status: 'failed',
            });
          }
          results.push({ provider: 'cashfree', orderId: record.provider_order_id, status: cf.status });
        } else if (record.provider === 'paypal') {
          const pp = await paypalGateway.getOrderStatus(record.provider_order_id);
          if (pp.status === 'paid') {
            await activatePlacementFromVerifiedPayment({
              uid: record.user_id,
              packageId: record.package_type,
              provider: 'paypal',
              providerOrderId: record.provider_order_id,
              providerTransactionId: pp.transactionId,
              amountMinor: record.amount,
              currency: 'USD',
              countryCode: record.country_code,
            });
          }
          results.push({ provider: 'paypal', orderId: record.provider_order_id, status: pp.status });
        }
      } catch {
        results.push({
          provider: record.provider,
          orderId: record.provider_order_id,
          status: 'check_failed',
        });
      }
    }
    return res.json({ reconciledCount: results.length, results });
  });

  // Contact Inquiry Route
  const contactSchema = z.object({
    name: z.string().min(2).max(80),
    email: z.string().email().max(120),
    subject: z.string().min(3).max(120),
    message: z.string().min(10).max(2000),
  });

  app.post('/api/contact', rateLimit(10, 60_000), async (req: Request, res: Response) => {
    const parsed = contactSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Please complete all required fields accurately.' });
    }

    let emailSent = false;
    if (resend) {
      try {
        await resend.emails.send({
          from: process.env.RESEND_FROM_EMAIL || 'EgoRank <onboarding@resend.dev>',
          to: process.env.CONTACT_INBOX_EMAIL || 'concierge@egorank.example',
          replyTo: parsed.data.email,
          subject: `[EgoRank Contact] ${parsed.data.subject}`,
          text: `From: ${parsed.data.name} (${parsed.data.email})\n\n${parsed.data.message}`,
        });
        emailSent = true;
      } catch (err) {
        console.error('Contact Resend error:', err);
      }
    }

    return res.json({
      received: true,
      emailSent,
      message: emailSent
        ? 'Your inquiry has been dispatched to the EgoRank concierge team.'
        : 'Your inquiry has been logged by the server. Configure RESEND_API_KEY in .env to enable outbound email dispatch.',
    });
  });

  // Dynamic Server-Side Champion Card SVG Image Endpoint
  app.get('/api/og/champion/:username', (req: Request, res: Response) => {
    const username = escapeXml(
      (req.params.username || 'champion').replace(/[^a-zA-Z0-9_]/g, '').slice(0, 32)
    );
    const displayName = escapeXml(
      (typeof req.query.name === 'string' ? req.query.name : username).slice(0, 48)
    );
    const achievement = escapeXml(
      (typeof req.query.achievement === 'string'
        ? req.query.achievement
        : 'Global EgoRank Competitor'
      ).slice(0, 90)
    );
    const rankLabel = escapeXml(
      (typeof req.query.rank === 'string' ? req.query.rank : '#1').slice(0, 12)
    );
    const tier = escapeXml(
      (typeof req.query.tier === 'string' ? req.query.tier : 'VERIFIED PROFILE').slice(0, 30)
    );

    const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#080808"/>
      <stop offset="60%" stop-color="#12100B"/>
      <stop offset="100%" stop-color="#080808"/>
    </linearGradient>
    <linearGradient id="gold" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#F5DE9B"/>
      <stop offset="50%" stop-color="#D4AF37"/>
      <stop offset="100%" stop-color="#9A7616"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#bg)"/>
  <rect x="32" y="32" width="1136" height="566" rx="16" fill="#151515" stroke="url(#gold)" stroke-opacity="0.45" stroke-width="2"/>
  <rect x="52" y="52" width="1096" height="526" rx="10" fill="none" stroke="#D4AF37" stroke-opacity="0.16" stroke-width="1"/>
  <text x="90" y="118" fill="url(#gold)" font-family="Georgia, serif" font-size="30" font-weight="700" letter-spacing="6">EGORANK</text>
  <text x="90" y="148" fill="#999999" font-family="Arial, sans-serif" font-size="13" letter-spacing="4">PAY. CHALLENGE. DOMINATE.</text>
  <text x="1110" y="124" text-anchor="end" fill="#F5DE9B" font-family="Georgia, serif" font-size="44" font-weight="700">${rankLabel}</text>
  <line x1="90" y1="185" x2="1110" y2="185" stroke="#D4AF37" stroke-opacity="0.22"/>
  <polygon points="90,260 108,224 128,248 148,216 168,248 188,224 206,260 206,274 90,274" fill="url(#gold)"/>
  <text x="90" y="346" fill="#FFFFFF" font-family="Georgia, serif" font-size="56" font-weight="700">${displayName}</text>
  <text x="90" y="392" fill="#D4AF37" font-family="monospace" font-size="24">@${username}</text>
  <text x="90" y="458" fill="#CCCCCC" font-family="Arial, sans-serif" font-size="22">${achievement}</text>
  <line x1="90" y1="510" x2="1110" y2="510" stroke="#D4AF37" stroke-opacity="0.18"/>
  <text x="90" y="550" fill="#999999" font-family="Arial, sans-serif" font-size="16" letter-spacing="3">${tier.toUpperCase()}</text>
  <text x="1110" y="550" text-anchor="end" fill="#D4AF37" font-family="monospace" font-size="16">egorank.app/u/${username}</text>
</svg>`;

    res.setHeader('Content-Type', 'image/svg+xml; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=300');
    return res.send(svg);
  });

  // Dynamic SEO Sitemap & Robots.txt
  app.get('/robots.txt', (req, res) => {
    const baseUrl = process.env.APP_URL || `${req.protocol}://${req.get('host')}`;
    res.type('text/plain');
    return res.send(
      `User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /dashboard\nSitemap: ${baseUrl}/sitemap.xml\n`
    );
  });

  app.get('/sitemap.xml', (req, res) => {
    const baseUrl = process.env.APP_URL || `${req.protocol}://${req.get('host')}`;
    const staticRoutes = [
      '/',
      '/leaderboard',
      '/hall-of-fame',
      '/about',
      '/contact',
      '/checkout',
      '/privacy',
      '/terms',
      '/refund',
    ];
    const urls = staticRoutes
      .map(
        (route) =>
          `  <url>\n    <loc>${baseUrl}${route}</loc>\n    <changefreq>daily</changefreq>\n    <priority>${route === '/' ? '1.0' : '0.8'}</priority>\n  </url>`
      )
      .join('\n');

    res.type('application/xml');
    return res.send(
      `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>`
    );
  });

  // Vite Middleware (dev) or Static Dist (production)
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const port = Number(process.env.PORT) || 3000;
  app.listen(port, '0.0.0.0', () => {
    console.log(`EgoRank server running on http://0.0.0.0:${port}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start EgoRank server:', err);
  process.exit(1);
});
