import { useState } from 'react';
import { Nurse } from '../data/mockData';
import { AlertCircle } from 'lucide-react';

interface WeeklyScheduleProps {
  nurses: Nurse[];
  schedule?: any;
  staffingRequirements?: any;
  highlightCell?: { day: string; shift: string };
}

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const FULL_DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

// ── Straight 0–24 h timeline. Night wraps: rendered as two segments [23,24] + [0,7] ──
function pct(h: number) { return (h / 24) * 100; }
function fmt(h: number) { return `${String(h === 24 ? 0 : h).padStart(2, '0')}:00`; }

const SHIFT_BANDS = [
  {
    key: 'night',
    label: 'Night',     range: '00–08',
    seg: [{ s: 0, e: 8 }],                      // clean block at start
    color: 'rgba(255,107,53,0.12)',  accent: 'rgba(255,107,53,0.50)',
    text: '#FF6B35',  glow: 'rgba(255,107,53,0.35)', dim: 'rgba(255,107,53,0.04)',
  },
  {
    key: 'morning',
    label: 'Morning',   range: '08–16',
    seg: [{ s: 8, e: 16 }],
    color: 'rgba(0,212,255,0.10)',   accent: 'rgba(0,212,255,0.50)',
    text: '#00D4FF',  glow: 'rgba(0,212,255,0.35)', dim: 'rgba(0,212,255,0.035)',
  },
  {
    key: 'afternoon',
    label: 'Afternoon', range: '16–00',
    seg: [{ s: 16, e: 24 }],
    color: 'rgba(139,92,246,0.10)',  accent: 'rgba(139,92,246,0.50)',
    text: '#8B5CF6',  glow: 'rgba(139,92,246,0.35)', dim: 'rgba(139,92,246,0.035)',
  },
] as const;

// Ruler ticks (key shift boundaries highlighted)
const TICKS = [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24];
const KEY_TICKS = new Set([0, 8, 16, 24]);

const WARD: Record<string, { bg: string; text: string; border: string }> = {
  ICU:        { bg: 'rgba(0,212,255,0.15)',  text: '#00D4FF', border: 'rgba(0,212,255,0.55)' },
  ER:         { bg: 'rgba(255,61,90,0.15)',   text: '#FF3D5A', border: 'rgba(255,61,90,0.55)' },
  General:    { bg: 'rgba(0,229,160,0.15)',   text: '#00E5A0', border: 'rgba(0,229,160,0.55)' },
  Pediatrics: { bg: 'rgba(255,107,53,0.15)',  text: '#FF6B35', border: 'rgba(255,107,53,0.55)' },
};

// ── helpers ────────────────────────────────────────────────────────────────
function getNurseShift(name: string, fullDay: string, schedule: any): string | null {
  if (!schedule) return null;
  const d = schedule[fullDay];
  if (!d) return null;
  if (d.morning?.includes(name)) return 'morning';
  if (d.afternoon?.includes(name)) return 'afternoon';
  if (d.night?.includes(name)) return 'night';
  return null;
}

function getWeekly(name: string, schedule: any) {
  let morning = 0, afternoon = 0, night = 0;
  if (schedule) {
    FULL_DAY_NAMES.forEach(day => {
      if (schedule[day]?.morning?.includes(name)) morning++;
      if (schedule[day]?.afternoon?.includes(name)) afternoon++;
      if (schedule[day]?.night?.includes(name)) night++;
    });
  }
  return { morning, afternoon, night, total: morning + afternoon + night };
}

