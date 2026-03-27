import React from 'react';

type StickyHeaderProps = {
  title: string;
  subtitle?: string;
};

export default function StickyHeader({ title, subtitle }: StickyHeaderProps) {
  return (
    <header
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 50,
        width: '100%',
        paddingTop: 14,
        paddingBottom: 10,
        background: 'linear-gradient(90deg, rgba(241, 109, 139, 0.86) 0%, rgba(128, 90, 213, 0.82) 100%)', // opposite direction (purple on right)
        backdropFilter: 'blur(6px)'
      }}
    >
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 20px' }}>
        <h1
          style={{
            margin: 0,
            textAlign: 'center',
            fontSize: 'clamp(2rem, 3vw, 2.6rem)',
            fontWeight: 800,
            color: '#ffffff'
          }}
        >
          {title}
        </h1>
        {subtitle ? (
          <div className="text-sm md:text-base text-white/95 text-center font-semibold" style={{ marginTop: 4 }}>
            {subtitle}
          </div>
        ) : null}
      </div>
    </header>
  );
}

