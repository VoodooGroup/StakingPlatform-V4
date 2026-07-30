import React from 'react';
import { createRoot } from 'react-dom/client';
import '@rainbow-me/rainbowkit/styles.css';
import App from './App.jsx';

function mount() {
  let el = document.getElementById('rainbowkit-root');
  if (!el) {
    el = document.createElement('div');
    el.id = 'rainbowkit-root';
    document.body.appendChild(el);
  }

  window.VoodooRainbow = Object.assign(window.VoodooRainbow || {}, {
    ready: false,
    openConnectModal() {
      console.warn('[VoodooRainbow] still loading…');
      return false;
    },
    openWalletConnect() {
      return Promise.reject(new Error('WalletConnect is still loading…'));
    },
  });

  try {
    createRoot(el).render(<App />);
    console.info('[VoodooRainbow] React mounted');
  } catch (err) {
    console.error('[VoodooRainbow] mount failed', err);
    window.VoodooRainbow = Object.assign(window.VoodooRainbow || {}, {
      ready: false,
      error: String(err?.message || err),
      openConnectModal() {
        console.error('[VoodooRainbow] dead:', err);
        return false;
      },
    });
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', mount);
} else {
  mount();
}
