import { Nurse } from '../data/mockData';
import { Check } from 'lucide-react';

interface StaffPanelProps {
  nurses: Nurse[];
  schedule?: any;
  onNurseClick?: (nurse: Nurse) => void;
}

const FULL_DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

function matchesNurseName(scheduledName: string, nurseName: string) {
  const scheduled = scheduledName.toLowerCase().trim();
  const nurse = nurseName.toLowerCase().trim();
  return scheduled === nurse || scheduled.includes(nurse) || nurse.includes(scheduled);
}

function getBreakdown(name: string, schedule: any) {
  if (!schedule) return { morning: 0, afternoon: 0, night: 0, total: 0, hours: 0 };
  let morning = 0;
  let afternoon = 0;
  let night = 0;
  FULL_DAY_NAMES.forEach((day) => {
    if (schedule[day]?.morning?.some((scheduledName: string) => matchesNurseName(scheduledName, name))) morning++;
    if (schedule[day]?.afternoon?.some((scheduledName: string) => matchesNurseName(scheduledName, name))) afternoon++;
    if (schedule[day]?.night?.some((scheduledName: string) => matchesNurseName(scheduledName, name))) night++;
  });
  const total = morning + afternoon + night;
  return { morning, afternoon, night, total, hours: total * 8 };
}

const WARD_CFG: Record<string, { color: string; bg: string }> = {
  ICU: { color: '#00D4FF', bg: 'rgba(0,212,255,0.12)' },
  ER: { color: '#FF3D5A', bg: 'rgba(255,61,90,0.12)' },
  General: { color: '#00E5A0', bg: 'rgba(0,229,160,0.12)' },
  Pediatrics: { color: '#FF6B35', bg: 'rgba(255,107,53,0.12)' },
};

const SKILL_CFG: Record<number, { color: string }> = {
  1: { color: '#6B7280' },
  2: { color: '#FF6B35' },
  3: { color: '#00D4FF' },
  4: { color: '#A78BFA' },
};

function fatigueColor(fatigue: number) {
  if (fatigue >= 80) return '#FF3D5A';
  if (fatigue >= 60) return '#FF6B35';
  if (fatigue >= 40) return '#FFC107';
  return '#00E5A0';
}

function ShiftDot({ count, color }: { count: number; color: string }) {
  if (count === 0) return null;
  return (
    <span
      className="rounded px-1.5 py-0.5 text-[9px] font-semibold"
      style={{ color, background: `${color}18`, border: `1px solid ${color}30` }}
    >
      x{count}
    </span>
  );
}

