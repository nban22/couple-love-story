// pages/_app.tsx - Root application component with architectural corrections
import type { AppProps } from 'next/app';
import { SessionProvider } from 'next-auth/react';
import { ToastContainer } from 'react-toastify';
import Head from 'next/head';
import '@/styles/globals.css'
import 'react-toastify/dist/ReactToastify.css';

const TOAST_CONFIG = {
  position: "top-right" as const,
  autoClose: 4000,
  hideProgressBar: false,
  newestOnTop: true,
  closeOnClick: true,
  rtl: false,
  pauseOnFocusLoss: true,
  draggable: true,
  pauseOnHover: true,
  theme: "light" as const,
  toastClassName: "romantic-toast",
  progressClassName: "romantic-progress"
};

const SESSION_CONFIG = {
  refetchInterval: 5 * 60,
  refetchOnWindowFocus: false
};

/**
 * Root Application Component
 * Implements separation of concerns between global state management,
 * styling, and component rendering pipeline
 * 
 * @param Component - Active page component from Next.js router
 * @param pageProps - Server-side props including session data
 */
export default function App({ Component, pageProps: { session, ...pageProps } }: AppProps) {
  
  return (
    <>
      <Head>
        {/* Critical viewport configuration for responsive design */}
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />

        {/* Base SEO metadata - can be overridden by individual pages */}
        <meta name="description" content="Our beautiful love story - a couple's digital memory book" />

        {/* PWA configuration moved from _document for dynamic content support */}
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
        <ToastContainer {...TOAST_CONFIG} />
      </SessionProvider>
    </>
  );
}