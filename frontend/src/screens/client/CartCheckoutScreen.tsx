import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  checkoutCart,
  getOrderStatus,
  stkPush
} from '../../api/clientApi';
import type { Suggestion } from '../../api/clientApi';

type RouteState = {
  cartId?: string;
  cartItems?: Array<{ medicineSkuId: string; qty: number; suggestion?: Suggestion }>;
};

export default function CartCheckoutScreen() {
  const navigate = useNavigate();
  const location = useLocation();
  const state = (location.state as RouteState) || {};

  const cartId = state.cartId ?? null;
  const initialItems = state.cartItems ?? [];

  const [clientPhone, setClientPhone] = useState('254700000000');
  const [symptomsText, setSymptomsText] = useState('');

  const [items] = useState(initialItems);
  const totalCents = useMemo(() => {
    return items.reduce((sum, it) => sum + (it.suggestion?.unitPriceCents ?? 0) * it.qty, 0);
  }, [items]);

  const [loading, setLoading] = useState(false);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [requiresPharmacistApproval, setRequiresPharmacistApproval] = useState(false);
  const [paymentPhase, setPaymentPhase] = useState<'IDLE' | 'STK_PUSHED' | 'WAITING_CALLBACK' | 'DISPENSING' | 'DONE' | 'FAILED'>('IDLE');
  const [orderStatus, setOrderStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!cartId) {
      setError('Missing cartId. Please go back and select items again.');
    }
  }, [cartId]);

  useEffect(() => {
    if (!orderId) return;

    let alive = true;
    const interval = setInterval(async () => {
      if (!alive) return;
      try {
        const st = await getOrderStatus(orderId);
        setOrderStatus(st.status);

        if (st.status === 'PAYMENT_VERIFIED' || st.status === 'APPROVED') {
          setPaymentPhase('DISPENSING');
        }
        if (st.status === 'DISPENSED') {
          setPaymentPhase('DONE');
          clearInterval(interval);
        }
        if (st.status === 'CANCELLED' || st.status === 'DISPENSE_FAILED') {
          setPaymentPhase('FAILED');
          clearInterval(interval);
        }
      } catch {
        // Keep polling; transient errors should not fail the purchase.
      }
    }, 900);

    return () => {
      alive = false;
      clearInterval(interval);
    };
  }, [orderId]);

  async function handlePay() {
    if (!cartId) return;
    setError(null);
    setLoading(true);
    setPaymentPhase('WAITING_CALLBACK');
    try {
      const checkout = await checkoutCart({
        cartId,
        clientPhone,
        symptomsText: symptomsText.trim() ? symptomsText.trim() : undefined
      });

      setOrderId(checkout.orderId);
      setRequiresPharmacistApproval(checkout.requiresPharmacistApproval);

      await stkPush({ orderId: checkout.orderId, phone: clientPhone });
      setPaymentPhase('STK_PUSHED');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Checkout failed');
      setPaymentPhase('FAILED');
    } finally {
      setLoading(false);
    }
  }

  if (error) return <div style={{ padding: 16, color: 'red' }}>{error}</div>;

  return (
    <div style={{ padding: 16 }}>
      <button onClick={() => navigate('/products')} style={{ marginBottom: 12 }}>
        Back
      </button>

      <h2>Checkout</h2>

      <div style={{ marginTop: 12, marginBottom: 12 }}>
        <label style={{ display: 'block', marginBottom: 6 }}>Phone number (M-Pesa)</label>
        <input value={clientPhone} onChange={(e) => setClientPhone(e.target.value)} style={{ width: '100%', padding: 10 }} />
      </div>

      <div style={{ marginTop: 12, marginBottom: 12 }}>
        <label style={{ display: 'block', marginBottom: 6 }}>Symptoms (optional, for record)</label>
        <textarea value={symptomsText} onChange={(e) => setSymptomsText(e.target.value)} style={{ width: '100%', padding: 10, minHeight: 80 }} />
      </div>

      <h3>Items</h3>
      <div style={{ display: 'grid', gap: 10 }}>
        {items.map((it) => (
          <div key={it.medicineSkuId} style={{ border: '1px solid #eee', borderRadius: 12, padding: 12 }}>
            <div style={{ fontWeight: 700 }}>{it.suggestion?.name ?? it.medicineSkuId}</div>
            <div style={{ fontSize: 13, color: '#555' }}>Qty: {it.qty}</div>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 16, fontWeight: 800 }}>
        Total: KSh {Math.round(totalCents / 100)}.00
      </div>

      <div style={{ marginTop: 12 }}>
        <button onClick={handlePay} disabled={loading || paymentPhase === 'DISPENSING' || paymentPhase === 'DONE'} style={{ padding: 12, width: '100%', cursor: 'pointer' }}>
          {paymentPhase === 'IDLE' ? 'Pay with M-Pesa' : 'Processing…'}
        </button>
      </div>

      <div style={{ marginTop: 16 }}>
        <h3>Status</h3>
        <div style={{ fontSize: 14 }}>
          Phase: <b>{paymentPhase}</b>
        </div>
        <div style={{ fontSize: 14, marginTop: 6 }}>
          Order status: <b>{orderStatus ?? '-'}</b>
        </div>

        {requiresPharmacistApproval && paymentPhase !== 'DONE' ? (
          <div style={{ marginTop: 10, fontSize: 14 }}>
            A pharmacist must review your request before dispensing.
          </div>
        ) : null}

        {paymentPhase === 'DONE' ? (
          <div style={{ marginTop: 10, border: '1px solid #22c55e', padding: 12, borderRadius: 12 }}>
            Payment verified. Dispensing complete.
          </div>
        ) : null}

        {paymentPhase === 'FAILED' ? (
          <div style={{ marginTop: 10, border: '1px solid #ef4444', padding: 12, borderRadius: 12 }}>
            Payment failed or dispensing error. Please try again.
          </div>
        ) : null}
      </div>
    </div>
  );
}

