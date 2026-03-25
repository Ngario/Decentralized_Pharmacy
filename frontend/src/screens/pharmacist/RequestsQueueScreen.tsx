import React, { useEffect, useState } from 'react';
import { getOpenPharmacistRequests, approvePharmacistRequest, rejectPharmacistRequest } from '../../api/clientApi';

type PharmacistRequest = {
  id: string;
  orderId: string;
  clientPhone: string;
  status: string;
  recommendedItems?: Array<{ medicineSkuId: string; qty: number }>;
};

const fallbackSku = '00000000-0000-0000-0000-000000000001';

export default function RequestsQueueScreen() {
  const [requests, setRequests] = useState<PharmacistRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setError(null);
    setLoading(true);
    try {
      const data = await getOpenPharmacistRequests('OPEN');
      setRequests(data as PharmacistRequest[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load requests');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <div style={{ padding: 16 }}>
      <h2>Pharmacist - Requests Queue</h2>
      <button onClick={load} style={{ padding: 10, cursor: 'pointer' }}>
        Refresh
      </button>

      {loading ? <div style={{ marginTop: 12 }}>Loading…</div> : null}
      {error ? <div style={{ color: 'red', marginTop: 12 }}>{error}</div> : null}

      <div style={{ marginTop: 16, display: 'grid', gap: 12 }}>
        {requests.length === 0 ? <div>No open requests.</div> : null}

        {requests.map((r) => (
          <div key={r.id} style={{ border: '1px solid #eee', padding: 12, borderRadius: 12 }}>
            <div style={{ fontWeight: 800 }}>Request {r.id}</div>
            <div style={{ fontSize: 13, color: '#555' }}>Order: {r.orderId}</div>
            <div style={{ fontSize: 13, color: '#555' }}>Client: {r.clientPhone}</div>
            <div style={{ fontSize: 13, color: '#555' }}>Status: {r.status}</div>

            <div style={{ marginTop: 10, display: 'grid', gap: 10 }}>
              <button
                onClick={async () => {
                  const approvedItems = r.recommendedItems && r.recommendedItems.length > 0 ? r.recommendedItems : [{ medicineSkuId: fallbackSku, qty: 1 }];
                  await approvePharmacistRequest({ requestId: r.id, approvedItems });
                  await load();
                }}
                style={{ padding: 10, cursor: 'pointer' }}
              >
                Approve
              </button>

              <button
                onClick={async () => {
                  await rejectPharmacistRequest({ requestId: r.id, notes: 'Rejected by pharmacist' });
                  await load();
                }}
                style={{ padding: 10, cursor: 'pointer', border: '1px solid #fca5a5' }}
              >
                Reject
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

