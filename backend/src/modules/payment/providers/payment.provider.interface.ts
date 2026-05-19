/**
 * Provider-agnostic contract for payment providers.
 * Add Stripe, Razorpay, or any future gateway by implementing this interface.
 */

export interface CreateOrderInput {
  amount: number;        // In smallest currency unit (paise for INR, cents for USD)
  currency: string;      // "USD" | "INR" etc.
  planId: string;
  userId: string;
  userEmail: string;
  metadata?: Record<string, string>;
}

export interface CreateOrderResult {
  orderId: string;       // Provider-specific order/session ID
  amount: number;
  currency: string;
  providerData: Record<string, unknown>; // Returned to frontend for checkout
}

export interface VerifyPaymentInput {
  orderId: string;
  paymentId: string;
  signature?: string;    // Required by Razorpay, optional for Stripe
}

export interface VerifyPaymentResult {
  verified: boolean;
  providerPaymentId: string;
  amount: number;
  currency: string;
  metadata: Record<string, unknown>;
}

export interface WebhookEvent {
  type: string;                          // Normalized event type
  providerPaymentId: string;
  providerOrderId?: string;
  userId?: string;
  planId?: string;
  amount: number;
  currency: string;
  idempotencyKey: string;
  rawPayload: Record<string, unknown>;
}

export interface PaymentProvider {
  readonly name: 'stripe' | 'razorpay';

  /**
   * Create a payment order/session on the provider side.
   */
  createOrder(input: CreateOrderInput): Promise<CreateOrderResult>;

  /**
   * Verify a payment (client-side confirmation).
   */
  verifyPayment(input: VerifyPaymentInput): Promise<VerifyPaymentResult>;

  /**
   * Parse and verify a raw webhook payload.
   * Returns null if the event is not a payment completion event.
   */
  parseWebhookEvent(
    rawBody: Buffer,
    signature: string,
  ): Promise<WebhookEvent | null>;
}
