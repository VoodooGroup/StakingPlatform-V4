import React from 'react';
import { createRoot } from 'react-dom/client';
import '@rainbow-me/rainbowkit/styles.css';
import App from './App.jsx';

let root = null;
let hostEl = null;

function getHost() {
  let el = document.getElementById('rainbowkit-root') || document.getElementById('appkit-root');
  if (!el) {
    el = document.createElement('div');
    el.id = 'rainbowkit-root';
    document.body.appendChild(el);
  }
  return el;
}

function setLoadingApi() {
  window.VoodooRainbow = Object.assign(window.VoodooRainbow || {}, {
    ready: false,
    engine: 'rainbowkit',
    openConnectModal() {
      console.warn('[RainbowKit] still loading…');
      return Promise.resolve(false);
    },
  });
}

/**
 * Full remount of RainbowKit React tree.
 * Used after WalletConnect leaves wagmi/RK in a state where openConnectModal is dead.
 */
function remountRainbowKit() {
  hostEl = getHost();
  setLoadingApi();
  try {
    if (root) {
      root.unmount();
      root = null;
    }
  } catch (e) {
    console.warn('[RainbowKit] unmount', e);
    root = null;
  }
  // Fresh DOM node avoids leftover portal state
  const parent = hostEl.parentNode;
  const next = hostEl.cloneNode(false);
  parent.replaceChild(next, hostEl);
  hostEl = next;
  hostEl.id = 'rainbowkit-root';

  root = createRoot(hostEl);
  root.render(<App />);
  console.info('[RainbowKit] remounted');
}

function mount() {
  hostEl = getHost();
  setLoadingApi();

  // Expose remount for reopen-after-WalletConnect
  window.__voodooRemountRainbowKit = remountRainbowKit;

  try {
    root = createRoot(hostEl);
    root.render(<App />);
    console.info('[RainbowKit] mounted — WalletConnect is inside Other modal');
  } catch (err) {
    console.error('[RainbowKit] mount failed', err);
    window.VoodooRainbow = {
      ready: false,
      error: String(err?.message || err),
      openConnectModal() {
        return Promise.resolve(false);
      },
    };
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', mount);
} else {
  mount();
}
