import Head from 'next/head';
import EventManager from '../components/EventManager';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import NavHeader from '@/components/NavHeader';

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
        <NavHeader session={session} />

        {/* Main content */}
        <EventManager />
      </div>
    </>
  );
}