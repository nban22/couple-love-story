import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';

interface Photo {
  id: number;
  cloudinary_id: string;
  public_url: string;
  title?: string;
  description?: string;
  upload_date: string;
}

interface PhotoEditModalProps {
  photo: Photo | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: (updatedPhoto: Photo) => void;
}

/**
 * Modal component để chỉnh sửa thông tin ảnh
 * Features:
 * - Real-time validation
 * - Character count display
 * - Auto-focus on title field
 * - Escape key to close
 * - Click outside to close
 * - Loading state during save
 */
export default function PhotoEditModal({ photo, isOpen, onClose, onUpdate }: PhotoEditModalProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<{ title?: string; description?: string }>({});

  // Initialize form data when photo changes
  useEffect(() => {
    if (photo) {
      setTitle(photo.title || '');
      setDescription(photo.description || '');
      setErrors({});
    }
  }, [photo]);

  // Handle escape key press
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      // Prevent body scroll when modal is open
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  // Real-time validation
  const validateForm = () => {
    const newErrors: { title?: string; description?: string } = {};

    if (title.trim().length > 100) {
      newErrors.title = 'Title cannot exceed 100 characters';
    }

    if (description.trim().length > 500) {
      newErrors.description = 'Description cannot exceed 500 characters';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!photo || !validateForm()) {
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch(`/api/photos/update/${photo.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: title.trim() || undefined,
          description: description.trim() || undefined,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update photo');
      }

      const result = await response.json();
      
      // Update parent component state
      onUpdate(result.photo);
      
      toast.success('Photo updated successfully!');
      onClose();
      
    } catch (error) {
      console.error('Update error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to update photo');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle backdrop click
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  if (!isOpen || !photo) {
    return null;
  }

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      onClick={handleBackdropClick}
    >
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-800">Edit Photo Details</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Close modal"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Title field */}
          <div>
            <label htmlFor="photo-title" className="block text-sm font-medium text-gray-700 mb-2">
              Title
            </label>
            <input
              id="photo-title"
              type="text"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                validateForm();
              }}
              disabled={isLoading}
              placeholder="Enter photo title..."
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent transition-colors ${
                errors.title ? 'border-red-300' : 'border-gray-300'
              }`}
              autoFocus
            />
            <div className="flex justify-between items-center mt-1">
              {errors.title && (
                <p className="text-sm text-red-600">{errors.title}</p>
              )}
              <p className={`text-xs ml-auto ${
                title.length > 90 ? 'text-red-500' : 'text-gray-500'
              }`}>
                {title.length}/100
              </p>
            </div>
          </div>

          {/* Description field */}
          <div>
            <label htmlFor="photo-description" className="block text-sm font-medium text-gray-700 mb-2">
              Description
            </label>
            <textarea
              id="photo-description"
              value={description}
              onChange={(e) => {
                setDescription(e.target.value);
                validateForm();
              }}
              disabled={isLoading}
              placeholder="Enter photo description..."
              rows={4}
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent transition-colors resize-none ${
                errors.description ? 'border-red-300' : 'border-gray-300'
              }`}
            />
            <div className="flex justify-between items-center mt-1">
              {errors.description && (
                <p className="text-sm text-red-600">{errors.description}</p>
              )}
              <p className={`text-xs ml-auto ${
                description.length > 450 ? 'text-red-500' : 'text-gray-500'
              }`}>
                {description.length}/500
              </p>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading || Object.keys(errors).length > 0}
              className="px-6 py-2 bg-pink-500 text-white rounded-lg hover:bg-pink-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
            >
              {isLoading ? (
                <>
                  <svg className="animate-spin w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  <span>Saving...</span>
                </>
              ) : (
                <span>Save Changes</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}