// ── Nurse timeline bar ─────────────────────────────────────────────────────
function TimelineBar({ shiftKey, highlighted, isOff }: {
  shiftKey: string | null; highlighted: boolean; isOff: boolean;
}) {
  const band = SHIFT_BANDS.find(b => b.key === shiftKey) ?? null;

  return (
    <div style={{
      position: 'relative', height: '34px', flex: 1, borderRadius: '5px',
      background: 'rgba(255,255,255,0.02)',
      border: highlighted ? '1px solid rgba(255,61,90,0.55)' : '1px solid rgba(255,255,255,0.04)',
      overflow: 'hidden',
    }}>
      {/* Dim band backgrounds */}
      {SHIFT_BANDS.map(b =>
        b.seg.map((seg, si) => (
          <div key={`${b.key}-dim-${si}`} style={{
            position: 'absolute', top: 0, bottom: 0,
            left: `${pct(seg.s)}%`, width: `${pct(seg.e) - pct(seg.s)}%`,
            background: b.dim,
          }} />
        ))
      )}

      {/* Shift boundary lines */}
      {[8, 16].map(h => (
        <div key={h} style={{
          position: 'absolute', top: 0, bottom: 0,
          left: `${pct(h)}%`, width: '1px',
          background: 'rgba(255,255,255,0.10)', pointerEvents: 'none',
        }} />
      ))}

      {/* Active shift block(s) */}
      {band && !isOff && band.seg.map((seg, si) => (
        <div key={si} style={{
          position: 'absolute', top: '5px', bottom: '5px',
          left: `${pct(seg.s)}%`, width: `${pct(seg.e) - pct(seg.s)}%`,
          background: band.color, borderRadius: '3px',
          border: `1px solid ${band.accent}`,
          boxShadow: `0 0 10px ${band.glow}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {si === 0 && (
            <span style={{ fontSize: '9px', color: band.text, fontWeight: 700, opacity: 0.85 }}>
              {band.label}
            </span>
          )}
        </div>
      ))}

      {/* Day off */}
      {isOff && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ fontSize: '9px', color: 'rgba(255,255,255,0.18)', letterSpacing: '1.5px' }}>DAY OFF</span>
        </div>
      )}

      {/* No shift */}
      {!band && !isOff && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', paddingLeft: '10px' }}>
          <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.08)' }}>—</span>
        </div>
      )}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────
export function WeeklySchedule({ nurses, schedule, highlightCell }: WeeklyScheduleProps) {
  const [activeDay, setActiveDay] = useState(0);
  const [tooltip, setTooltip] = useState<{ nurse: Nurse; weekly: ReturnType<typeof getWeekly>; x: number; y: number } | null>(null);

  const fullDay = FULL_DAY_NAMES[activeDay];
  const shortDay = DAYS[activeDay];

  const getDayStaffCount = (di: number) => {
    const fd = FULL_DAY_NAMES[di];
    if (!schedule?.[fd]) return 0;
    const seen = new Set<string>();
    ['morning', 'afternoon', 'night'].forEach(k =>
      (schedule[fd][k] || []).forEach((n: string) => seen.add(n))
    );
    return seen.size;
  };

  const getCount = (shiftKey: string) =>
    schedule?.[fullDay]?.[shiftKey]?.length ?? 0;

  return (
    <div style={{ userSelect: 'none' }}>
      {/* Title */}
      <h3 style={{
        fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: '11px',
        color: '#00D4FF', textTransform: 'uppercase', letterSpacing: '2px', marginBottom: '14px',
      }}>Weekly Schedule</h3>

      {/* Day tabs */}
      <div style={{ display: 'flex', gap: '2px', marginBottom: '12px' }}>
        {DAYS.map((day, idx) => {
          const count = getDayStaffCount(idx);
          const active = idx === activeDay;
          const weekend = idx >= 5;
          const empty = count === 0;
          return (
            <button key={day} onClick={() => setActiveDay(idx)} style={{
              flex: 1, padding: '7px 4px', borderRadius: '6px', cursor: 'pointer',
              border: active
                ? '1px solid rgba(0,212,255,0.55)'
                : empty
                ? '1px solid rgba(255,61,90,0.35)'
                : '1px solid rgba(255,255,255,0.05)',
              background: active
                ? 'rgba(0,212,255,0.13)'
                : empty
                ? 'rgba(255,61,90,0.07)'
                : weekend
                ? 'rgba(255,255,255,0.015)'
                : 'rgba(255,255,255,0.025)',
              transition: 'all 0.15s ease',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px',
            }}>
              <span style={{
                fontSize: '10px', fontFamily: 'Syne, sans-serif', fontWeight: 700,
                letterSpacing: '0.8px',
                color: active ? '#00D4FF' : empty ? '#FF3D5A' : weekend ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.55)',
              }}>
                {day.toUpperCase()}
              </span>
              <span style={{ fontSize: '9px', color: active ? 'rgba(0,212,255,0.7)' : empty ? 'rgba(255,61,90,0.7)' : 'rgba(255,255,255,0.2)' }}>
                {empty ? 'EMPTY' : `${count} staff`}
              </span>
            </button>
          );
        })}
      </div>

      {/* Shift coverage chips for active day */}
      <div style={{ display: 'flex', gap: '6px', marginBottom: '10px', alignItems: 'center' }}>
        {SHIFT_BANDS.map(band => {
          const count = getCount(band.key);
          const empty = count === 0;
          const under = count > 0 && count < 3;
          return (
            <div key={band.key} style={{
              display: 'flex', alignItems: 'center', gap: '5px',
              padding: '4px 10px', borderRadius: '5px',
              background: empty ? 'rgba(255,61,90,0.10)' : under ? 'rgba(255,193,7,0.09)' : band.color,
              border: `1px solid ${empty ? 'rgba(255,61,90,0.4)' : under ? 'rgba(255,193,7,0.4)' : band.accent}`,
            }}>
              <span style={{ fontSize: '9px', fontWeight: 600, color: empty ? '#FF3D5A' : under ? '#FFC107' : band.text }}>
                {band.label}
              </span>
              <span style={{ fontSize: '13px', fontWeight: 800, color: empty ? '#FF3D5A' : under ? '#FFC107' : band.text }}>
                {count}
              </span>
              {empty && <AlertCircle size={11} style={{ color: '#FF3D5A' }} />}
              {under && <span style={{ fontSize: '10px', color: '#FFC107' }}>⚠</span>}
            </div>
          );
        })}

        {/* Legend */}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: '10px', alignItems: 'center' }}>
          {SHIFT_BANDS.map(b => (
            <div key={b.key} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '2px', background: b.color, border: `1px solid ${b.accent}` }} />
              <span style={{ fontSize: '9px', color: 'rgba(255,255,255,0.28)' }}>{b.range}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Time ruler */}
      <div style={{ display: 'grid', gridTemplateColumns: '148px 1fr', marginBottom: '5px' }}>
        <div />
        <div style={{ position: 'relative', height: '22px' }}>
          <div style={{ position: 'absolute', left: 0, right: 0, bottom: '5px', height: '1px', background: 'rgba(255,255,255,0.06)' }} />
          {TICKS.map(h => (
            <div key={h} style={{
              position: 'absolute', left: `${pct(h)}%`, bottom: '5px',
              transform: 'translateX(-50%)',
              display: 'flex', flexDirection: 'column', alignItems: 'center',
            }}>
              <span style={{
                fontSize: '8px', marginBottom: '2px', fontVariantNumeric: 'tabular-nums',
                color: KEY_TICKS.has(h) ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.18)',
                fontWeight: KEY_TICKS.has(h) ? 700 : 400,
              }}>
                {fmt(h)}
              </span>
              <div style={{
                width: '1px', height: KEY_TICKS.has(h) ? '5px' : '3px',
                background: KEY_TICKS.has(h) ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.07)',
              }} />
            </div>
          ))}
        </div>
      </div>

      {/* Nurse rows */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
        {nurses.map(nurse => {
          const wc = WARD[nurse.ward] || WARD.General;
          const shiftKey = getNurseShift(nurse.name, fullDay, schedule);
          const weekly = getWeekly(nurse.name, schedule);
          const isBlocked = (nurse as any).overtime_status === 'BLOCKED';
          const hlDay = highlightCell?.day?.toLowerCase().startsWith(shortDay.toLowerCase());
          const hlShift = hlDay && highlightCell?.shift?.toLowerCase() === shiftKey;
          const isOff = !shiftKey && !!(nurse as any).unavailable_days?.some(
            (d: string) => fullDay.toLowerCase().startsWith(d.toLowerCase().slice(0, 3))
          );

          return (
            <div key={nurse.id} style={{ display: 'grid', gridTemplateColumns: '148px 1fr', gap: '6px', alignItems: 'center' }}>

              {/* Nurse card */}
              <div
                onMouseEnter={e => setTooltip({ nurse, weekly, x: e.clientX, y: e.clientY })}
                onMouseMove={e => setTooltip(t => t ? { ...t, x: e.clientX, y: e.clientY } : null)}
                onMouseLeave={() => setTooltip(null)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '7px',
                  padding: '5px 8px', borderRadius: '7px',
                  background: 'rgba(255,255,255,0.025)',
                  border: hlDay ? '1px solid rgba(255,61,90,0.35)' : '1px solid rgba(255,255,255,0.05)',
                  cursor: 'pointer', transition: 'border-color 0.15s',
                }}
              >
                {/* Avatar */}
                <div style={{
                  width: '26px', height: '26px', borderRadius: '50%', flexShrink: 0,
                  background: wc.bg, border: `1.5px solid ${wc.border}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <span style={{ fontSize: '9px', fontWeight: 700, color: wc.text }}>
                    {nurse.name.split(' ').map(p => p[0]).join('').slice(0, 2)}
                  </span>
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                    <span style={{
                      fontSize: '11px', fontWeight: 600,
                      color: isBlocked ? 'rgba(255,255,255,0.3)' : '#fff',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      textDecoration: isBlocked ? 'line-through' : 'none',
                    }}>
                      {nurse.name.split(' ')[0]}
                    </span>
                    {isBlocked && <AlertCircle size={9} style={{ color: '#FF3D5A', flexShrink: 0 }} />}
                  </div>
                  <div style={{ display: 'flex', gap: '3px', marginTop: '2px' }}>
                    <span style={{ fontSize: '8px', padding: '0 4px', borderRadius: '3px', background: wc.bg, color: wc.text, fontWeight: 700 }}>
                      N{nurse.skillLevel}
                    </span>
                    <span style={{ fontSize: '8px', padding: '0 4px', borderRadius: '3px', background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.38)' }}>
                      {nurse.ward}
                    </span>
                  </div>
                </div>

                {/* Today shift badge */}
                {shiftKey ? (() => {
                  const b = SHIFT_BANDS.find(x => x.key === shiftKey)!;
                  return (
                    <div style={{ padding: '1px 5px', borderRadius: '3px', fontSize: '8px', fontWeight: 700, flexShrink: 0, color: b.text, background: b.color, border: `1px solid ${b.accent}` }}>
                      {b.label[0]}
                    </div>
                  );
                })() : (
                  <div style={{ fontSize: '8px', color: isOff ? '#6B7280' : 'rgba(255,255,255,0.12)', padding: '1px 4px', borderRadius: '3px', background: isOff ? 'rgba(107,114,128,0.1)' : 'transparent', border: isOff ? '1px solid rgba(107,114,128,0.2)' : 'none', flexShrink: 0 }}>
                    {isOff ? 'OFF' : '—'}
                  </div>
                )}
              </div>

              {/* Timeline */}
              <TimelineBar shiftKey={shiftKey} highlighted={hlShift} isOff={isOff} />
            </div>
          );
        })}
      </div>

      {/* Tooltip */}
      {tooltip && (
        <div style={{
          position: 'fixed', left: tooltip.x + 14, top: tooltip.y - 10, zIndex: 9999,
          background: 'rgba(6,12,26,0.97)', border: '1px solid rgba(0,212,255,0.2)',
          borderRadius: '10px', padding: '12px 14px', pointerEvents: 'none',
          backdropFilter: 'blur(20px)', boxShadow: '0 8px 32px rgba(0,0,0,0.7)', minWidth: '175px',
        }}>
          <p style={{ fontSize: '12px', fontWeight: 700, color: '#fff', marginBottom: '6px' }}>
            {tooltip.nurse.name}
          </p>
          <div style={{ display: 'flex', gap: '5px', marginBottom: '8px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '9px', padding: '2px 6px', borderRadius: '3px', background: WARD[tooltip.nurse.ward]?.bg, color: WARD[tooltip.nurse.ward]?.text, fontWeight: 700 }}>
              {tooltip.nurse.ward}
            </span>
            <span style={{ fontSize: '9px', padding: '2px 6px', borderRadius: '3px', background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.45)' }}>
              Fatigue {tooltip.nurse.fatigue}%
            </span>
          </div>
          <p style={{ fontSize: '9px', color: 'rgba(255,255,255,0.28)', marginBottom: '5px', letterSpacing: '0.5px', textTransform: 'uppercase' }}>This week</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {SHIFT_BANDS.map(b => {
              const count = tooltip.weekly[b.key as keyof typeof tooltip.weekly] as number;
              return (
                <div key={b.key} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <div style={{ width: '6px', height: '6px', borderRadius: '1px', background: b.color, border: `1px solid ${b.accent}` }} />
                  <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.38)', width: '62px' }}>{b.label}</span>
                  <div style={{ flex: 1, height: '3px', borderRadius: '2px', background: 'rgba(255,255,255,0.06)' }}>
                    <div style={{ width: `${(count / 7) * 100}%`, height: '100%', borderRadius: '2px', background: b.accent }} />
                  </div>
                  <span style={{ fontSize: '10px', color: b.text, fontWeight: 700, width: '14px', textAlign: 'right' }}>{count}</span>
                </div>
              );
            })}
            <div style={{ marginTop: '5px', paddingTop: '5px', borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)' }}>Total shifts</span>
              <span style={{ fontSize: '11px', fontWeight: 700, color: tooltip.weekly.total > 5 ? '#FFC107' : '#fff' }}>
                {tooltip.weekly.total}
                <span style={{ fontSize: '9px', color: 'rgba(255,255,255,0.25)', fontWeight: 400 }}> / 5</span>
              </span>
            </div>
          </div>
          {(tooltip.nurse as any).overtime_status === 'BLOCKED' && (
            <p style={{ fontSize: '10px', color: '#FF3D5A', marginTop: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <AlertCircle size={10} /> Overtime blocked
            </p>
          )}
        </div>
      )}
    </div>
  );
}