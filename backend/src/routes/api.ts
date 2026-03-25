import crypto from 'crypto';
import { Router } from 'express';
import { z } from 'zod';

type CartStatus = 'DRAFT' | 'CHECKED_OUT' | 'CANCELLED';
type OrderStatus =
  | 'CREATED'
  | 'PAYMENT_PENDING'
  | 'PAYMENT_VERIFIED'
  | 'PENDING_PHARMACIST'
  | 'APPROVED'
  | 'DISPENSE_QUEUED'
  | 'DISPENSED'
  | 'CANCELLED'
  | 'DISPENSE_FAILED';
type PaymentStatus = 'INITIATED' | 'PENDING_CALLBACK' | 'VERIFIED' | 'FAILED' | 'CANCELLED';
type PharmacistRequestStatus = 'OPEN' | 'APPROVED' | 'REJECTED' | 'EXPIRED' | 'CANCELLED';

type Category = { id: string; displayName: string; iconKey: string; sortOrder: number };
type Suggestion = {
  medicineSkuId: string;
  name: string;
  packSize: string;
  unitPriceCents: number;
  requiresPharmacistReview: boolean;
  confidence: number;
  policyRationale: string;
};

type CartItem = { medicineSkuId: string; qty: number };
type Cart = {
  id: string;
  machineId: string;
  clientPhone?: string;
  status: CartStatus;
  createdAt: number;
  updatedAt: number;
  items: Map<string, CartItem>; // key = medicineSkuId
};

type Order = {
  id: string;
  cartId: string;
  machineId: string;
  clientPhone: string;
  symptomsText?: string;
  status: OrderStatus;
  totalAmountCents: number;
  requiresPharmacistApproval: boolean;
  pharmacistApproved: boolean;
  paymentId?: string;
  createdAt: number;
  updatedAt: number;
};

type Payment = {
  id: string;
  orderId: string;
  provider: 'MPESA';
  phone: string;
  amountCents: number;
  status: PaymentStatus;
  mpesaCheckoutRequestId: string;
  mpesaMerchantRequestId: string;
  createdAt: number;
  updatedAt: number;
};

type PharmacistRequest = {
  id: string;
  orderId: string;
  pharmacistUserId?: string;
  clientPhone: string;
  symptomsText?: string;
  status: PharmacistRequestStatus;
  recommendedItems: Array<{ medicineSkuId: string; qty: number }>;
  createdAt: number;
  updatedAt: number;
};

type Consultation = {
  id: string;
  cartId: string;
  clientPhone: string;
  symptomsText?: string;
  status: 'OPEN' | 'ENDED';
  createdAt: number;
  recommendations: Array<{ medicineSkuId: string; qty: number }>;
};

const categories: Category[] = [
  { id: crypto.randomUUID(), displayName: 'Pain', iconKey: 'pain', sortOrder: 1 },
  { id: crypto.randomUUID(), displayName: 'Stomach', iconKey: 'stomach', sortOrder: 2 },
  { id: crypto.randomUUID(), displayName: 'Cold/Flu', iconKey: 'cold_flu', sortOrder: 3 },
  { id: crypto.randomUUID(), displayName: 'Allergy', iconKey: 'allergy', sortOrder: 4 },
  { id: crypto.randomUUID(), displayName: 'Feminine Care', iconKey: 'feminine', sortOrder: 5 },
  { id: crypto.randomUUID(), displayName: 'Sexual Health', iconKey: 'sexual', sortOrder: 6 },
  { id: crypto.randomUUID(), displayName: 'First Aid', iconKey: 'first_aid', sortOrder: 7 },
  { id: crypto.randomUUID(), displayName: 'Convenience Items', iconKey: 'convenience', sortOrder: 8 }
].sort((a, b) => a.sortOrder - b.sortOrder);

// Sample SKUs (stub data only). Replace with DB-driven catalog later.
const sampleSkus = {
  skuParacetamol500: '00000000-0000-0000-0000-000000000001',
  skuIbuprofen200: '00000000-0000-0000-0000-000000000002',
  skuAntacid: '00000000-0000-0000-0000-000000000003',
  skuCetirizine10: '00000000-0000-0000-0000-000000000004'
} as const;

const skuCatalog: Record<
  string,
  { name: string; packSize: string; unitPriceCents: number; requiresPharmacistReview: boolean }
