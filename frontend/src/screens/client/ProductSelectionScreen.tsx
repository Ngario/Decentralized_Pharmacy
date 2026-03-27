import React, { useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  addCartItem,
  createCart,
  getOtcSuggestions,
  getOrderStatus,
  getCategories,
  getOpenPharmacistRequests,
  removeCartItem,
  startConsultation
} from '../../api/clientApi';
import type { Suggestion } from '../../api/clientApi';

type RouteState = { categoryId?: string };

export default function ProductSelectionScreen() {
  const navigate = useNavigate();
  const location = useLocation();
  const state = (location.state as RouteState) || {};

  const machineId = '11111111-1111-1111-1111-111111111111';
  const [clientPhone, setClientPhone] = useState('254700000000');
  const [categoryId, setCategoryId] = useState<string | null>(state.categoryId ?? null);
  const [symptomsText, setSymptomsText] = useState('');

  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [serverDisclaimer, setServerDisclaimer] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  const [cartId, setCartId] = useState<string | null>(null);
  const [cartItems, setCartItems] = useState<Array<{ medicineSkuId: string; qty: number; suggestion?: Suggestion }>>([]);

  const cartTotalCents = useMemo(() => {
    return cartItems.reduce((sum, it) => sum + (it.suggestion?.unitPriceCents ?? 0) * it.qty, 0);
  }, [cartItems]);

  async function ensureCart() {
    if (cartId) return cartId;
    const created = await createCart({ machineId, clientPhone });
    setCartId(created);
    return created;
  }

  async function handleGetSuggestions() {
    if (!categoryId) {
      setError('Choose a category first.');
      return;
    }
    setError(null);
    setLoadingSuggestions(true);
    try {
      const res = await getOtcSuggestions({ categoryId, symptomsText: symptomsText.trim() ? symptomsText.trim() : undefined });
      setSuggestions(res.suggestions);
      setServerDisclaimer(res.serverDisclaimer);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to get suggestions');
      setSuggestions([]);
      setServerDisclaimer('');
    } finally {
      setLoadingSuggestions(false);
    }
  }

  async function handleAddToCart(suggestion: Suggestion) {
    const createdCartId = await ensureCart();
    await addCartItem({ cartId: createdCartId, medicineSkuId: suggestion.medicineSkuId, qty: 1 });

    setCartItems((prev) => {
      const existing = prev.find((p) => p.medicineSkuId === suggestion.medicineSkuId);
      if (existing) {
        return prev.map((p) => (p.medicineSkuId === suggestion.medicineSkuId ? { ...p, qty: p.qty + 1, suggestion } : p));
      }
      return [...prev, { medicineSkuId: suggestion.medicineSkuId, qty: 1, suggestion }];
    });
  }

  async function handleRemove(medicineSkuId: string) {
    if (!cartId) return;
    await removeCartItem({ cartId, medicineSkuId });
    setCartItems((prev) => prev.filter((p) => p.medicineSkuId !== medicineSkuId));
  }

  async function handleConsultant() {
    if (!cartId) {
      const createdCartId = await ensureCart();
      // cartId state update is async; we will continue with createdCartId
      await consultWithPharmacist(createdCartId);
      return;
    }
    await consultWithPharmacist(cartId);
  }

  async function consultWithPharmacist(existingCartId: string) {
    const res = await startConsultation({ cartId: existingCartId, clientPhone, symptomsText: symptomsText.trim() ? symptomsText.trim() : undefined });
    navigate('/consult', { state: { consultationId: res.consultationId, cartId: existingCartId } });
  }

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto">
      <button
        type="button"
        onClick={() => navigate('/')}
        className="mb-5 inline-flex items-center px-4 py-2 rounded-lg bg-white/70 hover:bg-white/90 border border-white/60 shadow-card text-gray-900 font-semibold transition"
      >
        Back
      </button>

      <h2 className="text-2xl font-extrabold text-gray-900">Choose products</h2>

      <div className="mt-5 mb-4 space-y-2">
        <label className="block text-sm font-semibold text-gray-800 mb-2">Phone number (M-Pesa)</label>
        <input
          value={clientPhone}
          onChange={(e) => setClientPhone(e.target.value)}
          className="w-full rounded-lg border border-white/60 bg-white/80 backdrop-blur px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-brandPrimary/30"
        />
      </div>

      <div className="mt-4 mb-4 space-y-2">
        <label className="block text-sm font-semibold text-gray-800 mb-2">Symptoms (optional)</label>
        <textarea
          value={symptomsText}
          onChange={(e) => setSymptomsText(e.target.value)}
          className="w-full rounded-lg border border-white/60 bg-white/80 backdrop-blur px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-brandPrimary/30 min-h-[80px]"
        />
      </div>

      <div className="mt-4 mb-4">
        <button
          type="button"
          onClick={handleGetSuggestions}
          disabled={loadingSuggestions}
          className="w-full rounded-lg bg-brandPrimary text-white px-4 py-3 font-bold hover:bg-brandPrimary/90 disabled:opacity-70 disabled:cursor-not-allowed transition"
        >
          {loadingSuggestions ? 'Getting suggestions…' : 'Get OTC suggestions'}
        </button>
      </div>

      {serverDisclaimer ? (
        <div className="text-sm text-gray-700 mb-4">{serverDisclaimer}</div>
      ) : null}

      {error ? <div className="text-sm text-red-700 mb-4">{error}</div> : null}

      <h3 className="mt-6 mb-3 text-xl font-extrabold text-gray-900">Suggestions</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
        {suggestions.map((s) => (
          <div key={s.medicineSkuId} className="rounded-xl border border-white/60 bg-white/80 backdrop-blur shadow-card p-4">
            <div className="font-bold text-gray-900">{s.name}</div>
            <div className="text-sm text-gray-600 mt-1">{s.packSize}</div>
            <div className="mt-3 text-base font-extrabold text-gray-900">
              KSh {Math.round(s.unitPriceCents / 100)}.00
            </div>
            {s.requiresPharmacistReview ? (
              <div className="mt-2 text-xs font-semibold text-brandAccent">Pharmacist review required</div>
            ) : null}
            <button
              type="button"
              onClick={() => handleAddToCart(s)}
              className="mt-3 w-full rounded-lg bg-white/90 border border-white/70 hover:bg-white px-3 py-2 font-bold text-gray-900 transition"
            >
              Add to cart
            </button>
          </div>
        ))}
      </div>

      <div className="mt-8 pt-5 border-t border-white/50">
        <h3 className="text-xl font-extrabold text-gray-900">Cart</h3>
        {cartItems.length === 0 ? <div>No items yet.</div> : null}
        <div className="grid gap-3 mt-4">
          {cartItems.map((it) => (
            <div key={it.medicineSkuId} className="flex items-center justify-between gap-3">
              <div>
                <div className="font-bold text-gray-900">{it.suggestion?.name ?? it.medicineSkuId}</div>
                <div className="text-sm text-gray-600 mt-1">Qty: {it.qty}</div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={async () => {
                    // MVP: remove then re-add; later implement qty stepper endpoint.
                    await handleRemove(it.medicineSkuId);
                  }}
                  type="button"
                  className="px-3 py-2 rounded-lg border border-white/60 bg-white/70 hover:bg-white/90 transition text-gray-900 font-semibold"
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-5 text-lg font-extrabold text-gray-900">
          Total: KSh {Math.round(cartTotalCents / 100)}.00
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-2">
          <button
            type="button"
            onClick={async () => {
              if (!cartId) {
                alert('Add an item to cart first.');
                return;
              }
              navigate('/cart', { state: { cartId, cartItems } });
            }}
            className="w-full rounded-lg bg-brandPrimary text-white px-4 py-3 font-bold hover:bg-brandPrimary/90 transition"
          >
            Checkout
          </button>

          <button
            type="button"
            onClick={handleConsultant}
            className="w-full rounded-lg bg-white/80 border border-white/60 px-4 py-3 font-bold text-gray-900 hover:bg-white/95 transition"
          >
            Call/Chat with Pharmacist
          </button>
        </div>
      </div>
    </div>
  );
}

