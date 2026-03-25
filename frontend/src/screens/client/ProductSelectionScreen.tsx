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
    <div style={{ padding: 16 }}>
      <button onClick={() => navigate('/')} style={{ marginBottom: 12 }}>
        Back
      </button>

      <h2>Choose products</h2>

      <div style={{ marginTop: 12, marginBottom: 12 }}>
        <label style={{ display: 'block', marginBottom: 6 }}>Phone number (M-Pesa)</label>
        <input value={clientPhone} onChange={(e) => setClientPhone(e.target.value)} style={{ width: '100%', padding: 10 }} />
      </div>

      <div style={{ marginTop: 12, marginBottom: 12 }}>
        <label style={{ display: 'block', marginBottom: 6 }}>Symptoms (optional)</label>
        <textarea value={symptomsText} onChange={(e) => setSymptomsText(e.target.value)} style={{ width: '100%', padding: 10, minHeight: 80 }} />
      </div>

      <div style={{ marginTop: 12, marginBottom: 12 }}>
        <button onClick={handleGetSuggestions} disabled={loadingSuggestions} style={{ padding: 12, width: '100%', cursor: 'pointer' }}>
          {loadingSuggestions ? 'Getting suggestions…' : 'Get OTC suggestions'}
        </button>
      </div>

      {serverDisclaimer ? <div style={{ fontSize: 13, marginBottom: 12 }}>{serverDisclaimer}</div> : null}

      {error ? <div style={{ color: 'red', marginBottom: 12 }}>{error}</div> : null}

      <h3 style={{ marginTop: 18 }}>Suggestions</h3>
      <div style={{ display: 'grid', gap: 10 }}>
        {suggestions.map((s) => (
          <div key={s.medicineSkuId} style={{ border: '1px solid #ddd', borderRadius: 12, padding: 12 }}>
            <div style={{ fontWeight: 700 }}>{s.name}</div>
            <div style={{ fontSize: 13, color: '#555' }}>{s.packSize}</div>
            <div style={{ marginTop: 6, fontSize: 14 }}>KSh {Math.round(s.unitPriceCents / 100)}.00</div>
            {s.requiresPharmacistReview ? <div style={{ marginTop: 6, fontSize: 12, color: '#b45309' }}>Pharmacist review required</div> : null}
            <button onClick={() => handleAddToCart(s)} style={{ marginTop: 10, padding: 10, width: '100%', cursor: 'pointer' }}>
              Add to cart
            </button>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 18, paddingTop: 16, borderTop: '1px solid #eee' }}>
        <h3>Cart</h3>
        {cartItems.length === 0 ? <div>No items yet.</div> : null}
        <div style={{ display: 'grid', gap: 10, marginTop: 10 }}>
          {cartItems.map((it) => (
            <div key={it.medicineSkuId} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
              <div>
                <div style={{ fontWeight: 700 }}>{it.suggestion?.name ?? it.medicineSkuId}</div>
                <div style={{ fontSize: 13, color: '#555' }}>Qty: {it.qty}</div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={async () => {
                    // MVP: remove then re-add; later implement qty stepper endpoint.
                    await handleRemove(it.medicineSkuId);
                  }}
                  style={{ padding: 8, cursor: 'pointer' }}
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>

        <div style={{ marginTop: 12, fontWeight: 800 }}>Total: KSh {Math.round(cartTotalCents / 100)}.00</div>

        <div style={{ marginTop: 12, display: 'grid', gap: 10 }}>
          <button
            onClick={async () => {
              if (!cartId) {
                alert('Add an item to cart first.');
                return;
              }
              navigate('/cart', { state: { cartId, cartItems } });
            }}
            style={{ padding: 12, width: '100%', cursor: 'pointer' }}
          >
            Checkout
          </button>

          <button onClick={handleConsultant} style={{ padding: 12, width: '100%', cursor: 'pointer' }}>
            Call/Chat with Pharmacist
          </button>
        </div>
      </div>
    </div>
  );
}

