import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Override window.alert to prevent iframe security errors and provide a better UX
window.alert = (message: string) => {
  const toast = document.createElement('div');
  toast.textContent = message;
  toast.className = 'fixed bottom-4 left-1/2 -translate-x-1/2 bg-slate-900 text-white px-6 py-3 rounded-xl shadow-2xl z-[9999] font-medium text-sm text-center max-w-[90vw] animate-in slide-in-from-bottom-5';
  document.body.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