export function StaffPanel({ nurses, schedule, onNurseClick }: StaffPanelProps) {
  const getFatigue = (nurse: Nurse) => (nurse as any).fatigue_score ?? nurse.fatigue ?? 50;
  const sorted = [...nurses].sort((a, b) => getFatigue(b) - getFatigue(a));

  const criticalCount = sorted.filter((nurse) => getFatigue(nurse) >= 80).length;
  const highCount = sorted.filter((nurse) => {
    const fatigue = getFatigue(nurse);
    return fatigue >= 60 && fatigue < 80;
  }).length;

  return (
    <div className="flex h-full flex-col">
      <div className="mb-2.5 shrink-0">
        <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-secondary">Staff & Fatigue</h3>

        {(criticalCount > 0 || highCount > 0) && (
          <div className="flex flex-wrap gap-1.5">
            {criticalCount > 0 && (
              <div className="flex items-center gap-1 rounded-full border border-error/30 bg-error/10 px-2 py-1">
                <div className="h-1.5 w-1.5 rounded-full bg-error" />
                <span className="text-[10px] font-semibold text-error">{criticalCount} Critical</span>
              </div>
            )}
            {highCount > 0 && (
              <div className="flex items-center gap-1 rounded-full px-2 py-1" style={{ background: 'rgba(255,107,53,0.10)', border: '1px solid rgba(255,107,53,0.30)' }}>
                <div className="h-1.5 w-1.5 rounded-full" style={{ background: '#FF6B35' }} />
                <span className="text-[10px] font-semibold" style={{ color: '#FF6B35' }}>{highCount} High</span>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-1.5 overflow-y-auto [scrollbar-width:none]">
        {sorted.map((nurse) => {
          const fatigue = getFatigue(nurse);
          const fatigueTone = fatigueColor(fatigue);
          const breakdown = getBreakdown(nurse.name, schedule);
          const isBlocked = (nurse as any).overtime_status === 'BLOCKED';
          const isWarning = (nurse as any).overtime_status === 'WARNING';
          const weeklyHours = (nurse as any).weekly_hours ?? breakdown.hours;
          const wardCfg = WARD_CFG[nurse.ward] ?? { color: '#9CA3AF', bg: 'rgba(156,163,175,0.1)' };
          const skillCfg = SKILL_CFG[nurse.skillLevel] ?? { color: '#6B7280' };
          const parts = nurse.name.trim().split(' ');
          const displayName = parts.length > 1 ? `${parts[0]} ${parts[parts.length - 1][0]}.` : parts[0];

          const cardTone = isBlocked || fatigue >= 80
            ? 'border-error/30 bg-error/5'
            : isWarning
            ? 'border-outline-variant bg-surface-container-low'
            : 'border-outline-variant bg-surface-container-lowest';

          return (
            <div
              key={nurse.id}
              onClick={() => onNurseClick?.(nurse)}
              className={`cursor-pointer rounded-lg border px-3 py-2.5 transition-colors hover:border-secondary/40 ${cardTone} ${isBlocked ? 'opacity-60' : ''}`}
            >
              <div className="mb-1.5 flex items-center gap-1.5">
                <div className="h-2 w-2 shrink-0 rounded-full" style={{ background: fatigueTone }} />

                <span
                  className={`flex-1 truncate text-xs font-semibold ${isBlocked ? 'text-on-surface-variant line-through' : 'text-on-surface'}`}
                >
                  {displayName}
                </span>

                <span
                  className="shrink-0 rounded px-1.5 py-0.5 text-[9px] font-semibold"
                  style={{ color: skillCfg.color, background: `${skillCfg.color}18`, border: `1px solid ${skillCfg.color}30` }}
                >
                  N{nurse.skillLevel}
                </span>

                <span
                  className="shrink-0 rounded px-1.5 py-0.5 text-[9px] font-medium"
                  style={{ color: wardCfg.color, background: wardCfg.bg }}
                >
                  {nurse.ward}
                </span>
              </div>

              <div className="mb-1.5 h-1 overflow-hidden rounded bg-surface-container-high">
                <div
                  className="h-full rounded transition-[width]"
                  style={{
                    width: `${Math.min(fatigue, 100)}%`,
                    background: `linear-gradient(90deg, ${fatigueTone}77, ${fatigueTone})`,
                  }}
                />
              </div>

              <div className="flex items-center gap-1">
                <div className="flex items-center gap-1">
                  {breakdown.morning > 0 && (
                    <>
                      <span className="text-[8px]" style={{ color: 'rgba(0,212,255,0.65)' }}>M</span>
                      <ShiftDot count={breakdown.morning} color="#00D4FF" />
                    </>
                  )}
                  {breakdown.afternoon > 0 && (
                    <>
                      <span className="ml-1 text-[8px]" style={{ color: 'rgba(139,92,246,0.65)' }}>A</span>
                      <ShiftDot count={breakdown.afternoon} color="#8B5CF6" />
                    </>
                  )}
                  {breakdown.night > 0 && (
                    <>
                      <span className="ml-1 text-[8px]" style={{ color: 'rgba(255,107,53,0.65)' }}>N</span>
                      <ShiftDot count={breakdown.night} color="#FF6B35" />
                    </>
                  )}
                  {breakdown.total === 0 && <span className="text-[9px] text-on-surface-variant">No shifts yet</span>}
                </div>

                <div className="flex-1" />

                <span className="text-[11px] font-semibold" style={{ color: fatigueTone }}>{fatigue}%</span>

                {isBlocked && (
                  <span className="ml-1 shrink-0 rounded border border-error/30 bg-error/10 px-1.5 py-0.5 text-[8px] font-semibold text-error">
                    OT
                  </span>
                )}
                {isWarning && !isBlocked && (
                  <span className="ml-1 shrink-0 rounded px-1.5 py-0.5 text-[8px] font-semibold" style={{ background: 'rgba(255,107,53,0.10)', border: '1px solid rgba(255,107,53,0.30)', color: '#FF6B35' }}>
                    {weeklyHours}h
                  </span>
                )}

                {nurse.requests_honored && (nurse.unavailable_days?.length ?? 0) > 0 && (
                  <Check size={10} className="ml-1 shrink-0 text-secondary" />
                )}
              </div>
            </div>
          );
        })}
      </div>

      <p className="mt-2 shrink-0 text-center text-[9px] text-on-surface-variant">
        Tap a card for details · sorted by fatigue
      </p>
    </div>
  );
}
