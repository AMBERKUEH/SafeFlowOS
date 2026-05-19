import { Nurse } from '../data/mockData';
import { Check } from 'lucide-react';

interface StaffPanelProps {
  nurses: Nurse[];
  schedule?: any;
  onNurseClick?: (nurse: Nurse) => void;
}

const FULL_DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

function getBreakdown(name: string, schedule: any) {
  if (!schedule) return { morning: 0, afternoon: 0, night: 0, total: 0, hours: 0 };
  let morning = 0, afternoon = 0, night = 0;
  FULL_DAY_NAMES.forEach(day => {
    if (schedule[day]?.morning?.includes(name)) morning++;
    if (schedule[day]?.afternoon?.includes(name)) afternoon++;
    if (schedule[day]?.night?.includes(name)) night++;
  });
  const total = morning + afternoon + night;
  return { morning, afternoon, night, total, hours: total * 8 };
}

const WARD_CFG: Record<string, { color: string; bg: string }> = {
  ICU:        { color: '#00D4FF', bg: 'rgba(0,212,255,0.12)'  },
  ER:         { color: '#FF3D5A', bg: 'rgba(255,61,90,0.12)'  },
  General:    { color: '#00E5A0', bg: 'rgba(0,229,160,0.12)'  },
  Pediatrics: { color: '#FF6B35', bg: 'rgba(255,107,53,0.12)' },
};

const SKILL_CFG: Record<number, { color: string }> = {
  1: { color: '#6B7280' },
  2: { color: '#FF6B35' },
  3: { color: '#00D4FF' },
  4: { color: '#A78BFA' },
};

function fatigueColor(f: number) {
  if (f >= 80) return '#FF3D5A';
  if (f >= 60) return '#FF6B35';
  if (f >= 40) return '#FFC107';
  return '#00E5A0';
}

function ShiftDot({ count, color }: { count: number; color: string }) {
  if (count === 0) return null;
  return (
    <span style={{
      fontSize: '9px', fontWeight: 700,
      color, padding: '1px 5px', borderRadius: '4px',
      background: `${color}18`, border: `1px solid ${color}30`,
    }}>
      ×{count}
    </span>
  );
}

