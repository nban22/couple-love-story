import { useMemo } from 'react';
import { differenceInDays, isToday, isTomorrow, format, isThisYear } from 'date-fns';

/**
 * Custom hook for date calculations with performance optimizations
 * Uses memoization to prevent unnecessary recalculations on re-renders
 * Critical: Date calculations can be expensive, especially with frequent updates
 */
export function useDateCalculations(loveStartDate: string, maleBirthday: string, femaleBirthday: string) {
  return useMemo(() => {
    const now = new Date();
    const currentYear = now.getFullYear();
    
    // Calculate days together with proper date handling
    const startDate = new Date(loveStartDate);
    const daysInLove = differenceInDays(now, startDate);
    
    // Birthday calculation logic with year-agnostic approach
    // Performance: Pre-calculate next occurrence to avoid repeated date operations
    const calculateNextBirthday = (birthdayString: string) => {
      const [month, day] = birthdayString.split('-').map(Number);
      let nextBirthday = new Date(currentYear, month - 1, day);
      
      // If birthday has passed this year, calculate for next year
      if (nextBirthday < now) {
        nextBirthday = new Date(currentYear + 1, month - 1, day);
      }
      
      const daysUntil = differenceInDays(nextBirthday, now);
      
      return {
        date: nextBirthday,
        daysUntil,
        isToday: daysUntil === 0,
        isTomorrow: daysUntil === 1,
        formattedDate: format(nextBirthday, 'MMMM d'),
      };
    };
    
    const maleBirthdayInfo = calculateNextBirthday(maleBirthday);
    const femaleBirthdayInfo = calculateNextBirthday(femaleBirthday);
    
    return {
      daysInLove,
      maleBirthday: maleBirthdayInfo,
      femaleBirthday: femaleBirthdayInfo,
      // Derived state for UI highlights
      hasBirthdayToday: maleBirthdayInfo.isToday || femaleBirthdayInfo.isToday,
      hasBirthdayTomorrow: maleBirthdayInfo.isTomorrow || femaleBirthdayInfo.isTomorrow,
    };
  }, [loveStartDate, maleBirthday, femaleBirthday]); // Dependency array ensures recalculation only when dates change
}