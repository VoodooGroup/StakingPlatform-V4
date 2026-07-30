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

  // Placeholder API until React hydrates
  window.VoodooRainbow = Object.assign(window.VoodooRainbow || {}, {
    ready: false,
    openConnectModal() {
      console.warn('[VoodooRainbow] still loading…');
    },
  });

  // No StrictMode — double-mount confuses wallet connect state (stuck on Rabby/Frame, etc.)
  createRoot(el).render(<App />);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', mount);
} else {
  mount();
}
