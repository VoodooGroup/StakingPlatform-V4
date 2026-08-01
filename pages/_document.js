import { Html, Head, Main, NextScript } from 'next/document';

/**
 * WordPress-equivalent:
 *   body_class → windows-scrollbar
 *   wp_head → windows-scrollbar.css (exact plugin CSS)
 */
export default function Document() {
  return (
    <Html lang="en">
      <Head>
        <link rel="stylesheet" href="/css/windows-scrollbar.css?v=1" />
      </Head>
      <body className="windows-scrollbar">
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
