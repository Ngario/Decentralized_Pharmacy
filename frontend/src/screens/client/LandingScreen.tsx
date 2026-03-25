import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getCategories } from '../../api/clientApi';
import type { Category } from '../../api/clientApi';

export default function LandingScreen() {
  const navigate = useNavigate();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    getCategories()
      .then((cats) => {
        if (!mounted) return;
        setCategories(cats);
        setLoading(false);
      })
      .catch((e) => {
        if (!mounted) return;
        setError(e instanceof Error ? e.message : 'Failed to load categories');
        setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  if (loading) return <div style={{ padding: 24 }}>Loading categories…</div>;
  if (error) return <div style={{ padding: 24, color: 'red' }}>{error}</div>;

  return (
    <div style={{ padding: 16 }}>
      <h1 style={{ marginBottom: 8 }}>E-Pharmacy Smart Vending</h1>
      <div style={{ fontSize: 14, marginBottom: 16 }}>
        OTC-only vending. For severe symptoms, visit a clinician.
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: 12
        }}
      >
        {categories.map((c) => (
          <button
            key={c.id}
            style={{ padding: 18, borderRadius: 12, fontSize: 18, cursor: 'pointer' }}
            onClick={() => navigate('/products', { state: { categoryId: c.id } })}
          >
            {c.displayName}
          </button>
        ))}
      </div>
    </div>
  );
}

