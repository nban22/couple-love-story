import type { AppProps } from 'next/app';
import { SessionProvider } from 'next-auth/react';
import Head from 'next/head';
import '@/styles/globals.css'

// Dynamic import for toast CSS to prevent server-side issues
import dynamic from 'next/dynamic';

// Dynamically import toast-related components
const DynamicToast = dynamic(() => import('@/components/DynamicToast'), {
  ssr: false
});


const SESSION_CONFIG = {
  refetchInterval: 5 * 60,
  refetchOnWindowFocus: false
};

/**
 * Root Application Component - Fixed for Server/Client Separation
 * Now properly handles client-side only libraries with dynamic imports
 */
export default function App({ Component, pageProps: { session, ...pageProps } }: AppProps) {
  
  return (
    <>
      <Head>
        {/* Critical viewport configuration for responsive design */}
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />

        {/* Base SEO metadata - can be overridden by individual pages */}
        <meta name="description" content="Our beautiful love story - a couple's digital memory book" />

        {/* PWA configuration */}
        <meta name="application-name" content="Love Story" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Love Story" />
        <meta name="format-detection" content="telephone=no" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="msapplication-TileColor" content="#ec4899" />
        <meta name="msapplication-tap-highlight" content="no" />
        <title>Our Love Story</title>
      </Head>
      
      <SessionProvider session={session} {...SESSION_CONFIG}>
        <div className="min-h-screen bg-gradient-to-br from-pink-50 via-rose-50 to-purple-50">
          <Component {...pageProps} />
        </div>
        {/* Dynamic toast container - only loads on client */}
        <DynamicToast />
      </SessionProvider>
    </>
  );
}