> = {
  [sampleSkus.skuParacetamol500]: { name: 'Paracetamol', packSize: '500mg', unitPriceCents: 3500, requiresPharmacistReview: false },
  [sampleSkus.skuIbuprofen200]: { name: 'Ibuprofen', packSize: '200mg', unitPriceCents: 4200, requiresPharmacistReview: false },
  [sampleSkus.skuAntacid]: { name: 'Antacid', packSize: 'Chewable', unitPriceCents: 5000, requiresPharmacistReview: true },
  [sampleSkus.skuCetirizine10]: { name: 'Cetirizine', packSize: '10mg', unitPriceCents: 4800, requiresPharmacistReview: true }
};

function calcCartTotalCents(cart: Cart): number {
  let total = 0;
  for (const item of cart.items.values()) {
    const sku = skuCatalog[item.medicineSkuId];
    if (!sku) continue;
    total += sku.unitPriceCents * item.qty;
  }
  return total;
}

function createDispenseDecision(order: Order) {
  // Stub: if pharmacist approval not required, it can dispense immediately after payment verification.
  if (order.requiresPharmacistApproval && !order.pharmacistApproved) return false;
  if (order.status !== 'PAYMENT_VERIFIED' && order.status !== 'APPROVED') return false;
  return true;
}

// In-memory stores (replace with PostgreSQL repositories later)
const carts = new Map<string, Cart>();
const orders = new Map<string, Order>();
const payments = new Map<string, Payment>();
const pharmacistRequests = new Map<string, PharmacistRequest>();
const consultations = new Map<string, Consultation>();

const internalConfig = {
  simulateMpesaCallbackMs: 450
};

export const apiRouter = Router();

// -----------------------------
// Health
// -----------------------------
apiRouter.get('/health', (_req, res) => res.json({ ok: true }));

// -----------------------------
// Client categories
// -----------------------------
apiRouter.get('/client/categories', (_req, res) => {
  res.json({ categories });
});

// -----------------------------
// OTC suggestions
// -----------------------------
const suggestionsBodySchema = z.object({
  categoryId: z.string().uuid(),
  symptomsText: z.string().min(1).max(500).optional(),
  clientPhone: z.string().min(7).max(20).optional()
});

apiRouter.post('/otc/suggestions', (req, res) => {
  const body = suggestionsBodySchema.safeParse(req.body);
  if (!body.success) return res.status(400).json({ code: 'BAD_REQUEST', message: 'Invalid request', details: body.error.flatten() });

  // Stub ranking: base on category iconKey and keyword matches in symptomsText.
  const category = categories.find((c) => c.id === body.data.categoryId);
  const symptoms = (body.data.symptomsText ?? '').toLowerCase();

  const suggestions: Suggestion[] = [];
  if (category?.iconKey === 'pain' || symptoms.includes('pain')) {
    suggestions.push({
      medicineSkuId: sampleSkus.skuParacetamol500,
      name: skuCatalog[sampleSkus.skuParacetamol500].name,
      packSize: skuCatalog[sampleSkus.skuParacetamol500].packSize,
      unitPriceCents: skuCatalog[sampleSkus.skuParacetamol500].unitPriceCents,
      requiresPharmacistReview: false,
      confidence: 0.78,
      policyRationale: 'OTC pain relief option'
    });
    suggestions.push({
      medicineSkuId: sampleSkus.skuIbuprofen200,
      name: skuCatalog[sampleSkus.skuIbuprofen200].name,
      packSize: skuCatalog[sampleSkus.skuIbuprofen200].packSize,
      unitPriceCents: skuCatalog[sampleSkus.skuIbuprofen200].unitPriceCents,
      requiresPharmacistReview: false,
      confidence: 0.64,
      policyRationale: 'OTC anti-inflammatory option'
    });
  } else if (category?.iconKey === 'stomach' || symptoms.includes('stomach') || symptoms.includes('acid')) {
    suggestions.push({
      medicineSkuId: sampleSkus.skuAntacid,
      name: skuCatalog[sampleSkus.skuAntacid].name,
      packSize: skuCatalog[sampleSkus.skuAntacid].packSize,
      unitPriceCents: skuCatalog[sampleSkus.skuAntacid].unitPriceCents,
      requiresPharmacistReview: true,
      confidence: 0.73,
      policyRationale: 'OTC digestive aid (policy requires pharmacist review)'
    });
  } else if (category?.iconKey === 'allergy' || symptoms.includes('allergy') || symptoms.includes('itch')) {
    suggestions.push({
      medicineSkuId: sampleSkus.skuCetirizine10,
      name: skuCatalog[sampleSkus.skuCetirizine10].name,
      packSize: skuCatalog[sampleSkus.skuCetirizine10].packSize,
      unitPriceCents: skuCatalog[sampleSkus.skuCetirizine10].unitPriceCents,
      requiresPharmacistReview: true,
      confidence: 0.75,
      policyRationale: 'OTC allergy symptom relief (policy requires pharmacist review)'
    });
  } else {
    // Fallback generic
    suggestions.push({
      medicineSkuId: sampleSkus.skuParacetamol500,
      name: skuCatalog[sampleSkus.skuParacetamol500].name,
      packSize: skuCatalog[sampleSkus.skuParacetamol500].packSize,
      unitPriceCents: skuCatalog[sampleSkus.skuParacetamol500].unitPriceCents,
      requiresPharmacistReview: false,
      confidence: 0.55,
      policyRationale: 'OTC general relief option'
    });
  }

  res.json({
    suggestions,
    serverDisclaimer: 'OTC vending disclaimer: if symptoms are severe, seek clinical care.'
  });
});

