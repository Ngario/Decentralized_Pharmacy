import React from 'react';

type StickyFooterProps = {
  copyrightText?: string;
  poweredByText?: string;
};

export default function StickyFooter({
  copyrightText = '&copy; @2026',
  poweredByText = 'powered by mrambajitech'
}: StickyFooterProps) {
  return (
    <footer
      style={{
        position: 'sticky',
        bottom: 0,
        zIndex: 40,
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
          {copyrightText} | {poweredByText}
        </p>
      </div>
    </footer>
  );
}

