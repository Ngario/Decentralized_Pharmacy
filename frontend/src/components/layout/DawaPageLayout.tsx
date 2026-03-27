import React from 'react';
import StickyHeader from './StickyHeader';
import StickyFooter from './StickyFooter';

type DawaPageLayoutProps = {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
};

export default function DawaPageLayout({ title, subtitle, children }: DawaPageLayoutProps) {
  return (
    <div
      style={{
        minHeight: '100vh',
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        backgroundImage:
          'radial-gradient(circle at center, rgba(128, 90, 213, 0.34) 0%, rgba(128, 90, 213, 0.24) 30%, rgba(242, 85, 113, 0.16) 58%, rgba(255, 255, 255, 0) 88%)'
      }}
    >
      <StickyHeader title={title} subtitle={subtitle} />

      <main style={{ flex: 1 }}>
        {children}
      </main>

      <StickyFooter copyrightText="&copy; @2026" poweredByText="powered by mrambajitech" />
    </div>
  );
}

