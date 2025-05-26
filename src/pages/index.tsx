import { GetServerSideProps } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../lib/auth';
import { getDatabase } from '../lib/database';
import Head from 'next/head';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import CoupleInfoDisplay from '../components/CoupleInfoDisplay';
import EventCard from '../components/EventCard';
import PhotoGalleryPreview from '../components/PhotoGalleryPreview';
import { useMemo } from 'react';
import NavHeader from '@/components/NavHeader';

/**
 * Homepage component implementing Server-Side Rendering for optimal SEO
 * Data fetching strategy: SSR for initial load, then client-side updates
 * Performance: Pre-fetched data eliminates loading states on page load
 */

interface HomePageProps {
  coupleInfo: any;
  upcomingEvents: any[];
  featuredPhotos: any[];
}

export default function HomePage({ coupleInfo, upcomingEvents, featuredPhotos }: HomePageProps) {
  const { data: session } = useSession();

  const pageTitle = useMemo(() => {
    if (coupleInfo?.male_name && coupleInfo?.female_name) {
      return `Our Love Story - ${coupleInfo.male_name} & ${coupleInfo.female_name}`;
    }
    return 'Our Love Story';
  }, [coupleInfo?.male_name, coupleInfo?.female_name]);

  return (
    <>
      <Head>
        <title>{pageTitle}</title>
        <meta name="description" content={
          coupleInfo?.male_name && coupleInfo?.female_name
            ? `The beautiful love story of ${coupleInfo.male_name} and ${coupleInfo.female_name}`
            : 'Our beautiful love story - a couple\'s digital memory book'
        } />
      </Head>

      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <NavHeader session={session} />

        {/* Main content sections with responsive grid layout */}
        <main className="space-y-12">
          {/* Couple information section */}
          {coupleInfo && (
            <section>
              <CoupleInfoDisplay
                coupleInfo={coupleInfo}
                isEditable={!!session}
                onUpdate={(updated) => {
                  // Optimistic update - in production, consider using SWR or React Query
                  window.location.reload();
                }}
              />
            </section>
          )}

          {/* Upcoming events section with conditional rendering */}
          {upcomingEvents.length > 0 && (
            <section>
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-3xl font-bold text-gray-800">Upcoming Events</h2>
                <Link
                  href="/events"
                  className="text-pink-600 hover:text-pink-700 font-medium transition-colors"
                >
                  View All Events →
                </Link>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {upcomingEvents.slice(0, 3).map(event => (
                  <EventCard key={event.id} event={event} />
                ))}
              </div>
            </section>
          )}

          {/* Featured photos section with lazy loading preparation */}
          {featuredPhotos.length > 0 && (
            <section>
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-3xl font-bold text-gray-800">Our Memories</h2>
                <Link
                  href="/gallery"
                  className="text-pink-600 hover:text-pink-700 font-medium transition-colors"
                >
                  View All Photos →
                </Link>
              </div>

              <PhotoGalleryPreview photos={featuredPhotos} />
            </section>
          )}

          {/* Empty state with call-to-action for new couples */}
          {!coupleInfo && (
            <div className="text-center py-16">
              <h1 className="text-4xl font-bold text-gray-800 mb-4">Welcome to Your Love Story</h1>
              <p className="text-lg text-gray-600 mb-8">Start documenting your beautiful journey together</p>
              {!session && (
                <Link
                  href="/login"
                  className="inline-block bg-pink-500 text-white px-8 py-3 rounded-lg text-lg font-semibold hover:bg-pink-600 transition-colors"
                >
                  Get Started
                </Link>
              )}
            </div>
          )}
        </main>
      </div>
    </>
  );
}

/**
 * Server-side data fetching with error boundary protection
 * Performance optimization: Single database connection serves multiple queries
 * Error handling: Graceful degradation if database is unavailable
 */
export const getServerSideProps: GetServerSideProps = async (context) => {
  try {
    const session = await getServerSession(context.req, context.res, authOptions);
    const db = await getDatabase();

    // Parallel data fetching for optimal performance
    const [coupleInfo, upcomingEvents, allPhotos] = await Promise.all([
      Promise.resolve(db.getCoupleInfo()),
      Promise.resolve(db.getUpcomingEvents(3)),
      Promise.resolve(db.getAllPhotos()),
    ]);

    // Featured photos selection: Most recent 6 photos
    const featuredPhotos = allPhotos
      .sort((a, b) => new Date(b.upload_date).getTime() - new Date(a.upload_date).getTime())
      .slice(0, 6);

    return {
      props: {
        coupleInfo: coupleInfo || null,
        upcomingEvents: upcomingEvents || [],
        featuredPhotos: featuredPhotos || [],
      },
    };
  } catch (error) {
    console.error('Homepage SSR error:', error);

    // Graceful fallback with empty data
    return {
      props: {
        coupleInfo: null,
        upcomingEvents: [],
        featuredPhotos: [],
      },
    };
  }
};