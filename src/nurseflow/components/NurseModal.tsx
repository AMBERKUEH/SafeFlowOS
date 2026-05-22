import { X, Loader2 } from 'lucide-react';
import { useState, useEffect } from 'react';
import { Nurse } from '../data/mockData';

interface NurseModalProps {
  nurse: Nurse;
  onClose: () => void;
}

const skillLabels = {
  1: 'N1',
  2: 'N2',
  3: 'N3',
  4: 'N4',
};

const wardColors = {
  ICU: '#00D4FF',
  ER: '#FF3D5A',
  General: '#00E5A0',
  Pediatrics: '#FF6B35',
};

const skillColors = {
  1: '#6B7280',
  2: '#FF6B35',
  3: '#00D4FF',
  4: '#FF3D5A',
};

const FULL_DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const DAY_LABELS: Record<string, string> = {
  Monday: 'Mon',
  Tuesday: 'Tue',
  Wednesday: 'Wed',
  Thursday: 'Thu',
  Friday: 'Fri',
  Saturday: 'Sat',
  Sunday: 'Sun',
};

function getStoredScheduleResult() {
  const scheduleResult = localStorage.getItem('scheduleResult');
  return scheduleResult ? JSON.parse(scheduleResult) : null;
}

function matchesNurseName(scheduledName: string, nurseName: string) {
  const scheduled = scheduledName.toLowerCase().trim();
  const nurse = nurseName.toLowerCase().trim();
  if (!scheduled || !nurse) return false;
  return scheduled === nurse || scheduled.includes(nurse) || nurse.includes(scheduled);
}

function getNurseAssignments(nurse: Nurse, schedule: any) {
  return FULL_DAY_NAMES.flatMap((day) => {
    const shifts = schedule?.[day] || {};
    return (['morning', 'afternoon', 'night'] as const)
      .filter((shift) => shifts[shift]?.some((scheduledName: string) => matchesNurseName(scheduledName, nurse.name)))
      .map((shift) => ({
        day: DAY_LABELS[day],
        shift: `${shift[0].toUpperCase()}${shift.slice(1)}` as 'Morning' | 'Afternoon' | 'Night',
        ward: nurse.ward,
      }));
  });
}

function summarizeAssignment(nurse: Nurse, assignments: ReturnType<typeof getNurseAssignments>, scheduleResult: any) {
  const emergencyEvents = scheduleResult?.emergency_events || [];
  const nurseEmergencyEvents = emergencyEvents.filter((event: any) =>
    matchesNurseName(event.leave_nurse || '', nurse.name) ||
    matchesNurseName(event.replacement_nurse || '', nurse.name)
  );

  const emergencyPoints = nurseEmergencyEvents.map((event: any) => {
    if (matchesNurseName(event.leave_nurse || '', nurse.name)) {
      return `Emergency leave recorded: removed from ${event.day} ${event.shift} in ${event.department}; replacement ${event.replacement_nurse || 'pending head nurse review'}.`;
    }
    return `Emergency replacement recorded: assigned to cover ${event.department} on ${event.day} ${event.shift} for ${event.leave_nurse}.`;
  });

  if (assignments.length === 0) {
    const daysOff = nurse.unavailable_days?.length ? ` Their requested unavailable days are ${nurse.unavailable_days.join(', ')}.` : '';
    return [
      `${nurse.name} is not assigned in the amended schedule.`,
      daysOff.trim() || 'No unavailable-day request is recorded for this nurse.',
      ...(emergencyPoints.length ? emergencyPoints : ['No emergency replacement note is recorded for this nurse.']),
    ];
  }

  const shiftCounts = assignments.reduce(
    (acc, assignment) => {
      acc[assignment.shift] += 1;
      return acc;
    },
    { Morning: 0, Afternoon: 0, Night: 0 }
  );
  const assignedText = assignments.map((assignment) => `${assignment.day} ${assignment.shift}`).join(', ');
  const requestText = nurse.unavailable_days?.length
    ? nurse.requests_honored
      ? `Unavailable-day request honored: ${nurse.unavailable_days.join(', ')}.`
      : 'Unavailable-day request needs review.'
    : 'No unavailable-day request is recorded for this nurse.';
  const overtimeStatus = (nurse as any).overtime_status;
  const overtimeText = overtimeStatus === 'BLOCKED'
    ? 'Blocked from extra overtime.'
    : overtimeStatus === 'WARNING'
    ? `Near the weekly limit at ${(nurse as any).weekly_hours ?? assignments.length * 8} hours.`
    : `Within weekly hours at ${(nurse as any).weekly_hours ?? assignments.length * 8} hours.`;
  const nurseAlerts = [...(scheduleResult?.alerts || []), ...(scheduleResult?.memory_insights || [])]
    .filter((alert: string) => alert.toLowerCase().includes(nurse.name.toLowerCase()));
  const replacementText = nurseAlerts.length > 0
    ? `Emergency/replacement note: ${nurseAlerts[0]}`
    : 'No emergency replacement note is recorded for this nurse.';

  return [
    `${nurse.name} has ${assignments.length} shifts in the amended schedule: ${assignedText}.`,
    `Shift mix: ${shiftCounts.Morning} morning, ${shiftCounts.Afternoon} afternoon, ${shiftCounts.Night} night.`,
    requestText,
    overtimeText,
    ...(emergencyPoints.length ? emergencyPoints : [replacementText]),
  ];
}

