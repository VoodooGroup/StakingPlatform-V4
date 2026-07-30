/**
 * WalletConnect via the OFFICIAL Reown QR modal (showQrModal: true).
 *
 * Why this works when RainbowKit in-modal QR failed:
 * - Stock RK id "walletConnect" closes the RK dialog and leaves zombie state
 * - In-modal display_uri path is fragile in our IIFE + static host setup
 * - Official modal is what every dapp uses: scan QR in a dedicated WC UI
 *
 * id is NOT "walletConnect" so RainbowKit does not attach the dual-modal connector
 * that closes the connect dialog incorrectly.
 */
import { createConnector } from 'wagmi';
import { walletConnect } from 'wagmi/connectors';

/**
 * Official WalletConnect tile (exact asset RainbowKit uses for walletConnectWallet).
 * Static data-URL — no deep package import (Vite blocks rainbowkit internal paths).
 */
const WC_ICON =
  "data:image/svg+xml,%3Csvg%20width%3D%2228%22%20height%3D%2228%22%20viewBox%3D%220%200%2028%2028%22%20fill%3D%22none%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%0A%3Crect%20width%3D%2228%22%20height%3D%2228%22%20fill%3D%22%233B99FC%22%2F%3E%0A%3Cpath%20d%3D%22M8.38969%2010.3739C11.4882%207.27538%2016.5118%207.27538%2019.6103%2010.3739L19.9832%2010.7468C20.1382%2010.9017%2020.1382%2011.1529%2019.9832%2011.3078L18.7076%2012.5835C18.6301%2012.6609%2018.5045%2012.6609%2018.4271%2012.5835L17.9139%2012.0703C15.7523%209.9087%2012.2477%209.9087%2010.0861%2012.0703L9.53655%2012.6198C9.45909%2012.6973%209.3335%2012.6973%209.25604%2012.6198L7.98039%2011.3442C7.82547%2011.1893%207.82547%2010.9381%207.98039%2010.7832L8.38969%2010.3739ZM22.2485%2013.012L23.3838%2014.1474C23.5387%2014.3023%2023.5387%2014.5535%2023.3838%2014.7084L18.2645%2019.8277C18.1096%2019.9827%2017.8584%2019.9827%2017.7035%2019.8277C17.7035%2019.8277%2017.7035%2019.8277%2017.7035%2019.8277L14.0702%2016.1944C14.0314%2016.1557%2013.9686%2016.1557%2013.9299%2016.1944C13.9299%2016.1944%2013.9299%2016.1944%2013.9299%2016.1944L10.2966%2019.8277C10.1417%2019.9827%209.89053%2019.9827%209.73561%2019.8278C9.7356%2019.8278%209.7356%2019.8277%209.7356%2019.8277L4.61619%2014.7083C4.46127%2014.5534%204.46127%2014.3022%204.61619%2014.1473L5.75152%2013.012C5.90645%2012.857%206.15763%2012.857%206.31255%2013.012L9.94595%2016.6454C9.98468%2016.6841%2010.0475%2016.6841%2010.0862%2016.6454C10.0862%2016.6454%2010.0862%2016.6454%2010.0862%2016.6454L13.7194%2013.012C13.8743%2012.857%2014.1255%2012.857%2014.2805%2013.012C14.2805%2013.012%2014.2805%2013.012%2014.2805%2013.012L17.9139%2016.6454C17.9526%2016.6841%2018.0154%2016.6841%2018.0541%2016.6454L21.6874%2013.012C21.8424%2012.8571%2022.0936%2012.8571%2022.2485%2013.012Z%22%20fill%3D%22white%22%2F%3E%0A%3C%2Fsvg%3E%0A";

function metadata() {
  const origin =
    typeof window !== 'undefined' && window.location?.origin
      ? window.location.origin
      : 'https://voodootoken.com';
  return {
    name: 'Voodoo Staking Portal',
    description: 'Stake VDO on PulseChain — VoodooGroup',
    url: origin,
    icons: ['https://voodootoken.com/Voodoo-Token-Logo.png'],
  };
}

/**
 * RainbowKit CreateWalletFn — appears as "WalletConnect" in Other modal.
 * Click → our QR overlay (see App.jsx intercept).
 */
export function walletConnectOfficial({ projectId } = {}) {
  if (!projectId) {
    throw new Error('walletConnectOfficial requires projectId');
  }

  return {
    id: 'voodoo-walletconnect',
    name: 'WalletConnect',
    shortName: 'WalletConnect',
    iconUrl: async () => WC_ICON,
    iconBackground: '#3b99fc',
    iconAccent: '#3b99fc',
    // Always "ready" so connect() runs
    installed: true,
    // No qrCode / mobile getUri — official modal handles QR
    createConnector: (walletDetails) =>
      createConnector((config) => {
        const wc = walletConnect({
          projectId,
          showQrModal: true,
          metadata: metadata(),
          // Avoid sharing storage with any leftover RK WC client
          customStoragePrefix: 'voodoo-wc-official',
        })(config);

        return {
          ...wc,
          ...walletDetails,
          id: 'voodoo-walletconnect',
          name: 'WalletConnect',
          type: 'walletConnect',
          async connect(params) {
            console.info('[WalletConnect] opening official QR modal…');
            return wc.connect(params);
          },
        };
      }),
  };
}
