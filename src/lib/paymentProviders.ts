import crypto from 'crypto';
import Stripe from 'stripe';

export type PaymentProvider = 'cashfree' | 'paypal' | 'stripe';
export type PaymentCurrency = 'INR' | 'USD';
export type PackageId = 'featured_7d' | 'premium_30d' | 'sponsored';

export interface PackageDefinition {
  id: PackageId;
  name: string;
  durationDays: number;
  tier: 'featured_7d' | 'premium_30d' | 'sponsored';
  description: string;
  pricing: {
    INR: number; // paise
    USD: number; // cents
  };
}

export const PACKAGE_CATALOG: Record<PackageId, PackageDefinition> = {
  featured_7d: {
    id: 'featured_7d',
    name: 'Featured Profile — 7 Days',
    durationDays: 7,
    tier: 'featured_7d',
    description: 'Featured gold spotlight on the Global Leaderboard and Homepage for 7 days.',
    pricing: {
      INR: 39900, // ₹399
      USD: 500,   // $5.00
    },
  },
  premium_30d: {
    id: 'premium_30d',
    name: 'Premium Profile — 30 Days',
    durationDays: 30,
    tier: 'premium_30d',
    description: 'Priority gold placement, Featured Profile crest, and 30 days of amplified visibility.',
    pricing: {
      INR: 119900, // ₹1,199
      USD: 1500,   // $15.00
    },
  },
  sponsored: {
    id: 'sponsored',
    name: 'Custom Sponsored Placement — 30 Days',
    durationDays: 30,
    tier: 'sponsored',
    description: 'Executive sponsored placement at the top of Featured Profiles & Hall of Fame.',
    pricing: {
      INR: 399900, // ₹3,999
      USD: 4900,   // $49.00
    },
  },
};

export const SUPPORTED_COUNTRIES = [
  { code: 'IN', name: 'India', currency: 'INR' as PaymentCurrency, provider: 'cashfree' as PaymentProvider },
  { code: 'US', name: 'United States', currency: 'USD' as PaymentCurrency, provider: 'paypal' as PaymentProvider },
  { code: 'GB', name: 'United Kingdom', currency: 'USD' as PaymentCurrency, provider: 'paypal' as PaymentProvider },
  { code: 'CA', name: 'Canada', currency: 'USD' as PaymentCurrency, provider: 'paypal' as PaymentProvider },
  { code: 'SG', name: 'Singapore', currency: 'USD' as PaymentCurrency, provider: 'paypal' as PaymentProvider },
  { code: 'AE', name: 'United Arab Emirates', currency: 'USD' as PaymentCurrency, provider: 'paypal' as PaymentProvider },
  { code: 'AU', name: 'Australia', currency: 'USD' as PaymentCurrency, provider: 'paypal' as PaymentProvider },
  { code: 'DE', name: 'Germany', currency: 'USD' as PaymentCurrency, provider: 'paypal' as PaymentProvider },
  { code: 'FR', name: 'France', currency: 'USD' as PaymentCurrency, provider: 'paypal' as PaymentProvider },
  { code: 'JP', name: 'Japan', currency: 'USD' as PaymentCurrency, provider: 'paypal' as PaymentProvider },
] as const;

export function resolveCountryCheckoutContext(rawCountryCode?: string | null): {
  countryCode: string;
  countryName: string;
  currency: PaymentCurrency;
  provider: PaymentProvider;
} {
  const normalized = (rawCountryCode || 'US').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 2);
  if (normalized === 'IN') {
    return {
      countryCode: 'IN',
      countryName: 'India',
      currency: 'INR',
      provider: 'cashfree',
    };
  }
  const matched = SUPPORTED_COUNTRIES.find((c) => c.code === normalized);
  return {
    countryCode: normalized.length === 2 ? normalized : 'US',
    countryName: matched?.name || 'International',
    currency: 'USD',
    provider: 'paypal',
  };
}

export interface GatewayConfigStatus {
  cashfreeConfigured: boolean;
  cashfreeEnv: 'sandbox' | 'production';
  paypalConfigured: boolean;
  paypalEnv: 'sandbox' | 'live';
  stripeConfigured: boolean;
  stripeEnv: 'test' | 'live';
}

