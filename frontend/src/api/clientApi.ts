import { z } from 'zod';
import { apiFetch, ApiError } from './http';

export const categorySchema = z.object({
  id: z.string().uuid(),
  displayName: z.string(),
  iconKey: z.string(),
  sortOrder: z.number().int()
});

export type Category = z.infer<typeof categorySchema>;

export type Suggestion = {
  medicineSkuId: string;
  name: string;
  packSize: string;
  unitPriceCents: number;
  requiresPharmacistReview: boolean;
  confidence: number;
  policyRationale: string;
};

const suggestionSchema = z.object({
  medicineSkuId: z.string().uuid(),
  name: z.string(),
  packSize: z.string(),
  unitPriceCents: z.number().int().nonnegative(),
  requiresPharmacistReview: z.boolean(),
  confidence: z.number(),
  policyRationale: z.string()
});

const suggestionsResponseSchema = z.object({
  suggestions: z.array(suggestionSchema),
  serverDisclaimer: z.string()
});

export async function getCategories(): Promise<Category[]> {
  const res = await apiFetch('/api/client/categories', {
    method: 'GET'
  });
  const schema = z.object({ categories: z.array(categorySchema) });
  return schema.parse(res).categories;
}

export const otcSuggestionsRequestSchema = z.object({
  categoryId: z.string().uuid(),
  symptomsText: z.string().min(1).max(500).optional()
});

export async function getOtcSuggestions(input: z.infer<typeof otcSuggestionsRequestSchema>): Promise<{
  suggestions: Suggestion[];
  serverDisclaimer: string;
}> {
  const body = otcSuggestionsRequestSchema.parse(input);
  const res = await apiFetch('/api/otc/suggestions', {
    method: 'POST',
    body: JSON.stringify(body)
  });

  const parsed = suggestionsResponseSchema.parse(res);
  return parsed;
}

// -----------------------------
// Cart
// -----------------------------
export const createCartRequestSchema = z.object({
  machineId: z.string().uuid(),
  clientPhone: z.string().optional()
});

const createCartResponseSchema = z.object({
  cartId: z.string().uuid()
});

export async function createCart(input: z.infer<typeof createCartRequestSchema>): Promise<string> {
  const body = createCartRequestSchema.parse(input);
  const res = await apiFetch('/api/carts', { method: 'POST', body: JSON.stringify(body) });
  return createCartResponseSchema.parse(res).cartId;
}

export const addCartItemRequestSchema = z.object({
  cartId: z.string().uuid(),
  medicineSkuId: z.string().uuid(),
  qty: z.number().int().min(1).max(20)
});

export async function addCartItem(input: z.infer<typeof addCartItemRequestSchema>): Promise<void> {
  const body = addCartItemRequestSchema.parse(input);
  await apiFetch(`/api/carts/${body.cartId}/items`, {
    method: 'POST',
    body: JSON.stringify({ medicineSkuId: body.medicineSkuId, qty: body.qty })
  });
}

export async function removeCartItem(params: { cartId: string; medicineSkuId: string }): Promise<void> {
  await apiFetch(`/api/carts/${params.cartId}/items/${params.medicineSkuId}`, { method: 'DELETE' });
}

// -----------------------------
// Checkout / Order
// -----------------------------
export const checkoutCartRequestSchema = z.object({
  cartId: z.string().uuid(),
  clientPhone: z.string().min(7).max(20),
  symptomsText: z.string().min(1).max(500).optional()
});

const checkoutResponseSchema = z.object({
  orderId: z.string().uuid(),
  paymentRequired: z.boolean(),
  requiresPharmacistApproval: z.boolean()
});

export async function checkoutCart(input: z.infer<typeof checkoutCartRequestSchema>): Promise<{
  orderId: string;
  paymentRequired: boolean;
  requiresPharmacistApproval: boolean;
}> {
  const body = checkoutCartRequestSchema.parse(input);
  const res = await apiFetch(`/api/carts/${body.cartId}/checkout`, {
    method: 'POST',
    body: JSON.stringify({ clientPhone: body.clientPhone, symptomsText: body.symptomsText })
  });
  return checkoutResponseSchema.parse(res);
}

