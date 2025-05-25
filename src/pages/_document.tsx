// pages/_document.tsx - Optimized Document with preload strategy
import { Html, Head, Main, NextScript } from 'next/document';

/**
 * Custom Document component implementing Next.js font loading best practices
 * Critical Performance Optimizations:
 * - DNS prefetch for Google Fonts reduces connection time by ~100-200ms
 * - Font preload with crossorigin prevents CORS issues
 * - Display=swap prevents FOIT (Flash of Invisible Text)
 * - Resource hints optimize loading waterfall
 */
export default function Document() {
  return (
    <Html lang="en">
      <Head>
        {/* DNS prefetch for performance optimization */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        
        {/* Optimized font loading with display=swap for better UX */}
        <link
          href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;1,400&family=Inter:wght@300;400;500;600&display=swap"
          rel="stylesheet"
        />
        
        {/* Progressive Web App configuration */}
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/icon-192x192.png" />
        
        {/* Theme color for mobile browsers */}
        <meta name="theme-color" content="#ec4899" />
        
        {/* Preload critical resources for performance */}
        <link rel="preload" href="/icon-192x192.png" as="image" type="image/png" />
        
        {/* Security and SEO meta tags */}
        <meta name="robots" content="index,follow" />
        <meta name="googlebot" content="index,follow" />
        
        {/* Open Graph meta tags for social sharing */}
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="Our Love Story" />
        
        {/* Favicon configuration */}
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
        <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png" />
      </Head>
      <body className="antialiased">
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}