export function getGatewayConfigStatus(): GatewayConfigStatus {
  const cfId = process.env.CASHFREE_CLIENT_ID || '';
  const cfSecret = process.env.CASHFREE_CLIENT_SECRET || '';
  const cfConfigured =
    cfId.length > 6 &&
    cfSecret.length > 6 &&
    !cfId.includes('your_cashfree') &&
    !cfSecret.includes('your_cashfree');

  const ppId = process.env.PAYPAL_CLIENT_ID || '';
  const ppSecret = process.env.PAYPAL_CLIENT_SECRET || '';
  const ppConfigured =
    ppId.length > 6 &&
    ppSecret.length > 6 &&
    !ppId.includes('your_paypal') &&
    !ppSecret.includes('your_paypal');

  const stripeKey = process.env.STRIPE_SECRET_KEY || '';
  const stripeConfigured = stripeKey.startsWith('sk_test_') || stripeKey.startsWith('sk_live_');

  return {
    cashfreeConfigured: cfConfigured,
    cashfreeEnv: process.env.CASHFREE_ENV === 'production' ? 'production' : 'sandbox',
    paypalConfigured: ppConfigured,
    paypalEnv: process.env.PAYPAL_ENV === 'live' ? 'live' : 'sandbox',
    stripeConfigured,
    stripeEnv: stripeKey.startsWith('sk_live_') ? 'live' : 'test',
  };
}

// ============================================================================
// 1. CASHFREE GATEWAY (India — INR / UPI / Domestic Cards)
// ============================================================================
export class CashfreeGateway {
  private baseUrl: string;
  private clientId: string;
  private clientSecret: string;
  private webhookSecret: string;

  constructor() {
    const env = process.env.CASHFREE_ENV === 'production' ? 'production' : 'sandbox';
    this.baseUrl =
      env === 'production' ? 'https://api.cashfree.com/pg' : 'https://sandbox.cashfree.com/pg';
    this.clientId = process.env.CASHFREE_CLIENT_ID || '';
    this.clientSecret = process.env.CASHFREE_CLIENT_SECRET || '';
    this.webhookSecret = process.env.CASHFREE_WEBHOOK_SECRET || this.clientSecret;
  }

  private headers(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'x-api-version': '2023-08-01',
      'x-client-id': this.clientId,
      'x-client-secret': this.clientSecret,
    };
  }

  async createOrder(params: {
    orderId: string;
    amountPaise: number;
    customerUid: string;
    customerEmail: string;
    customerName: string;
    customerPhone?: string;
    returnUrl: string;
    notifyUrl: string;
    packageId: PackageId;
  }) {
    const res = await fetch(`${this.baseUrl}/orders`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({
        order_id: params.orderId,
        order_amount: Number((params.amountPaise / 100).toFixed(2)),
        order_currency: 'INR',
        customer_details: {
          customer_id: params.customerUid.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 48),
          customer_email: params.customerEmail,
          customer_name: params.customerName.slice(0, 80),
          customer_phone: params.customerPhone || '9999999999',
        },
        order_meta: {
          return_url: params.returnUrl,
          notify_url: params.notifyUrl,
          payment_methods: 'cc,dc,upi,nb',
        },
        order_tags: {
          package_id: params.packageId,
          uid: params.customerUid,
        },
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data?.message || 'Cashfree order creation failed.');
    }

    return {
      providerOrderId: data.order_id as string,
      paymentSessionId: data.payment_session_id as string,
      checkoutUrl:
        (data.payment_link as string | undefined) ||
        (process.env.CASHFREE_ENV === 'production'
          ? `https://payments.cashfree.com/forms?payment_session_id=${encodeURIComponent(data.payment_session_id)}`
          : `https://sandbox.cashfree.com/pg/view/sessions/checkout?payment_session_id=${encodeURIComponent(data.payment_session_id)}`),
    };
  }

  async verifyOrderStatus(orderId: string): Promise<{
    status: 'paid' | 'pending' | 'failed';
    transactionId: string;
    rawStatus: string;
  }> {
    const res = await fetch(`${this.baseUrl}/orders/${encodeURIComponent(orderId)}`, {
      method: 'GET',
      headers: this.headers(),
    });
    const orderData = await res.json();
    if (!res.ok) {
      throw new Error(orderData?.message || 'Failed to retrieve Cashfree order.');
    }

    let transactionId = '';
    const paymentsRes = await fetch(
      `${this.baseUrl}/orders/${encodeURIComponent(orderId)}/payments`,
      { method: 'GET', headers: this.headers() }
    );
    if (paymentsRes.ok) {
      const paymentsList = await paymentsRes.json();
      if (Array.isArray(paymentsList) && paymentsList.length > 0) {
        const successPayment =
          paymentsList.find((p) => p.payment_status === 'SUCCESS') || paymentsList[0];
        transactionId = String(successPayment.cf_payment_id || '');
      }
    }

    const rawStatus = String(orderData.order_status || 'ACTIVE');
    const status =
      rawStatus === 'PAID'
        ? 'paid'
        : rawStatus === 'EXPIRED' || rawStatus === 'TERMINATED'
        ? 'failed'
        : 'pending';

    return { status, transactionId, rawStatus };
  }

  verifyWebhookSignature(rawBody: string, timestamp: string, signatureHeader: string): boolean {
    if (!this.webhookSecret || !timestamp || !signatureHeader) return false;
    const payload = `${timestamp}${rawBody}`;
    const expectedDigest = crypto
      .createHmac('sha256', this.webhookSecret)
      .update(payload)
      .digest('base64');

    const a = Buffer.from(expectedDigest);
    const b = Buffer.from(signatureHeader);
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  }

  async refundOrder(params: { orderId: string; amountPaise: number; refundId: string; note?: string }) {
    const res = await fetch(`${this.baseUrl}/orders/${encodeURIComponent(params.orderId)}/refunds`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({
        refund_amount: Number((params.amountPaise / 100).toFixed(2)),
        refund_id: params.refundId,
        refund_note: params.note || 'Admin initiated refund',
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data?.message || 'Cashfree refund failed.');
    }
    return {
      refundId: String(data.cf_refund_id || params.refundId),
      status: String(data.refund_status || 'PENDING'),
    };
  }
}

