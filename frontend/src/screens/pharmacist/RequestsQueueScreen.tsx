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
    <div className="p-4 md:p-6 max-w-6xl mx-auto">
      <h2 className="text-2xl font-extrabold text-gray-900">Pharmacist - Requests Queue</h2>
      <button
        type="button"
        onClick={load}
        className="mt-4 inline-flex items-center px-4 py-2 rounded-lg bg-white/70 hover:bg-white/90 border border-white/60 shadow-card text-gray-900 font-semibold transition"
      >
        Refresh
      </button>

      {loading ? <div className="mt-4 text-gray-800">Loading…</div> : null}
      {error ? <div className="text-red-700 mt-4">{error}</div> : null}

      <div className="mt-6 grid gap-3 md:gap-4 md:grid-cols-2 lg:grid-cols-3">
        {requests.length === 0 ? <div>No open requests.</div> : null}

        {requests.map((r) => (
          <div key={r.id} className="rounded-xl border border-white/60 bg-white/80 backdrop-blur shadow-card p-4">
            <div className="font-extrabold text-gray-900">Request {r.id}</div>
            <div className="text-sm text-gray-600 mt-1">Order: {r.orderId}</div>
            <div className="text-sm text-gray-600 mt-1">Client: {r.clientPhone}</div>
            <div className="text-sm text-gray-600 mt-1">Status: {r.status}</div>

            <div className="mt-4 grid gap-3">
              <button
                type="button"
                onClick={async () => {
                  const approvedItems = r.recommendedItems && r.recommendedItems.length > 0 ? r.recommendedItems : [{ medicineSkuId: fallbackSku, qty: 1 }];
                  await approvePharmacistRequest({ requestId: r.id, approvedItems });
                  await load();
                }}
                className="w-full rounded-lg bg-brandPrimary text-white px-3 py-2 font-bold hover:bg-brandPrimary/90 transition"
              >
                Approve
              </button>

              <button
                type="button"
                onClick={async () => {
                  await rejectPharmacistRequest({ requestId: r.id, notes: 'Rejected by pharmacist' });
                  await load();
                }}
                className="w-full rounded-lg bg-white/70 border border-red-300 px-3 py-2 font-bold text-red-700 hover:bg-white/90 transition"
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

