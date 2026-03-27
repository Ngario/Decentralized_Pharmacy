import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { addCartItem, getConsultationRecommendations } from '../../api/clientApi';

type RouteState = { consultationId?: string; cartId?: string };

export default function PharmacistConsultationScreen() {
  const navigate = useNavigate();
  const location = useLocation();
  const state = (location.state as RouteState) || {};

  const consultationId = state.consultationId ?? null;
  const cartId = state.cartId ?? null;

  const [loading, setLoading] = useState(true);
  const [recommendations, setRecommendations] = useState<Array<{ medicineSkuId: string; qty: number }>>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!consultationId) {
      setError('Missing consultationId.');
      setLoading(false);
      return;
    }

    const cid = consultationId;

    let alive = true;
    async function load() {
      try {
        const rec = await getConsultationRecommendations(cid);
        if (!alive) return;
        setRecommendations(rec);
      } catch (e) {
        if (!alive) return;
        setError(e instanceof Error ? e.message : 'Failed to load recommendations');
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    }

    load();
    const interval = setInterval(load, 3000);
    return () => {
      alive = false;
      clearInterval(interval);
    };
  }, [consultationId]);

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto">
      <button
        type="button"
        onClick={() => navigate('/products')}
        className="mb-5 inline-flex items-center px-4 py-2 rounded-lg bg-white/70 hover:bg-white/90 border border-white/60 shadow-card text-gray-900 font-semibold transition"
      >
        Back
      </button>

      <h2 className="text-2xl font-extrabold text-gray-900">Pharmacist Consultation</h2>
      <div className="text-sm md:text-base text-gray-800 mt-2 mb-4">
        Consultation ID: <b>{consultationId ?? '-'}</b>
      </div>

      <div className="mt-2">
        {loading ? <div className="text-gray-800">Waiting for pharmacist recommendations…</div> : null}
        {error ? <div className="text-red-700">{error}</div> : null}
      </div>

      <h3 className="mt-6 text-xl font-extrabold text-gray-900">Recommended products</h3>
      {recommendations.length === 0 ? <div>No recommendations yet.</div> : null}

      <div className="grid gap-3 md:gap-4">
        {recommendations.map((r) => (
          <div key={r.medicineSkuId} className="rounded-xl border border-white/60 bg-white/80 backdrop-blur shadow-card p-4">
            <div className="font-bold text-gray-900">{r.medicineSkuId}</div>
            <div className="text-sm text-gray-600 mt-1">Qty: {r.qty}</div>
            <button
              type="button"
              onClick={async () => {
                if (!cartId) {
                  alert('Missing cartId.');
                  return;
                }
                await addCartItem({ cartId, medicineSkuId: r.medicineSkuId, qty: r.qty });
                alert('Added to cart.');
              }}
              className="mt-3 w-full rounded-lg bg-brandPrimary text-white px-3 py-2 font-bold hover:bg-brandPrimary/90 transition"
            >
              Add to cart
            </button>
          </div>
        ))}
      </div>

      <div className="mt-5">
        <button
          type="button"
          onClick={() => navigate('/cart', { state: { cartId } })}
          className="w-full rounded-lg bg-white/80 border border-white/60 px-4 py-3 font-bold text-gray-900 hover:bg-white/95 transition"
        >
          Go to Cart & Checkout
        </button>
      </div>
    </div>
  );
}