// -----------------------------
// Payments
// -----------------------------
export const stkPushRequestSchema = z.object({
  orderId: z.string().uuid(),
  phone: z.string().min(7).max(20)
});

export async function stkPush(input: z.infer<typeof stkPushRequestSchema>): Promise<{
  paymentId: string;
  checkoutRequestId: string;
}> {
  const body = stkPushRequestSchema.parse(input);
  const res = await apiFetch('/api/payments/mpesa/stkpush', {
    method: 'POST',
    body: JSON.stringify(body)
  });

  const schema = z.object({
    paymentId: z.string().uuid(),
    checkoutRequestId: z.string()
  });
  return schema.parse(res);
}

const orderStatusResponseSchema = z.object({
  orderId: z.string().uuid(),
  status: z.string(),
  requiresPharmacistApproval: z.boolean(),
  pharmacistApproved: z.boolean(),
  totalAmountCents: z.number().int()
});

export async function getOrderStatus(orderId: string): Promise<z.infer<typeof orderStatusResponseSchema>> {
  const res = await apiFetch(`/api/orders/${orderId}/status`, { method: 'GET' });
  return orderStatusResponseSchema.parse(res);
}

// -----------------------------
// Pharmacist consultation
// -----------------------------
const consultationStartRequestSchema = z.object({
  cartId: z.string().uuid(),
  clientPhone: z.string().min(7).max(20),
  symptomsText: z.string().min(1).max(500).optional()
});

const consultationStartResponseSchema = z.object({
  consultationId: z.string().uuid(),
  wsRoom: z.string()
});

export async function startConsultation(input: z.infer<typeof consultationStartRequestSchema>): Promise<{
  consultationId: string;
  wsRoom: string;
}> {
  const body = consultationStartRequestSchema.parse(input);
  const res = await apiFetch('/api/pharmacist/consultations/start', {
    method: 'POST',
    body: JSON.stringify(body)
  });
  return consultationStartResponseSchema.parse(res);
}

const consultationRecommendationsResponseSchema = z.object({
  recommendations: z.array(z.object({ medicineSkuId: z.string().uuid(), qty: z.number().int().min(1).max(20) }))
});

export async function getConsultationRecommendations(consultationId: string): Promise<
  Array<{ medicineSkuId: string; qty: number }>
> {
  const res = await apiFetch(`/api/pharmacist/consultations/${consultationId}/recommendations`, { method: 'GET' });
  return consultationRecommendationsResponseSchema.parse(res).recommendations;
}

// -----------------------------
// Pharmacist request approvals (dashboard)
// -----------------------------
const pharmacistRequestSchema = z.object({
  id: z.string().uuid(),
  orderId: z.string().uuid(),
  clientPhone: z.string(),
  status: z.string(),
  recommendedItems: z
    .array(
      z.object({
        medicineSkuId: z.string().uuid(),
        qty: z.number().int().min(1).max(20)
      })
    )
    .optional()
});

export async function getOpenPharmacistRequests(status: string = 'OPEN'): Promise<z.infer<typeof pharmacistRequestSchema>[]> {
  const res = await apiFetch(`/api/pharmacist/requests?status=${encodeURIComponent(status)}`, { method: 'GET' });
  const schema = z.object({ requests: z.array(pharmacistRequestSchema) });
  return schema.parse(res).requests;
}

export async function approvePharmacistRequest(params: {
  requestId: string;
  approvedItems: Array<{ medicineSkuId: string; qty: number }>;
  notes?: string;
}): Promise<void> {
  const reqIdSchema = z.string().uuid();
  reqIdSchema.parse(params.requestId);
  const itemsSchema = z.array(z.object({ medicineSkuId: z.string().uuid(), qty: z.number().int().min(1).max(20) }));
  itemsSchema.parse(params.approvedItems);
  await apiFetch(`/api/pharmacist/requests/${params.requestId}/approve`, {
    method: 'POST',
    body: JSON.stringify({ approvedItems: params.approvedItems, notes: params.notes })
  });
}

export async function rejectPharmacistRequest(params: { requestId: string; notes?: string }): Promise<void> {
  await apiFetch(`/api/pharmacist/requests/${params.requestId}/reject`, {
    method: 'POST',
    body: JSON.stringify({ notes: params.notes })
  });
}

export { ApiError };

