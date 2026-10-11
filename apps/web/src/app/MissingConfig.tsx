import React from 'react';

const MissingConfig: React.FC = () => (
  <div style={{ fontFamily: 'Inter, sans-serif', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12, padding: 24, textAlign: 'center', background: '#0f1117', color: '#e2e8f0' }}>
    <div style={{ fontSize: 40 }}>⚙️</div>
    <h2 style={{ margin: 0, fontSize: 20 }}>Firebase config topilmadi</h2>
    <p style={{ margin: 0, color: '#94a3b8', fontSize: 14, maxWidth: 380 }}>
      <strong>VITE_FIREBASE_*</strong> o'zgaruvchilarini kiriting (lokal — <code>apps/web/.env</code>,
      Netlify — Site settings → Environment variables), so'ng qayta ishga tushiring.
    </p>
  </div>
);

export default MissingConfig;
