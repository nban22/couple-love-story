import Head from 'next/head';
import EventManager from '../components/EventManager';
import Link from 'next/link';
import { useSession } from 'next-auth/react';

export default function EventsPage() {
  const { data: session } = useSession();

  return (
    <>
      <Head>
        <title>Our Events - Love Story</title>
        <meta name="description" content="Special moments and upcoming celebrations" />
      </Head>

      <div className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Navigation */}
        <nav className="flex justify-between items-center mb-8 bg-white/70 backdrop-blur-sm rounded-xl p-4 shadow-sm">
          <div className="flex space-x-6">
            <Link href="/" className="text-gray-600 hover:text-pink-600 transition-colors">
              Home
            </Link>
            <span className="font-semibold text-pink-600">Events</span>
            <Link href="/gallery" className="text-gray-600 hover:text-pink-600 transition-colors">
              Gallery
            </Link>
          </div>
          
          <div className="flex items-center space-x-4">
            {session ? (
              <>
                <span className="text-sm text-gray-600">Welcome, {session.user?.name}</span>
                <Link href="/api/auth/signout" className="text-sm bg-pink-100 text-pink-600 px-3 py-1 rounded-lg hover:bg-pink-200 transition-colors">
                  Sign Out
                </Link>
              </>
            ) : (
              <Link href="/login" className="text-sm bg-pink-500 text-white px-4 py-2 rounded-lg hover:bg-pink-600 transition-colors">
                Sign In
              </Link>
            )}
          </div>
        </nav>

        {/* Main content */}
        <EventManager />
      </div>
    </>
  );
}