import React, { useState, memo, useEffect, useRef, useMemo } from 'react';
import Image from 'next/image';
import { format, parseISO } from 'date-fns';

interface Photo {
  id: number;
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

interface PhotoGalleryPreviewProps {
  photos: Photo[];
  maxPhotos?: number;
}

/**
 * Photo gallery preview component with performance optimizations
 * Uses Next.js Image component for automatic optimization and lazy loading
 * Implements responsive image sizes to reduce bandwidth on mobile devices
 */
const PhotoGalleryPreview = memo<PhotoGalleryPreviewProps>(({ photos, maxPhotos = 6 }) => {
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null);
  const displayPhotos = photos.slice(0, maxPhotos);

  const [imageDimensions, setImageDimensions] = useState({ width: 800, height: 600 });

  useEffect(() => {
    if (selectedPhoto) {
      const img = new window.Image();
      img.src = selectedPhoto.thumbnails?.large || selectedPhoto.public_url;
      img.onload = () => {
        setImageDimensions({
          width: img.naturalWidth || 800,
          height: img.naturalHeight || 600,
        });
      };
    }
  }, [selectedPhoto]);

  return (
    <>
      {/* Photo grid with responsive layout */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {displayPhotos.map((photo, index) => (
          <div
            key={photo.id}
            className="relative aspect-square group cursor-pointer overflow-hidden rounded-lg bg-gray-100"
            onClick={() => setSelectedPhoto(photo)}
          >
            {/* Next.js Image with performance optimizations */}
            <Image
              src={photo.thumbnails?.medium || photo.public_url}
              alt={photo.title || `Memory ${index + 1}`}
              fill
              sizes="(max-width: 768px) 50vw, (max-width: 1200px) 33vw, 25vw"
              className="object-cover transition-transform duration-300 group-hover:scale-105"
              loading={index < 4 ? 'eager' : 'lazy'} // Eager load first 4 images
              placeholder="blur"
              blurDataURL="data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k="
            />

            {/* Hover overlay with photo info */}
            <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-all duration-300 flex items-end">
              <div className="p-3 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                <p className="text-sm font-medium truncate">
                  {photo.title || 'Untitled'}
                </p>
                <p className="text-xs opacity-80">
                  {format(parseISO(photo.upload_date), 'MMM d, yyyy')}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Modal for photo preview with optimized image loading */}
      {selectedPhoto && (
        <div
          className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4"
          onClick={() => setSelectedPhoto(null)}
        >
          <div
            className="max-w-4xl max-h-[90vh] h-[90vh] min-h-0 rounded-lg overflow-hidden flex flex-col bg-black shadow-lg justify-center"
            onClick={(e) => e.stopPropagation()}
          >
              <div
                className="min-h-0"
              >
                <Image
                  src={selectedPhoto.thumbnails?.large || selectedPhoto.public_url}
                  alt={selectedPhoto.title || 'Photo'}
                  width={imageDimensions.width}
                  height={imageDimensions.height} 
                  style={{ maxHeight: '100%', maxWidth: '100%' }}                 
                  loading="eager"
                  className="object-contain"
                  sizes="(max-width: 1200px) 100vw, 1200px"
                  priority
                />
              </div>

              {(selectedPhoto.title || selectedPhoto.description) && (
                <div className="p-6 bg-black">
                  {selectedPhoto.title && (
                    <h3 className="text-lg font-semibold text-gray-100 mb-2">
                      {selectedPhoto.title}
                    </h3>
                  )}
                  {selectedPhoto.description && (
                    <p className="text-gray-400">{selectedPhoto.description}</p>
                  )}
                  <p className="text-sm text-gray-400 mt-2">
                    {format(parseISO(selectedPhoto.upload_date), 'MMMM d, yyyy • h:mm a')}
                  </p>
                </div>
              )}
            </div>
        </div>
      )}
    </>
  );
});

PhotoGalleryPreview.displayName = 'PhotoGalleryPreview';

export default PhotoGalleryPreview;
