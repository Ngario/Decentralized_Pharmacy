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

  if (error)
    return (
      <div className="p-6 max-w-6xl mx-auto text-red-700">
        {error}
      </div>
    );

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto">
      <button
        type="button"
        onClick={() => navigate('/products')}
        className="mb-5 inline-flex items-center px-4 py-2 rounded-lg bg-white/70 hover:bg-white/90 border border-white/60 shadow-card text-gray-900 font-semibold transition"
      >
        Back
      </button>

      <h2 className="text-2xl font-extrabold text-gray-900">Checkout</h2>

      <div className="mt-4 mb-4">
        <label className="block text-sm font-semibold text-gray-800 mb-2">Phone number (M-Pesa)</label>
        <input
          value={clientPhone}
          onChange={(e) => setClientPhone(e.target.value)}
          className="w-full rounded-lg border border-white/60 bg-white/80 backdrop-blur px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-brandPrimary/30"
        />
      </div>

      <div className="mt-4 mb-4">
        <label className="block text-sm font-semibold text-gray-800 mb-2">Symptoms (optional, for record)</label>
        <textarea
          value={symptomsText}
          onChange={(e) => setSymptomsText(e.target.value)}
          className="w-full rounded-lg border border-white/60 bg-white/80 backdrop-blur px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-brandPrimary/30 min-h-[80px]"
        />
      </div>

      <h3 className="text-xl font-extrabold text-gray-900">Items</h3>
      <div className="grid gap-3 mt-3">
        {items.map((it) => (
          <div key={it.medicineSkuId} className="rounded-xl border border-white/60 bg-white/80 backdrop-blur shadow-card p-4">
            <div className="font-bold text-gray-900">{it.suggestion?.name ?? it.medicineSkuId}</div>
            <div className="text-sm text-gray-600 mt-1">Qty: {it.qty}</div>
          </div>
        ))}
      </div>

      <div className="mt-5 text-lg font-extrabold text-gray-900">
        Total: KSh {Math.round(totalCents / 100)}.00
      </div>

      <div className="mt-4">
        <button
          type="button"
          onClick={handlePay}
          disabled={loading || paymentPhase === 'DISPENSING' || paymentPhase === 'DONE'}
          className="w-full rounded-lg bg-brandPrimary text-white px-4 py-3 font-bold hover:bg-brandPrimary/90 disabled:opacity-70 disabled:cursor-not-allowed transition"
        >
          {paymentPhase === 'IDLE' ? 'Pay with M-Pesa' : 'Processing…'}
        </button>
      </div>

      <div className="mt-6">
        <h3 className="text-xl font-extrabold text-gray-900">Status</h3>
        <div className="text-sm md:text-base text-gray-800 mt-2">
          Phase: <b>{paymentPhase}</b>
        </div>
        <div className="text-sm md:text-base text-gray-800 mt-1">
          Order status: <b>{orderStatus ?? '-'}</b>
        </div>

        {requiresPharmacistApproval && paymentPhase !== 'DONE' ? (
          <div className="mt-4 p-4 rounded-xl border border-brandAccent/30 bg-white/70 text-sm text-gray-800">
            A pharmacist must review your request before dispensing.
          </div>
        ) : null}

        {paymentPhase === 'DONE' ? (
          <div className="mt-4 p-4 rounded-xl border border-green-400/60 bg-white/70 text-sm text-gray-800">
            Payment verified. Dispensing complete.
          </div>
        ) : null}

        {paymentPhase === 'FAILED' ? (
          <div className="mt-4 p-4 rounded-xl border border-red-400/60 bg-white/70 text-sm text-gray-800">
            Payment failed or dispensing error. Please try again.
          </div>
        ) : null}
      </div>
    </div>
  );
}