// ============================================================================
// 2. PAYPAL GATEWAY (International — USD)
// ============================================================================
export class PayPalGateway {
  private baseUrl: string;
  private clientId: string;
  private clientSecret: string;
  private webhookId: string;

  constructor() {
    const env = process.env.PAYPAL_ENV === 'live' ? 'live' : 'sandbox';
    this.baseUrl =
      env === 'live' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com';
    this.clientId = process.env.PAYPAL_CLIENT_ID || '';
    this.clientSecret = process.env.PAYPAL_CLIENT_SECRET || '';
    this.webhookId = process.env.PAYPAL_WEBHOOK_ID || '';
  }

  async getAccessToken(): Promise<string> {
    const auth = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');
    const res = await fetch(`${this.baseUrl}/v1/oauth2/token`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
    });
    const data = await res.json();
    if (!res.ok || !data.access_token) {
      throw new Error(data?.error_description || 'Failed to authenticate with PayPal OAuth2.');
    }
    return data.access_token as string;
  }

  async createOrder(params: {
    internalOrderId: string;
    amountCents: number;
    packageName: string;
    packageId: PackageId;
    uid: string;
    returnUrl: string;
    cancelUrl: string;
  }) {
    const token = await this.getAccessToken();
    const res = await fetch(`${this.baseUrl}/v2/checkout/orders`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'PayPal-Request-Id': params.internalOrderId,
      },
      body: JSON.stringify({
        intent: 'CAPTURE',
        purchase_units: [
          {
            reference_id: params.internalOrderId,
            custom_id: JSON.stringify({ uid: params.uid, packageId: params.packageId }),
            description: `EgoRank — ${params.packageName}`,
            amount: {
              currency_code: 'USD',
              value: (params.amountCents / 100).toFixed(2),
            },
          },
        ],
        application_context: {
          brand_name: 'EgoRank',
          landing_page: 'LOGIN',
          user_action: 'PAY_NOW',
          return_url: params.returnUrl,
          cancel_url: params.cancelUrl,
        },
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data?.message || 'PayPal order creation failed.');
    }

    const approveLink = Array.isArray(data.links)
      ? data.links.find((l: { rel: string; href: string }) => l.rel === 'approve')?.href
      : undefined;

    return {
      providerOrderId: data.id as string,
      approvalUrl: approveLink || '',
      status: data.status as string,
    };
  }

  async captureOrder(paypalOrderId: string): Promise<{
    status: 'paid' | 'pending' | 'failed';
    transactionId: string;
    amountCents: number;
    uid?: string;
    packageId?: PackageId;
  }> {
    const token = await this.getAccessToken();
    const res = await fetch(
      `${this.baseUrl}/v2/checkout/orders/${encodeURIComponent(paypalOrderId)}/capture`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }
    );
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data?.message || 'PayPal order capture failed.');
    }

    const unit = data.purchase_units?.[0];
    const capture = unit?.payments?.captures?.[0];
    const transactionId = String(capture?.id || '');
    const valueStr = capture?.amount?.value || unit?.amount?.value || '0';
    const amountCents = Math.round(Number(valueStr) * 100);

    let uid: string | undefined;
    let packageId: PackageId | undefined;
    try {
      const parsed = JSON.parse(capture?.custom_id || unit?.custom_id || '{}');
      uid = parsed.uid;
      packageId = parsed.packageId;
    } catch {
      // Ignore malformed custom_id
    }

    const status =
      data.status === 'COMPLETED' && capture?.status === 'COMPLETED'
        ? 'paid'
        : data.status === 'VOIDED'
        ? 'failed'
        : 'pending';

    return { status, transactionId, amountCents, uid, packageId };
  }

  async getOrderStatus(paypalOrderId: string): Promise<{
    status: 'paid' | 'pending' | 'failed';
    transactionId: string;
    rawStatus: string;
  }> {
    const token = await this.getAccessToken();
    const res = await fetch(`${this.baseUrl}/v2/checkout/orders/${encodeURIComponent(paypalOrderId)}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data?.message || 'Unable to fetch PayPal order.');
    }
    const capture = data.purchase_units?.[0]?.payments?.captures?.[0];
    const rawStatus = String(data.status || 'CREATED');
    const status =
      rawStatus === 'COMPLETED'
        ? 'paid'
        : rawStatus === 'VOIDED'
        ? 'failed'
        : 'pending';
    return { status, transactionId: String(capture?.id || ''), rawStatus };
  }

  async verifyWebhookSignature(headers: Record<string, string | string[] | undefined>, webhookEvent: unknown): Promise<boolean> {
    if (!this.webhookId) return false;
    const token = await this.getAccessToken();
    const res = await fetch(`${this.baseUrl}/v1/notifications/verify-webhook-signature`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        auth_algo: headers['paypal-auth-algo'],
        cert_url: headers['paypal-cert-url'],
        transmission_id: headers['paypal-transmission-id'],
        transmission_sig: headers['paypal-transmission-sig'],
        transmission_time: headers['paypal-transmission-time'],
        webhook_id: this.webhookId,
        webhook_event: webhookEvent,
      }),
    });
    if (!res.ok) return false;
    const data = await res.json();
    return data.verification_status === 'SUCCESS';
  }

  async refundCapture(captureId: string, amountCents?: number, note?: string) {
    const token = await this.getAccessToken();
    const body = amountCents
      ? {
          amount: { value: (amountCents / 100).toFixed(2), currency_code: 'USD' },
          note_to_payer: note || 'EgoRank refund processed',
        }
      : { note_to_payer: note || 'EgoRank refund processed' };

    const res = await fetch(
      `${this.baseUrl}/v2/payments/captures/${encodeURIComponent(captureId)}/refund`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      }
    );
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data?.message || 'PayPal refund failed.');
    }
    return {
      refundId: String(data.id || ''),
      status: String(data.status || 'COMPLETED'),
    };
  }
}

// ============================================================================
// 3. MODULAR STRIPE ADAPTER (Ready when approved)
// ============================================================================
export class StripeGateway {
  private client: Stripe | null;
  private webhookSecret: string;

  constructor() {
    const key = process.env.STRIPE_SECRET_KEY || '';
    this.client =
      key.startsWith('sk_test_') || key.startsWith('sk_live_') ? new Stripe(key) : null;
    this.webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || '';
  }

  isConfigured(): boolean {
    return Boolean(this.client);
  }

  constructWebhookEvent(rawBody: Buffer, signature: string): Stripe.Event {
    if (!this.client || !this.webhookSecret.startsWith('whsec_')) {
      throw new Error('Stripe webhook is not configured.');
    }
    return this.client.webhooks.constructEvent(rawBody, signature, this.webhookSecret);
  }

  async refundPaymentIntent(paymentIntentId: string) {
    if (!this.client) throw new Error('Stripe is not configured.');
    const refund = await this.client.refunds.create({
      payment_intent: paymentIntentId,
      reason: 'requested_by_customer',
    });
    return { refundId: refund.id, status: refund.status || 'succeeded' };
  }
}
