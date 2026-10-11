import React from 'react';
import ReactDOM from 'react-dom/client';
import MissingConfig from './app/MissingConfig';

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);

// `services/firebase.ts` import paytida ishga tushadi va kalitsiz yiqiladi,
// shuning uchun ilova faqat config bor bo'lsa yuklanadi.
if (!import.meta.env.VITE_FIREBASE_API_KEY) {
  root.render(<MissingConfig />);
} else {
  void import('./app/App').then(({ default: App }) => {
    root.render(
      <React.StrictMode>
        <App />
      </React.StrictMode>,
    );
  });
}
