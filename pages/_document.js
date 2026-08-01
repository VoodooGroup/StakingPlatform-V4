import { Html, Head, Main, NextScript } from 'next/document';

/** Next.js document — Windows-style scrollbar class (same as static index.html). */
export default function Document() {
  return (
    <Html lang="en" className="windows-scrollbar">
      <Head />
      <body className="windows-scrollbar">
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