// -----------------------------
// Carts
// -----------------------------
const createCartSchema = z.object({
  machineId: z.string().uuid(),
  clientPhone: z.string().min(7).max(20).optional()
});

apiRouter.post('/carts', (req, res) => {
  const body = createCartSchema.safeParse(req.body);
  if (!body.success) return res.status(400).json({ code: 'BAD_REQUEST', message: 'Invalid request', details: body.error.flatten() });

  const cartId = crypto.randomUUID();
  const now = Date.now();
  carts.set(cartId, {
    id: cartId,
    machineId: body.data.machineId,
    clientPhone: body.data.clientPhone,
    status: 'DRAFT',
    createdAt: now,
    updatedAt: now,
    items: new Map()
  });

  res.status(201).json({ cartId });
});

const addCartItemSchema = z.object({
  medicineSkuId: z.string().uuid(),
  qty: z.number().int().min(1).max(20)
});

apiRouter.post('/carts/:cartId/items', (req, res) => {
  const cartId = req.params.cartId;
  const body = addCartItemSchema.safeParse(req.body);
  if (!body.success) return res.status(400).json({ code: 'BAD_REQUEST', message: 'Invalid request', details: body.error.flatten() });

  const cart = carts.get(cartId);
  if (!cart) return res.status(404).json({ code: 'NOT_FOUND', message: 'Cart not found' });

  const sku = skuCatalog[body.data.medicineSkuId];
  if (!sku) return res.status(400).json({ code: 'INVALID_SKU', message: 'Unknown SKU' });

  const existing = cart.items.get(body.data.medicineSkuId);
  const qty = existing ? existing.qty + body.data.qty : body.data.qty;
  if (qty > 20) return res.status(400).json({ code: 'MAX_QTY_EXCEEDED', message: 'Qty too large' });

  cart.items.set(body.data.medicineSkuId, { medicineSkuId: body.data.medicineSkuId, qty });
  cart.updatedAt = Date.now();

  const totalAmountCents = calcCartTotalCents(cart);
  res.json({
    cart: {
      cartId: cart.id,
      machineId: cart.machineId,
      clientPhone: cart.clientPhone,
      status: cart.status,
      items: Array.from(cart.items.values()),
      totalAmountCents
    }
  });
});

apiRouter.delete('/carts/:cartId/items/:medicineSkuId', (req, res) => {
  const { cartId, medicineSkuId } = req.params;
  const cart = carts.get(cartId);
  if (!cart) return res.status(404).json({ code: 'NOT_FOUND', message: 'Cart not found' });

  cart.items.delete(medicineSkuId);
  cart.updatedAt = Date.now();

  const totalAmountCents = calcCartTotalCents(cart);
  res.json({
    cart: {
      cartId: cart.id,
      machineId: cart.machineId,
      clientPhone: cart.clientPhone,
      status: cart.status,
      items: Array.from(cart.items.values()),
      totalAmountCents
    }
  });
});

// -----------------------------
// Checkout -> Order
// -----------------------------
const checkoutSchema = z.object({
  symptomsText: z.string().min(1).max(500).optional(),
  clientPhone: z.string().min(7).max(20)
});