export function NurseModal({ nurse, onClose }: NurseModalProps) {
  const [explanation, setExplanation] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);
  const [assignedShifts, setAssignedShifts] = useState(nurse.shifts || []);

  useEffect(() => {
    const fetchExplanation = async () => {
      setIsLoading(true);
      setError(false);
      
      const scheduleResult = getStoredScheduleResult();
      const schedule = scheduleResult?.schedule || {};
      const scheduleAssignments = getNurseAssignments(nurse, schedule);
      const shiftsToShow = scheduleAssignments.length > 0 ? scheduleAssignments : nurse.shifts || [];
      setAssignedShifts(shiftsToShow);
      
      setExplanation(summarizeAssignment(nurse, shiftsToShow, scheduleResult));
      
      setIsLoading(false);
    };

    fetchExplanation();
  }, [nurse]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-surface/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative w-[440px] bg-surface-container-lowest rounded-xl border border-outline-variant shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between p-6 pb-4">
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-semibold tracking-tight text-on-surface">{nurse.name}</h2>
            <span
              className="px-2 py-1 rounded text-[11px] font-semibold text-white"
              style={{
                backgroundColor: skillColors[nurse.skillLevel],
              }}
            >
              {skillLabels[nurse.skillLevel]}
            </span>
            <span
              className="px-2 py-1 rounded text-[11px]"
              style={{
                backgroundColor: `${wardColors[nurse.ward]}33`,
                color: wardColors[nurse.ward],
              }}
            >
              {nurse.ward}
            </span>
          </div>
          <button
            onClick={onClose}
            className="text-on-surface-variant hover:text-on-surface transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Shifts Section */}
        <div className="px-6 pb-4">
          <h3
            className="mb-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-secondary"
          >
            This Week's Shifts
          </h3>
          <div className="flex flex-col gap-2">
            {assignedShifts.length > 0 ? (
              assignedShifts.map((shift, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between py-2"
                >
                  <div className="flex items-center gap-4">
                    <span className="w-10 text-sm text-on-surface-variant">
                      {shift.day}
                    </span>
                    <span className="w-20 text-sm text-on-surface">
                      {shift.shift}
                    </span>
                  </div>
                  <span
                    className="px-3 py-1 rounded text-xs"
                    style={{
                      backgroundColor: `${wardColors[shift.ward]}33`,
                      color: wardColors[shift.ward],
                    }}
                  >
                    {shift.ward}
                  </span>
                </div>
              ))
            ) : (
              <p className="text-sm text-on-surface-variant">
                No shifts assigned yet
              </p>
            )}
          </div>
        </div>

        {/* Why Section */}
        <div className="px-6 pb-6">
          <h3
            className="mb-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-secondary"
          >
            Why These Shifts?
          </h3>
          
          {isLoading ? (
            <div className="flex items-center gap-2 text-on-surface-variant">
              <Loader2 size={16} className="animate-spin" />
              <span className="text-sm">Getting explanation...</span>
            </div>
          ) : error ? (
            <p className="text-sm text-on-surface-variant leading-relaxed">
              Could not load explanation
            </p>
          ) : (
            <ul className="space-y-2 text-sm text-on-surface">
              {explanation.map((point, index) => (
                <li key={index} className="flex gap-2 leading-relaxed">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-secondary" />
                  <span>{point}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
