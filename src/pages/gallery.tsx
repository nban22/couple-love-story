import React from 'react';
import { GetServerSideProps } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../lib/auth';
import {getDatabase} from '../lib/database';
import Head from 'next/head';
import Link from 'next/link';
import { useState, useCallback, useMemo } from 'react';
import { useSession } from 'next-auth/react';
import { toast } from 'react-toastify';
import Image from 'next/image';
import { format, parseISO } from 'date-fns';
import NavHeader from '@/components/NavHeader';
import PhotoEditModal from '@/components/PhotoEditModal';
import DynamicMasonry from '@/components/DynamicMasonry';

interface Photo {
  id: number;
  cloudinary_id: string;
  public_url: string;
  title?: string;
  description?: string;
  upload_date: string;
  thumbnails?: {
    small: string;
    medium: string;
    large: string;
  };
}

interface GalleryPageProps {
  photos: Photo[];
}

/**
 * Enhanced photo gallery với Masonry Layout
 * Features:
 * - Beautiful masonry layout using react-masonry-css
 * - Responsive breakpoints
 * - Smooth animations and transitions
 * - Optimized performance with proper image sizing
 */
export default function GalleryPage({ photos: initialPhotos }: GalleryPageProps) {
  const { data: session } = useSession();
  const [photos, setPhotos] = useState<Photo[]>(initialPhotos);
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null);
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState<number>(-1);
  const [isUploading, setIsUploading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'title'>('newest');

  // State cho edit modal
  const [editingPhoto, setEditingPhoto] = useState<Photo | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  // Masonry breakpoints configuration
  const breakpointColumnsObj = {
    default: 4,
    1100: 3,
    700: 2,
    500: 1
  };

  // Memoized filtered and sorted photos for performance
  const filteredPhotos = useMemo(() => {
    let filtered = photos;

    // Search filtering
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      filtered = photos.filter(photo =>
        photo.title?.toLowerCase().includes(term) ||
        photo.description?.toLowerCase().includes(term)
      );
    }

    // Sorting
    switch (sortBy) {
      case 'newest':
        return [...filtered].sort((a, b) => new Date(b.upload_date).getTime() - new Date(a.upload_date).getTime());
      case 'oldest':
        return [...filtered].sort((a, b) => new Date(a.upload_date).getTime() - new Date(b.upload_date).getTime());
      case 'title':
        return [...filtered].sort((a, b) => (a.title || '').localeCompare(b.title || ''));
      default:
        return filtered;
    }
  }, [photos, searchTerm, sortBy]);

  // Enhanced photo upload with drag & drop support
  const handlePhotoUpload = useCallback(async (files: FileList) => {
    if (!session) {
      toast.error('Please sign in to upload photos');
      return;
    }

    const validFiles = Array.from(files).filter(file => {
      const isValidType = file.type.startsWith('image/');
      const isValidSize = file.size <= 10 * 1024 * 1024; // 10MB limit

      if (!isValidType) {
        toast.error(`${file.name} is not a valid image file`);
        return false;
      }
      if (!isValidSize) {
        toast.error(`${file.name} is too large (max 10MB)`);
        return false;
      }
      return true;
    });

    if (validFiles.length === 0) return;

    setIsUploading(true);
    const uploadPromises = validFiles.map(async (file) => {
      const formData = new FormData();
      formData.append('photo', file);
      formData.append('title', file.name.replace(/\.[^/.]+$/, ''));

      try {
        const response = await fetch('/api/photos/upload', {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || 'Upload failed');
        }

        return await response.json();
      } catch (error) {
        console.error(`Upload failed for ${file.name}:`, error);
        toast.error(`Failed to upload ${file.name}`);
        return null;
      }
    });

    try {
      const results = await Promise.all(uploadPromises);
      const successfulUploads = results.filter(result => result !== null);

      if (successfulUploads.length > 0) {
        toast.success(`Successfully uploaded ${successfulUploads.length} photo(s)!`);
        // Refresh photos
        window.location.reload();
      }
    } catch (error) {
      console.error('Batch upload error:', error);
      toast.error('Some uploads failed');
    } finally {
      setIsUploading(false);
    }
  }, [session]);

  // Photo deletion with optimistic updates
  const handleDeletePhoto = useCallback(async (photoId: number) => {
    if (!session) {
      toast.error('Authentication required');
      return;
    }

    if (!window.confirm('Are you sure you want to delete this photo?')) {
      return;
    }

    try {
      // Optimistic update
      const originalPhotos = photos;
      setPhotos(prev => prev.filter(p => p.id !== photoId));

      const response = await fetch(`/api/photos/${photoId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        // Revert on failure
        setPhotos(originalPhotos);
        throw new Error('Failed to delete photo');
      }

      toast.success('Photo deleted successfully');
      setSelectedPhoto(null);
    } catch (error) {
      console.error('Delete error:', error);
      toast.error('Failed to delete photo');
    }
  }, [session, photos]);

  // Handle edit photo
  const handleEditPhoto = useCallback((photo: Photo, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent opening lightbox
    setEditingPhoto(photo);
    setIsEditModalOpen(true);
  }, []);

  // Handle photo update from modal
  const handlePhotoUpdate = useCallback((updatedPhoto: Photo) => {
    setPhotos(prev => prev.map(p => p.id === updatedPhoto.id ? updatedPhoto : p));

    // Update selected photo if it's currently selected
    if (selectedPhoto?.id === updatedPhoto.id) {
      setSelectedPhoto(updatedPhoto);
    }
  }, [selectedPhoto]);

  // Keyboard navigation for lightbox
  const handleKeyNavigation = useCallback((e: KeyboardEvent) => {
    if (!selectedPhoto) return;

    switch (e.key) {
      case 'Escape':
        setSelectedPhoto(null);
        setSelectedPhotoIndex(-1);
        break;
      case 'ArrowLeft':
        if (selectedPhotoIndex > 0) {
          const prevIndex = selectedPhotoIndex - 1;
          setSelectedPhoto(filteredPhotos[prevIndex]);
          setSelectedPhotoIndex(prevIndex);
        }
        break;
      case 'ArrowRight':
        if (selectedPhotoIndex < filteredPhotos.length - 1) {
          const nextIndex = selectedPhotoIndex + 1;
          setSelectedPhoto(filteredPhotos[nextIndex]);
          setSelectedPhotoIndex(nextIndex);
        }
        break;
    }
  }, [selectedPhoto, selectedPhotoIndex, filteredPhotos]);

  // Attach keyboard listeners
  React.useEffect(() => {
    if (selectedPhoto) {
      document.addEventListener('keydown', handleKeyNavigation);
      return () => document.removeEventListener('keydown', handleKeyNavigation);
    }
  }, [selectedPhoto, handleKeyNavigation]);

  // Drag and drop handlers
  const [isDragOver, setIsDragOver] = useState(false);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handlePhotoUpload(files);
    }
  }, [handlePhotoUpload]);

  const openPhotoModal = useCallback((photo: Photo, index: number) => {
    setSelectedPhoto(photo);
    setSelectedPhotoIndex(index);
  }, []);

  return (
    <>
      <Head>
        <title>Our Photo Gallery - Love Story</title>
        <meta name="description" content="Beautiful memories from our journey together" />
      </Head>

      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Navigation */}
        <NavHeader session={session} />

        {/* Header with controls */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 space-y-4 md:space-y-0">
          <div>
            <h1 className="text-4xl font-bold text-gray-800 mb-2">Our Memories</h1>
            <p className="text-gray-600">{filteredPhotos.length} beautiful moments captured</p>
          </div>

          {/* Search and controls */}
          <div className="flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-4 w-full md:w-auto">
            <div className="relative">
              <input
                type="text"
                placeholder="Search photos..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full sm:w-64 px-4 py-2 pl-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
              />
              <svg className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
            >
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
              <option value="title">By Title</option>
            </select>
          </div>
        </div>

        {/* Upload area */}
        {session && (
          <div
            className={`mb-8 border-2 border-dashed rounded-xl p-8 text-center transition-colors ${isDragOver
              ? 'border-pink-400 bg-pink-50'
              : 'border-gray-300 hover:border-pink-300 hover:bg-pink-25'
              }`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <div className="flex flex-col items-center space-y-4">
              {isUploading ? (
                <>
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-pink-500" />
                  <p className="text-gray-600">Uploading photos...</p>
                </>
              ) : (
                <>
                  <svg className="h-16 w-16 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                  <div>
                    <p className="text-lg font-medium text-gray-700">Drop photos here or click to upload</p>
                    <p className="text-sm text-gray-500">Supports JPEG, PNG, WebP up to 10MB each</p>
                  </div>
                  <input
                    type="file"
                    multiple
                    accept="image/*"
                    onChange={(e) => e.target.files && handlePhotoUpload(e.target.files)}
                    className="hidden"
                    id="photo-upload"
                  />
                  <label
                    htmlFor="photo-upload"
                    className="bg-pink-500 text-white px-6 py-2 rounded-lg hover:bg-pink-600 transition-colors cursor-pointer font-medium"
                  >
                    Choose Photos
                  </label>
                </>
              )}
            </div>
          </div>
        )}

        {/* Masonry Photo Grid */}
        {filteredPhotos.length > 0 ? (
          <DynamicMasonry
            breakpointCols={breakpointColumnsObj}
            className="flex w-auto -ml-4"
            columnClassName="pl-4 bg-clip-padding"
          >
            {filteredPhotos.map((photo, index) => (
              <div
                key={photo.id}
                className="mb-4 bg-white rounded-xl shadow-sm hover:shadow-lg transition-all duration-300 cursor-pointer group overflow-hidden"
                onClick={() => openPhotoModal(photo, index)}
              >
                <div className="relative overflow-hidden rounded-t-xl">
                  <Image
                    src={photo.thumbnails?.medium || photo.public_url}
                    alt={photo.title || `Photo ${photo.id}`}
                    width={400}
                    height={300}
                    className="w-full h-auto object-cover group-hover:scale-105 transition-transform duration-500 ease-out"
                    loading="lazy"
                    sizes="(max-width: 500px) 100vw, (max-width: 700px) 50vw, (max-width: 1100px) 33vw, 25vw"
                  />
                  
                  {/* Overlay with gradient */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    <div className="absolute bottom-3 left-3 right-3 text-white">
                      {photo.title && (
                        <h3 className="font-semibold text-sm truncate mb-1 drop-shadow-lg">
                          {photo.title}
                        </h3>
                      )}
                      <p className="text-xs opacity-90 drop-shadow-lg">
                        {format(parseISO(photo.upload_date), 'MMM d, yyyy')}
                      </p>
                    </div>
                  </div>
                  
                  {/* Edit button */}
                  {session && (
                    <button
                      onClick={(e) => handleEditPhoto(photo, e)}
                      className="absolute top-2 right-2 bg-white/20 backdrop-blur-sm text-white rounded-full p-2 opacity-0 group-hover:opacity-100 transition-all duration-200 hover:bg-white/30 hover:scale-110 z-10"
                      aria-label="Edit photo details"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                  )}
                </div>
                
                {/* Photo metadata */}
                {(photo.title || photo.description) && (
                  <div className="p-4">
                    {photo.title && (
                      <h3 className="font-semibold text-gray-800 mb-2 leading-tight">
                        {photo.title}
                      </h3>
                    )}
                    {photo.description && (
                      <p className="text-sm text-gray-600 leading-relaxed line-clamp-3">
                        {photo.description}
                      </p>
                    )}
                  </div>
                )}
              </div>
            ))}
          </DynamicMasonry>
        ) : (
          <div className="text-center py-16">
            <div className="mx-auto h-24 w-24 text-gray-300 mb-4">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <h3 className="text-xl font-medium text-gray-700 mb-2">
              {searchTerm ? 'No photos match your search' : 'No photos yet'}
            </h3>
            <p className="text-gray-500 mb-6">
              {searchTerm
                ? 'Try adjusting your search terms'
                : 'Start building your photo collection by uploading your first memories'
              }
            </p>
            {!session && !searchTerm && (
              <Link href="/login" className="inline-block bg-pink-500 text-white px-6 py-3 rounded-lg hover:bg-pink-600 transition-colors font-medium">
                Sign In to Upload Photos
              </Link>
            )}
          </div>
        )}

        {/* Enhanced Lightbox Modal */}
        {selectedPhoto && (
          <div className="fixed inset-0 bg-black bg-opacity-95 flex items-center justify-center z-50 p-4">
            {/* Navigation buttons */}
            {selectedPhotoIndex > 0 && (
              <button
                onClick={() => {
                  const prevIndex = selectedPhotoIndex - 1;
                  setSelectedPhoto(filteredPhotos[prevIndex]);
                  setSelectedPhotoIndex(prevIndex);
                }}
                className="absolute left-4 top-1/2 transform -translate-y-1/2 bg-white/10 backdrop-blur-sm text-white rounded-full p-3 hover:bg-white/20 transition-all duration-200 z-10"
                aria-label="Previous photo"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
            )}

            {selectedPhotoIndex < filteredPhotos.length - 1 && (
              <button
                onClick={() => {
                  const nextIndex = selectedPhotoIndex + 1;
                  setSelectedPhoto(filteredPhotos[nextIndex]);
                  setSelectedPhotoIndex(nextIndex);
                }}
                className="absolute right-4 top-1/2 transform -translate-y-1/2 bg-white/10 backdrop-blur-sm text-white rounded-full p-3 hover:bg-white/20 transition-all duration-200 z-10"
                aria-label="Next photo"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            )}

            {/* Action buttons */}
            <div className="absolute top-4 right-4 flex space-x-2 z-10">
              {session && (
                <>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleEditPhoto(selectedPhoto, e);
                    }}
                    className="bg-blue-500/20 backdrop-blur-sm text-white rounded-full p-3 hover:bg-blue-500/40 transition-all duration-200"
                    aria-label="Edit photo details"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => handleDeletePhoto(selectedPhoto.id)}
                    className="bg-red-500/20 backdrop-blur-sm text-white rounded-full p-3 hover:bg-red-500/40 transition-all duration-200"
                    aria-label="Delete photo"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </>
              )}
              <button
                onClick={() => {
                  setSelectedPhoto(null);
                  setSelectedPhotoIndex(-1);
                }}
                className="bg-white/10 backdrop-blur-sm text-white rounded-full p-3 hover:bg-white/20 transition-all duration-200"
                aria-label="Close"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Main photo display */}
            <div className="relative max-w-6xl max-h-[85vh] mx-auto w-full h-full rounded-lg overflow-hidden">
              <Image
                src={selectedPhoto.thumbnails?.large || selectedPhoto.public_url}
                alt={selectedPhoto.title || 'Photo'}
                fill
                className= "object-contain rounded-lg shadow-2xl"
                priority
              />

              {/* Photo info overlay */}
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-6 rounded-b-lg">
                <div className="text-white">
                  {selectedPhoto.title && (
                    <h2 className="text-2xl font-bold mb-2 text-gray-200">{selectedPhoto.title}</h2>
                  )}
                  {selectedPhoto.description && (
                    <p className="text-gray-200 mb-2 leading-relaxed">{selectedPhoto.description}</p>
                  )}
                  <div className="flex justify-between items-center text-sm text-gray-300">
                    <span>{format(parseISO(selectedPhoto.upload_date), 'MMMM d, yyyy • h:mm a')}</span>
                    <span>{selectedPhotoIndex + 1} of {filteredPhotos.length}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Photo Edit Modal */}
        <PhotoEditModal
          photo={editingPhoto}
          isOpen={isEditModalOpen}
          onClose={() => {
            setIsEditModalOpen(false);
            setEditingPhoto(null);
          }}
          onUpdate={handlePhotoUpdate}
        />
      </div>

      <style jsx>{`
        .line-clamp-3 {
          display: -webkit-box;
          -webkit-line-clamp: 3;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
      `}</style>
    </>
  );
}

export const getServerSideProps: GetServerSideProps = async (context) => {
  try {
    const db = await getDatabase();
    const photos = await db.getAllPhotos();

    // Add thumbnail URLs for responsive images AND serialize dates
    const photosWithThumbnails = (photos as Photo[]).map((photo: Photo) => ({
      ...photo,
      // Critical: Convert Date objects to ISO strings for JSON serialization
      upload_date: (photo.upload_date && typeof photo.upload_date === 'object' && (photo.upload_date as any) instanceof Date)
        ? (photo.upload_date as Date).toISOString()
        : photo.upload_date,
      created_at: (photo as any).created_at && typeof (photo as any).created_at === 'object' && (photo as any).created_at instanceof Date
        ? ((photo as any).created_at as Date).toISOString()
        : (photo as any).created_at,
      thumbnails: {
        small: photo.public_url.replace('/upload/', '/upload/w_300,h_200,c_fill,q_auto:low/'),
        medium: photo.public_url.replace('/upload/', '/upload/w_600,h_400,c_fill,q_auto:good/'),
        large: photo.public_url.replace('/upload/', '/upload/w_1200,h_800,c_limit,q_auto:good/'),
      },
    }));

    return {
      props: {
        photos: photosWithThumbnails,
      },
    };
  } catch (error) {
    console.error('Gallery SSR error:', error);
    return {
      props: {
        photos: [],
      },
    };
  }
};