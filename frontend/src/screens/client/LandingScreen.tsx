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
    <div
      className="w-full"
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        backgroundImage:
          'radial-gradient(circle at center, rgba(128, 90, 213, 0.34) 0%, rgba(128, 90, 213, 0.24) 30%, rgba(242, 85, 113, 0.16) 58%, rgba(255, 255, 255, 0) 88%)'
      }}
    >
      <header
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 20,
          width: '100%',
          paddingTop: 18,
          paddingBottom: 10,
          background: 'linear-gradient(90deg, rgba(128, 90, 213, 0.82) 0%, rgba(241, 109, 139, 0.86) 100%)',
          backdropFilter: 'blur(6px)'
        }}
      >
        <div
          style={{
            maxWidth: 1200,
            margin: '0 auto',
            padding: '0 20px'
          }}
        >
          <h1
            style={{
              margin: 0,
              marginBottom: 8,
              textAlign: 'center',
              fontSize: 'clamp(2rem, 3vw, 2.6rem)',
              fontWeight: 800,
              color: '#ffffff'
            }}
          >
            DawaFlow
          </h1>
          <div className="text-sm md:text-base text-white/95 text-center font-semibold">
            OTC-only vending. For severe symptoms, visit a clinician or talk to a pharmacist.
          </div>
        </div>
      </header>

      <div
        style={{
          maxWidth: 1200,
          width: '100%',
          margin: '0 auto',
          padding: '16px 20px 110px'
        }}
      >
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

      <footer
        style={{
          position: 'sticky',
          bottom: 0,
          marginTop: 'auto',
          zIndex: 20,
          width: '100%',
          background: 'linear-gradient(90deg, rgba(128, 90, 213, 0.82) 0%, rgba(241, 109, 139, 0.86) 100%)',
          paddingTop: 12,
          paddingBottom: 12
        }}
      >
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 20px' }}>
          <div style={{ borderTop: '1px solid rgba(255, 255, 255, 0.45)', marginBottom: 8 }} />
          <p
            style={{
              margin: 0,
              textAlign: 'center',
              fontWeight: 400,
              color: '#ffffff',
              fontSize: 'clamp(0.82rem, 1.4vw, 0.95rem)'
            }}
          >
            &copy; @2026 | powered by mrambajitech
          </p>
        </div>
      </footer>
    </div>
  );
}

