import React from 'react';
import { createRoot } from 'react-dom/client';
import '@rainbow-me/rainbowkit/styles.css';
import App from './App.jsx';

function mount() {
  let el = document.getElementById('rainbowkit-root') || document.getElementById('appkit-root');
  if (!el) {
    el = document.createElement('div');
    el.id = 'rainbowkit-root';
    document.body.appendChild(el);
  }

  window.VoodooRainbow = Object.assign(window.VoodooRainbow || {}, {
    ready: false,
    engine: 'rainbowkit',
    openConnectModal() {
      console.warn('[RainbowKit] still loading…');
      return false;
    },
  });

  try {
    createRoot(el).render(<App />);
    console.info('[RainbowKit] mounted — WalletConnect is inside the Other modal');
  } catch (err) {
    console.error('[RainbowKit] mount failed', err);
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
