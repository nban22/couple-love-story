import React, { memo } from 'react';
import { useDateCalculations } from './DateCalculations';

interface CountdownCardProps {
  title: string;
  count: number;
  suffix: string;
  highlight?: boolean;
  className?: string;
}

/**
 * Memoized countdown card component for performance optimization
 * React.memo prevents unnecessary re-renders when props haven't changed
 * Critical for components that receive frequent updates from parent timers
 */
const CountdownCard = memo<CountdownCardProps>(({ title, count, suffix, highlight, className }) => {
  return (
    <div className={`
      relative overflow-hidden rounded-xl p-6 text-center transition-all duration-300
      ${highlight 
        ? 'bg-gradient-to-br from-pink-100 to-rose-100 border-2 border-pink-300 shadow-lg transform scale-105' 
        : 'bg-white/80 backdrop-blur-sm border border-pink-200 hover:shadow-md'
      }
      ${className || ''}
    `}>
      {/* Highlight animation overlay - CSS-only for performance */}
      {highlight && (
        <div className="absolute inset-0 bg-gradient-to-r from-pink-200/0 via-pink-200/30 to-pink-200/0 animate-pulse" />
      )}
      
      <div className="relative z-10">
        <h3 className="text-sm font-medium text-gray-600 mb-2">{title}</h3>
        <div className="text-3xl font-bold text-pink-600 mb-1">
          {count.toLocaleString()} {/* Localized number formatting */}
        </div>
        <p className="text-sm text-gray-500">{suffix}</p>
      </div>
    </div>
  );
});

CountdownCard.displayName = 'CountdownCard'; // Required for React.memo debugging

export default CountdownCard;