apiRouter.post('/carts/:cartId/checkout', (req, res) => {
  const cartId = req.params.cartId;
  const body = checkoutSchema.safeParse(req.body);
  if (!body.success) return res.status(400).json({ code: 'BAD_REQUEST', message: 'Invalid request', details: body.error.flatten() });

  const cart = carts.get(cartId);
  if (!cart) return res.status(404).json({ code: 'NOT_FOUND', message: 'Cart not found' });

  if (cart.items.size === 0) return res.status(400).json({ code: 'EMPTY_CART', message: 'Cart has no items' });

  // Policy gating: if any item requires pharmacist review.
  let requiresPharmacistApproval = false;
  for (const item of cart.items.values()) {
    if (skuCatalog[item.medicineSkuId]?.requiresPharmacistReview) {
      requiresPharmacistApproval = true;
      break;
    }
  }

  const totalAmountCents = calcCartTotalCents(cart);
  const orderId = crypto.randomUUID();
  const now = Date.now();

  const order: Order = {
    id: orderId,
    cartId: cart.id,
    machineId: cart.machineId,
    clientPhone: body.data.clientPhone,
    symptomsText: body.data.symptomsText,
    status: requiresPharmacistApproval ? 'PENDING_PHARMACIST' : 'PAYMENT_PENDING',
    totalAmountCents,
    requiresPharmacistApproval,
    pharmacistApproved: !requiresPharmacistApproval,
    createdAt: now,
    updatedAt: now
  };

  orders.set(orderId, order);
  cart.status = 'CHECKED_OUT';
  cart.updatedAt = now;

  if (requiresPharmacistApproval) {
    const requestId = crypto.randomUUID();
    pharmacistRequests.set(requestId, {
      id: requestId,
      orderId: orderId,
      clientPhone: body.data.clientPhone,
      symptomsText: body.data.symptomsText,
      status: 'OPEN',
      recommendedItems: Array.from(cart.items.values()).map((it) => ({ medicineSkuId: it.medicineSkuId, qty: it.qty })),
      createdAt: now,
      updatedAt: now
    });
  }

  res.status(201).json({
    orderId,
    paymentRequired: true,
    requiresPharmacistApproval
  });
});

// -----------------------------
// Payments (M-Pesa STK Push - stub)
// -----------------------------
const stkPushSchema = z.object({
  orderId: z.string().uuid(),
  phone: z.string().min(7).max(20)
});

apiRouter.post('/payments/mpesa/stkpush', (req, res) => {
  const body = stkPushSchema.safeParse(req.body);
  if (!body.success) return res.status(400).json({ code: 'BAD_REQUEST', message: 'Invalid request', details: body.error.flatten() });

  const order = orders.get(body.data.orderId);
  if (!order) return res.status(404).json({ code: 'NOT_FOUND', message: 'Order not found' });
  if (order.status === 'CANCELLED' || order.status === 'DISPENSED') {
    return res.status(400).json({ code: 'ORDER_NOT_ACTIVE', message: `Order is in status ${order.status}` });
  }

  const paymentId = crypto.randomUUID();
  const now = Date.now();
  const checkoutRequestId = crypto.randomBytes(8).toString('hex');
  const merchantRequestId = crypto.randomBytes(8).toString('hex');

  const payment: Payment = {
    id: paymentId,
    orderId: order.id,
    provider: 'MPESA',
    phone: body.data.phone,
    amountCents: order.totalAmountCents,
    status: 'INITIATED',
    mpesaCheckoutRequestId: checkoutRequestId,
    mpesaMerchantRequestId: merchantRequestId,
    createdAt: now,
    updatedAt: now
  };

  payments.set(paymentId, payment);
  order.paymentId = paymentId;
  order.status = 'PAYMENT_PENDING';
  order.updatedAt = now;

  // Simulate asynchronous Daraja callback, so UI can test the status flow.
  setTimeout(() => {
    const p = payments.get(paymentId);
    const o = orders.get(order.id);
    if (!p || !o) return;

    p.status = 'VERIFIED';
    p.updatedAt = Date.now();

    o.status = o.requiresPharmacistApproval ? 'PENDING_PHARMACIST' : 'PAYMENT_VERIFIED';
    o.updatedAt = Date.now();

    // If pharmacist approval already exists, dispense now.
    if (createDispenseDecision(o)) {
      o.status = 'DISPENSED';
      o.updatedAt = Date.now();
    }
  }, internalConfig.simulateMpesaCallbackMs);

  res.status(200).json({
    paymentId,
    checkoutRequestId
  });
});

apiRouter.get('/orders/:orderId/status', (req, res) => {
  const order = orders.get(req.params.orderId);
  if (!order) return res.status(404).json({ code: 'NOT_FOUND', message: 'Order not found' });

  res.json({
    orderId: order.id,
    status: order.status,
    requiresPharmacistApproval: order.requiresPharmacistApproval,
    pharmacistApproved: order.pharmacistApproved,
    totalAmountCents: order.totalAmountCents
  });
});

