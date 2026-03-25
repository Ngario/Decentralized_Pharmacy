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
    <div style={{ padding: 16 }}>
      <button onClick={() => navigate('/products')} style={{ marginBottom: 12 }}>
        Back
      </button>

      <h2>Pharmacist Consultation</h2>
      <div style={{ fontSize: 14, marginBottom: 12 }}>
        Consultation ID: <b>{consultationId ?? '-'}</b>
      </div>

      <div style={{ marginTop: 10 }}>
        {loading ? <div>Waiting for pharmacist recommendations…</div> : null}
        {error ? <div style={{ color: 'red' }}>{error}</div> : null}
      </div>

      <h3 style={{ marginTop: 18 }}>Recommended products</h3>
      {recommendations.length === 0 ? <div>No recommendations yet.</div> : null}

      <div style={{ display: 'grid', gap: 10 }}>
        {recommendations.map((r) => (
          <div key={r.medicineSkuId} style={{ border: '1px solid #eee', borderRadius: 12, padding: 12 }}>
            <div style={{ fontWeight: 700 }}>{r.medicineSkuId}</div>
            <div style={{ fontSize: 13, color: '#555' }}>Qty: {r.qty}</div>
            <button
              onClick={async () => {
                if (!cartId) {
                  alert('Missing cartId.');
                  return;
                }
                await addCartItem({ cartId, medicineSkuId: r.medicineSkuId, qty: r.qty });
                alert('Added to cart.');
              }}
              style={{ marginTop: 10, padding: 10, width: '100%', cursor: 'pointer' }}
            >
              Add to cart
            </button>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 16 }}>
        <button onClick={() => navigate('/cart', { state: { cartId } })} style={{ padding: 12, width: '100%', cursor: 'pointer' }}>
          Go to Cart & Checkout
        </button>
      </div>
    </div>
  );
}

