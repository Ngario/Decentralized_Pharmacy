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

  if (loading)
    return <div className="p-6 text-gray-800">Loading categories…</div>;
  if (error)
    return (
      <div className="p-6 text-red-700">
        {error}
      </div>
    );

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '18px 20px 26px' }}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: 18
        }}
      >
        {categories.map((c) => (
          <button
            key={c.id}
            type="button"
            style={{
              minHeight: 110,
              padding: '18px 14px',
              borderRadius: 14,
              border: '1px solid rgba(255,255,255,0.65)',
              background: 'rgba(255,255,255,0.85)',
              boxShadow: '0 10px 25px rgba(0,0,0,0.08)',
              color: '#111827',
              fontWeight: 800,
              fontSize: 'clamp(1rem, 1.7vw, 1.2rem)',
              cursor: 'pointer',
              transition: 'all 140ms ease'
            }}
            onClick={() => navigate('/products', { state: { categoryId: c.id } })}
          >
            {c.displayName}
          </button>
        ))}
      </div>
    </div>
  );
}