export function StaffPanel({ nurses, schedule, onNurseClick }: StaffPanelProps) {
  const sorted = [...nurses].sort((a, b) => (b.fatigue ?? 50) - (a.fatigue ?? 50));

  const criticalCount = sorted.filter(n => (n.fatigue ?? 50) >= 80).length;
  const highCount     = sorted.filter(n => { const f = n.fatigue ?? 50; return f >= 60 && f < 80; }).length;

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>

      {/* ── Header ── */}
      <div style={{ flexShrink: 0, marginBottom: '10px' }}>
        <h3 style={{
          fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: '11px',
          color: '#00D4FF', textTransform: 'uppercase', letterSpacing: '2px', margin: '0 0 8px',
        }}>
          Staff & Fatigue
        </h3>

        {/* Alert pills */}
        {(criticalCount > 0 || highCount > 0) && (
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {criticalCount > 0 && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: '4px',
                padding: '3px 8px', borderRadius: '20px',
                background: 'rgba(255,61,90,0.12)', border: '1px solid rgba(255,61,90,0.4)',
              }}>
                <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#FF3D5A', boxShadow: '0 0 5px #FF3D5A' }} />
                <span style={{ fontSize: '10px', color: '#FF3D5A', fontWeight: 700 }}>{criticalCount} Critical</span>
              </div>
            )}
            {highCount > 0 && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: '4px',
                padding: '3px 8px', borderRadius: '20px',
                background: 'rgba(255,107,53,0.12)', border: '1px solid rgba(255,107,53,0.4)',
              }}>
                <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#FF6B35', boxShadow: '0 0 5px #FF6B35' }} />
                <span style={{ fontSize: '10px', color: '#FF6B35', fontWeight: 700 }}>{highCount} High</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Cards ── */}
      <div style={{
        flex: 1, overflowY: 'auto', scrollbarWidth: 'none',
        display: 'flex', flexDirection: 'column', gap: '5px',
      }}>
        {sorted.map(nurse => {
          const fatigue  = nurse.fatigue ?? 50;
          const fc       = fatigueColor(fatigue);
          const bd       = getBreakdown(nurse.name, schedule);
          const isBlocked = (nurse as any).overtime_status === 'BLOCKED';
          const isWarning = (nurse as any).overtime_status === 'WARNING';
          const weeklyHours = (nurse as any).weekly_hours ?? 0;
          const wardCfg  = WARD_CFG[nurse.ward] ?? { color: '#9CA3AF', bg: 'rgba(156,163,175,0.1)' };
          const skillCfg = SKILL_CFG[nurse.skillLevel] ?? { color: '#6B7280' };

          // Short display name
          const parts = nurse.name.trim().split(' ');
          const displayName = parts.length > 1
            ? `${parts[0]} ${parts[parts.length - 1][0]}.`
            : parts[0];

          const borderColor = isBlocked
            ? 'rgba(255,61,90,0.40)'
            : isWarning
              ? 'rgba(255,107,53,0.35)'
              : fatigue >= 80
                ? 'rgba(255,61,90,0.25)'
                : 'rgba(255,255,255,0.06)';

          const cardBg = isBlocked
            ? 'rgba(255,61,90,0.06)'
            : fatigue >= 80
              ? 'rgba(255,61,90,0.04)'
              : 'rgba(255,255,255,0.025)';

          return (
            <div
              key={nurse.id}
              onClick={() => onNurseClick?.(nurse)}
              style={{
                borderRadius: '10px', background: cardBg,
                border: `1px solid ${borderColor}`,
                padding: '9px 11px',
                cursor: 'pointer', transition: 'border-color 0.15s',
                opacity: isBlocked ? 0.6 : 1,
              }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.borderColor = '#00D4FF44'}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.borderColor = borderColor}
            >
              {/* ── Top row: dot · name · badges · fatigue% ── */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>

                {/* Fatigue status dot */}
                <div style={{
                  width: '7px', height: '7px', borderRadius: '50%', flexShrink: 0,
                  background: fc, boxShadow: `0 0 6px ${fc}99`,
                }} />

                {/* Name */}
                <span style={{
                  fontSize: '12px', fontWeight: 600, flex: 1,
                  color: isBlocked ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.85)',
                  textDecoration: isBlocked ? 'line-through' : 'none',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {displayName}
                </span>

                {/* Skill chip */}
                <span style={{
                  fontSize: '9px', fontWeight: 700,
                  color: skillCfg.color, padding: '1px 5px', borderRadius: '4px',
                  background: `${skillCfg.color}18`, border: `1px solid ${skillCfg.color}30`,
                  flexShrink: 0,
                }}>
                  N{nurse.skillLevel}
                </span>

                {/* Ward chip */}
                <span style={{
                  fontSize: '9px', fontWeight: 500,
                  color: wardCfg.color, padding: '1px 5px', borderRadius: '4px',
                  background: wardCfg.bg, flexShrink: 0,
                }}>
                  {nurse.ward}
                </span>
              </div>

              {/* ── Fatigue bar ── */}
              <div style={{
                height: '4px', borderRadius: '2px',
                background: 'rgba(255,255,255,0.05)', overflow: 'hidden',
                marginBottom: '6px',
              }}>
                <div style={{
                  height: '100%', width: `${fatigue}%`,
                  borderRadius: '2px',
                  background: `linear-gradient(90deg, ${fc}77, ${fc})`,
                  boxShadow: `0 0 6px ${fc}55`,
                  transition: 'width 0.4s ease',
                }} />
              </div>

              {/* ── Bottom row: shift chips · fatigue% · OT badge ── */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>

                {/* Shift breakdown */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                  {bd.morning   > 0 && <><span style={{ fontSize: '8px', color: 'rgba(0,212,255,0.5)' }}>M</span><ShiftDot count={bd.morning}   color="#00D4FF" /></>}
                  {bd.afternoon > 0 && <><span style={{ fontSize: '8px', color: 'rgba(139,92,246,0.5)', marginLeft: bd.morning > 0 ? '3px' : 0 }}>A</span><ShiftDot count={bd.afternoon} color="#8B5CF6" /></>}
                  {bd.night     > 0 && <><span style={{ fontSize: '8px', color: 'rgba(255,107,53,0.5)',  marginLeft: bd.afternoon > 0 ? '3px' : 0 }}>N</span><ShiftDot count={bd.night}     color="#FF6B35" /></>}
                  {bd.total === 0 && (
                    <span style={{ fontSize: '9px', color: 'rgba(255,255,255,0.2)' }}>No shifts yet</span>
                  )}
                </div>

                <div style={{ flex: 1 }} />

                {/* Fatigue % */}
                <span style={{ fontSize: '11px', fontWeight: 700, color: fc }}>{fatigue}%</span>

                {/* OT / Warning badge */}
                {isBlocked && (
                  <span style={{
                    fontSize: '8px', fontWeight: 700, color: '#FF3D5A',
                    padding: '1px 5px', borderRadius: '3px',
                    background: 'rgba(255,61,90,0.15)', border: '1px solid rgba(255,61,90,0.4)',
                    marginLeft: '4px', flexShrink: 0,
                  }}>⛔ OT</span>
                )}
                {isWarning && !isBlocked && (
                  <span style={{
                    fontSize: '8px', fontWeight: 700, color: '#FF6B35',
                    padding: '1px 5px', borderRadius: '3px',
                    background: 'rgba(255,107,53,0.15)', border: '1px solid rgba(255,107,53,0.4)',
                    marginLeft: '4px', flexShrink: 0,
                  }}>⚠ {weeklyHours}h</span>
                )}

                {/* Days off honoured */}
                {nurse.requests_honored && nurse.unavailable_days?.length > 0 && (
                  <Check size={10} color="#00E5A0" style={{ marginLeft: '4px', flexShrink: 0 }} />
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer hint */}
      <p style={{
        marginTop: '8px', flexShrink: 0, textAlign: 'center',
        fontSize: '9px', color: 'rgba(255,255,255,0.15)', fontStyle: 'italic',
      }}>
        Tap a card for details · sorted by fatigue
      </p>
    </div>
  );
}