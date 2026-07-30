import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';

function mount() {
  let el = document.getElementById('appkit-root') || document.getElementById('rainbowkit-root');
  if (!el) {
    el = document.createElement('div');
    el.id = 'appkit-root';
    document.body.appendChild(el);
  }

  window.VoodooRainbow = Object.assign(window.VoodooRainbow || {}, {
    ready: false,
    engine: 'appkit',
    openConnectModal() {
      console.warn('[VoodooAppKit] still loading…');
      return false;
    },
  });

  try {
    createRoot(el).render(<App />);
    console.info('[VoodooAppKit] mounted');
  } catch (err) {
    console.error('[VoodooAppKit] mount failed', err);
    window.VoodooRainbow = {
      ready: false,
      error: String(err?.message || err),
      openConnectModal() {
        return false;
      },
    };
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', mount);
} else {
  mount();
}
