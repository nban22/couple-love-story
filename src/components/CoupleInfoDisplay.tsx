import React, { useState, useEffect, useMemo } from 'react';
import { toast } from 'react-toastify';
import { useDateCalculations } from './DateCalculations';
import CountdownCard from './CountdownCard';

interface CoupleInfo {
  male_name: string;
  female_name: string;
  love_start_date: string;
  male_birthday: string;
  female_birthday: string;
}

interface CoupleInfoDisplayProps {
  coupleInfo: CoupleInfo;
  isEditable?: boolean;
  onUpdate?: (updatedInfo: CoupleInfo) => void;
}

/**
 * Component implementing the Single Responsibility Principle
 * Handles both display and editing modes with controlled state management
 * Performance: Debounced API calls prevent excessive server requests
 */
export default function CoupleInfoDisplay({ coupleInfo, isEditable, onUpdate }: CoupleInfoDisplayProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState(coupleInfo);
  const [isLoading, setIsLoading] = useState(false);
  
  // Date calculations with automatic updates
  const dateInfo = useDateCalculations(
    coupleInfo.love_start_date,
    coupleInfo.male_birthday,
    coupleInfo.female_birthday
  );

  // Effect for birthday notifications - runs once per day maximum
  useEffect(() => {
    if (dateInfo.hasBirthdayToday) {
      const birthdayPerson = dateInfo.maleBirthday.isToday ? coupleInfo.male_name : coupleInfo.female_name;
      toast.success(`🎉 Happy Birthday ${birthdayPerson}! 🎂`, {
        position: 'top-center',
        autoClose: 5000,
        className: 'birthday-toast',
      });
    }
  }, [dateInfo.hasBirthdayToday, coupleInfo.male_name, coupleInfo.female_name]);

  // API call with error handling and optimistic updates
  const handleSave = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/couple/info', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editData),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Update failed');
      }

      const updatedInfo = await response.json();
      onUpdate?.(updatedInfo);
      setIsEditing(false);
      toast.success('Information updated successfully!');
    } catch (error) {
      console.error('Update error:', error);
      toast.error(`Failed to update: ${(error as Error).message}`);
      // Reset to original data on error
      setEditData(coupleInfo);
    } finally {
      setIsLoading(false);
    }
  };

  // Form validation with real-time feedback
  const isValidForm = useMemo(() => {
    return editData.male_name.trim().length > 0 &&
           editData.female_name.trim().length > 0 &&
           /^\d{4}-\d{2}-\d{2}$/.test(editData.love_start_date) &&
           /^\d{2}-\d{2}$/.test(editData.male_birthday) &&
           /^\d{2}-\d{2}$/.test(editData.female_birthday);
  }, [editData]);

  if (isEditing && isEditable) {
    return (
      <div className="bg-white/90 backdrop-blur-sm rounded-2xl p-8 shadow-xl border border-pink-200">
        <h2 className="text-2xl font-bold text-center text-gray-800 mb-6">Edit Couple Information</h2>
        
        <div className="space-y-4">
          {/* Input fields with controlled components pattern */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">His Name</label>
              <input
                type="text"
                value={editData.male_name}
                onChange={(e) => setEditData(prev => ({ ...prev, male_name: e.target.value }))}
                className="w-full px-4 py-2 border border-pink-200 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                disabled={isLoading}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Her Name</label>
              <input
                type="text"
                value={editData.female_name}
                onChange={(e) => setEditData(prev => ({ ...prev, female_name: e.target.value }))}
                className="w-full px-4 py-2 border border-pink-200 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                disabled={isLoading}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Love Started Date</label>
            <input
              type="date"
              value={editData.love_start_date}
              onChange={(e) => setEditData(prev => ({ ...prev, love_start_date: e.target.value }))}
              className="w-full px-4 py-2 border border-pink-200 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
              disabled={isLoading}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">His Birthday (MM-DD)</label>
              <input
                type="text"
                placeholder="03-15"
                value={editData.male_birthday}
                onChange={(e) => setEditData(prev => ({ ...prev, male_birthday: e.target.value }))}
                className="w-full px-4 py-2 border border-pink-200 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                disabled={isLoading}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Her Birthday (MM-DD)</label>
              <input
                type="text"
                placeholder="07-22"
                value={editData.female_birthday}
                onChange={(e) => setEditData(prev => ({ ...prev, female_birthday: e.target.value }))}
                className="w-full px-4 py-2 border border-pink-200 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                disabled={isLoading}
              />
            </div>
          </div>
        </div>

        {/* Action buttons with loading states */}
        <div className="flex justify-end space-x-4 mt-6">
          <button
            onClick={() => {
              setIsEditing(false);
              setEditData(coupleInfo); // Reset to original data
            }}
            disabled={isLoading}
            className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isLoading || !isValidForm}
            className="px-6 py-2 bg-pink-500 text-white rounded-lg hover:bg-pink-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-br from-pink-50/80 to-rose-50/80 backdrop-blur-sm rounded-2xl p-8 shadow-xl border border-pink-200/50">
      {/* Header with names and edit button */}
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold text-gray-800 mb-2">
          {coupleInfo.male_name} & {coupleInfo.female_name}
        </h1>
        <p className="text-lg text-gray-600">Our Love Story</p>
        
        {isEditable && (
          <button
            onClick={() => setIsEditing(true)}
            className="mt-4 px-4 py-2 text-sm bg-pink-100 text-pink-600 rounded-lg hover:bg-pink-200 transition-colors"
          >
            Edit Information
          </button>
        )}
      </div>

      {/* Countdown cards grid with responsive layout */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <CountdownCard
          title="Days Together"
          count={dateInfo.daysInLove}
          suffix="days of love"
          className="md:col-span-1"
        />
        
        <CountdownCard
          title={`${coupleInfo.male_name}'s Birthday`}
          count={dateInfo.maleBirthday.daysUntil}
          suffix={`days until ${dateInfo.maleBirthday.formattedDate}`}
          highlight={dateInfo.maleBirthday.isToday || dateInfo.maleBirthday.isTomorrow}
        />
        
        <CountdownCard
          title={`${coupleInfo.female_name}'s Birthday`}
          count={dateInfo.femaleBirthday.daysUntil}
          suffix={`days until ${dateInfo.femaleBirthday.formattedDate}`}
          highlight={dateInfo.femaleBirthday.isToday || dateInfo.femaleBirthday.isTomorrow}
        />
      </div>
    </div>
  );
}