/**
 * ScheduleCalendar Component
 * 
 * Displays a weekly schedule grid with days as columns and shifts as rows.
 * Each nurse is shown as a colored badge based on their ward assignment.
 * 
 * Props:
 *   - schedule: Object with days as keys (Monday-Sunday), each containing
 *               morning/afternoon/night arrays of nurse names
 *   - nurses: Array of nurse objects with name and ward properties
 */

import React from 'react';

// Ward color mapping
const WARD_COLORS = {
  'ICU': 'bg-blue-500 hover:bg-blue-600',
  'ER': 'bg-red-500 hover:bg-red-600',
  'General': 'bg-green-500 hover:bg-green-600',
  'Pediatrics': 'bg-orange-500 hover:bg-orange-600',
  'default': 'bg-gray-500 hover:bg-gray-600'
};

// Ward text colors for better contrast
const WARD_TEXT_COLORS = {
  'ICU': 'text-white',
  'ER': 'text-white',
  'General': 'text-white',
  'Pediatrics': 'text-white',
  'default': 'text-white'
};

const ScheduleCalendar = ({ schedule, nurses }) => {
  // Days of the week in order
  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  
  // Shifts in order
  const shifts = ['morning', 'afternoon', 'night'];
  
  // Format shift name for display
  const formatShift = (shift) => {
    return shift.charAt(0).toUpperCase() + shift.slice(1);
  };
  
  // Get ward for a nurse name
  const getNurseWard = (nurseName) => {
    const nurse = nurses?.find(n => n.name === nurseName);
    return nurse?.ward || 'default';
  };
  
  // Get color class for nurse badge
  const getNurseColorClass = (nurseName) => {
    const ward = getNurseWard(nurseName);
    return WARD_COLORS[ward] || WARD_COLORS.default;
  };
  
  // Get text color class for nurse badge
  const getNurseTextClass = (nurseName) => {
    const ward = getNurseWard(nurseName);
    return WARD_TEXT_COLORS[ward] || WARD_TEXT_COLORS.default;
  };
  
  // Get nurses for a specific day and shift
  const getNursesForShift = (day, shift) => {
    if (!schedule || !schedule[day]) return [];
    return schedule[day][shift] || [];
  };

  return (
    <div className="w-full overflow-x-auto">
      <div className="min-w-[800px] bg-white dark:bg-slate-900 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700">
        {/* Header - Days of Week */}
        <div className="grid grid-cols-8 border-b border-slate-200 dark:border-slate-700">
          <div className="p-4 font-semibold text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700">
            Shift
          </div>
          {days.map((day) => (
            <div 
              key={day}
              className="p-4 font-semibold text-center text-slate-700 dark:text-slate-200 bg-slate-50 dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700 last:border-r-0"
            >
              {day}
            </div>
          ))}
        </div>
        
        {/* Body - Shifts */}
        {shifts.map((shift, shiftIndex) => (
          <div 
            key={shift}
            className={`grid grid-cols-8 ${shiftIndex !== shifts.length - 1 ? 'border-b border-slate-200 dark:border-slate-700' : ''}`}
          >
            {/* Shift Label */}
            <div className="p-4 font-medium text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700 flex items-center">
              {formatShift(shift)}
            </div>
            
            {/* Day Columns */}
            {days.map((day) => {
              const shiftNurses = getNursesForShift(day, shift);
              return (
                <div 
                  key={`${day}-${shift}`}
                  className="p-3 min-h-[100px] border-r border-slate-200 dark:border-slate-700 last:border-r-0 bg-white dark:bg-slate-900"
                >
                  <div className="flex flex-wrap gap-1.5">
                    {shiftNurses.length > 0 ? (
                      shiftNurses.map((nurseName, idx) => (
                        <span
                          key={idx}
                          className={`
                            inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium
                            ${getNurseColorClass(nurseName)}
                            ${getNurseTextClass(nurseName)}
                            transition-colors duration-200 cursor-pointer
                            shadow-sm
                          `}
                          title={`${nurseName} - ${getNurseWard(nurseName)}`}
                        >
                          {nurseName}
                        </span>
                      ))
                    ) : (
                      <span className="text-slate-400 dark:text-slate-600 text-sm italic">
                        No nurses
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
      
      {/* Legend */}
      <div className="mt-4 flex flex-wrap gap-4 justify-center">
        <div className="text-sm text-slate-600 dark:text-slate-400 font-medium">
          Ward Legend:
        </div>
        {Object.entries(WARD_COLORS).filter(([ward]) => ward !== 'default').map(([ward, colorClass]) => (
          <div key={ward} className="flex items-center gap-1.5">
            <span className={`inline-block w-3 h-3 rounded-full ${colorClass.replace('hover:', '')}`}></span>
            <span className="text-xs text-slate-600 dark:text-slate-400">{ward}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ScheduleCalendar;