// -----------------------------
// Pharmacist (approval workflow - stub)
// -----------------------------
apiRouter.get('/pharmacist/requests', (req, res) => {
  const status = String(req.query.status ?? 'OPEN') as PharmacistRequestStatus;
  const data = Array.from(pharmacistRequests.values())
    .filter((r) => r.status === status)
    .sort((a, b) => b.createdAt - a.createdAt);

  res.json({ requests: data });
});

const pharmacistApproveSchema = z.object({
  approvedItems: z.array(z.object({ medicineSkuId: z.string().uuid(), qty: z.number().int().min(1).max(20) })),
  notes: z.string().min(1).max(1000).optional()
});

apiRouter.post('/pharmacist/requests/:requestId/approve', (req, res) => {
  const request = pharmacistRequests.get(req.params.requestId);
  if (!request) return res.status(404).json({ code: 'NOT_FOUND', message: 'Request not found' });

  const body = pharmacistApproveSchema.safeParse(req.body);
  if (!body.success) return res.status(400).json({ code: 'BAD_REQUEST', message: 'Invalid request', details: body.error.flatten() });

  request.status = 'APPROVED';
  request.recommendedItems = body.data.approvedItems;
  request.updatedAt = Date.now();

  const order = orders.get(request.orderId);
  if (order) {
    order.pharmacistApproved = true;
    if (order.paymentId) {
      // If payment already verified, dispense can proceed.
      order.status = order.paymentId ? 'DISPENSED' : 'APPROVED';
      order.updatedAt = Date.now();
    } else {
      order.status = 'APPROVED';
      order.updatedAt = Date.now();
    }
  }

  res.json({ ok: true });
});

apiRouter.post('/pharmacist/requests/:requestId/reject', (req, res) => {
  const request = pharmacistRequests.get(req.params.requestId);
  if (!request) return res.status(404).json({ code: 'NOT_FOUND', message: 'Request not found' });

  const body = z.object({ notes: z.string().min(1).max(1000).optional() }).safeParse(req.body);
  if (!body.success) return res.status(400).json({ code: 'BAD_REQUEST', message: 'Invalid request', details: body.error.flatten() });

  request.status = 'REJECTED';
  request.updatedAt = Date.now();

  const order = orders.get(request.orderId);
  if (order) {
    order.status = 'CANCELLED';
    order.updatedAt = Date.now();
  }

  res.json({ ok: true });
});

// -----------------------------
// Pharmacist consultation (chat-based - stub)
// -----------------------------
const consultationStartSchema = z.object({
  cartId: z.string().uuid(),
  clientPhone: z.string().min(7).max(20),
  symptomsText: z.string().min(1).max(500).optional()
});

apiRouter.post('/pharmacist/consultations/start', (req, res) => {
  const body = consultationStartSchema.safeParse(req.body);
  if (!body.success) return res.status(400).json({ code: 'BAD_REQUEST', message: 'Invalid request', details: body.error.flatten() });

  const consultationId = crypto.randomUUID();
  const now = Date.now();
  consultations.set(consultationId, {
    id: consultationId,
    cartId: body.data.cartId,
    clientPhone: body.data.clientPhone,
    symptomsText: body.data.symptomsText,
    status: 'OPEN',
    createdAt: now,
    recommendations: []
  });

  res.status(201).json({
    consultationId,
    wsRoom: `consultation:${consultationId}`
  });
});

apiRouter.get('/pharmacist/consultations/:consultationId/recommendations', (req, res) => {
  const consultation = consultations.get(req.params.consultationId);
  if (!consultation) return res.status(404).json({ code: 'NOT_FOUND', message: 'Consultation not found' });

  res.json({ recommendations: consultation.recommendations });
});

const consultationRecommendSchema = z.object({
  recommendations: z.array(z.object({ medicineSkuId: z.string().uuid(), qty: z.number().int().min(1).max(20) }))
});

apiRouter.post('/pharmacist/consultations/:consultationId/recommend', (req, res) => {
  const consultation = consultations.get(req.params.consultationId);
  if (!consultation) return res.status(404).json({ code: 'NOT_FOUND', message: 'Consultation not found' });

  const body = consultationRecommendSchema.safeParse(req.body);
  if (!body.success) return res.status(400).json({ code: 'BAD_REQUEST', message: 'Invalid request', details: body.error.flatten() });

  consultation.recommendations = body.data.recommendations;
  res.json({ ok: true });
});

