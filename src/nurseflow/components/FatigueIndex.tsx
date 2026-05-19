import { Nurse } from '../data/mockData';

interface FatigueIndexProps {
  nurses: Nurse[];
  schedule?: any;
}

const FULL_DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

function getNurseWeeklyBreakdown(nurseName: string, schedule: any) {
  if (!schedule) return { morning: 0, afternoon: 0, night: 0, total: 0, hours: 0 };
  let morning = 0, afternoon = 0, night = 0;
  FULL_DAY_NAMES.forEach(day => {
    if (schedule[day]?.morning?.includes(nurseName)) morning++;
    if (schedule[day]?.afternoon?.includes(nurseName)) afternoon++;
    if (schedule[day]?.night?.includes(nurseName)) night++;
  });
  const total = morning + afternoon + night;
  return { morning, afternoon, night, total, hours: total * 8 };
}

type FatigueLevel = 'critical' | 'high' | 'medium' | 'ok';

function getFatigueLevel(fatigue: number): FatigueLevel {
  if (fatigue >= 80) return 'critical';
  if (fatigue >= 60) return 'high';
  if (fatigue >= 40) return 'medium';
  return 'ok';
}

const LEVEL_CONFIG: Record<FatigueLevel, { color: string; bg: string; border: string; label: string }> = {
  critical: { color: '#FF3D5A', bg: 'rgba(255,61,90,0.10)',  border: 'rgba(255,61,90,0.30)',  label: 'Critical' },
  high:     { color: '#FF6B35', bg: 'rgba(255,107,53,0.10)', border: 'rgba(255,107,53,0.30)', label: 'High'     },
  medium:   { color: '#FFC107', bg: 'rgba(255,193,7,0.10)',  border: 'rgba(255,193,7,0.30)',  label: 'Medium'   },
  ok:       { color: '#00E5A0', bg: 'rgba(0,229,160,0.08)',  border: 'rgba(0,229,160,0.25)',  label: 'Normal'   },
};

function ShiftChip({ count, label, color }: { count: number; label: string; color: string }) {
  if (count === 0) return null;
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '3px',
      padding: '2px 6px', borderRadius: '5px',
      background: `${color}18`, border: `1px solid ${color}35`,
    }}>
      <span style={{ fontSize: '9px', fontWeight: 700, color: `${color}BB` }}>{label}</span>
      <span style={{ fontSize: '10px', fontWeight: 700, color }}>×{count}</span>
    </div>
  );
}

export function FatigueIndex({ nurses, schedule }: FatigueIndexProps) {
  const sorted = [...nurses].sort((a, b) => (b.fatigue ?? 50) - (a.fatigue ?? 50));

  const criticalCount = sorted.filter(n => (n.fatigue ?? 50) >= 80).length;
  const highCount     = sorted.filter(n => { const f = n.fatigue ?? 50; return f >= 60 && f < 80; }).length;

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>

      {/* ── Header ── */}
      <div style={{ marginBottom: '10px', flexShrink: 0 }}>
        <h3 style={{
          fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: '11px',
          color: '#00D4FF', textTransform: 'uppercase', letterSpacing: '2px', margin: 0,
        }}>
          Fatigue Index
        </h3>

        {(criticalCount > 0 || highCount > 0) && (
          <div style={{ display: 'flex', gap: '6px', marginTop: '8px', flexWrap: 'wrap' }}>
            {criticalCount > 0 && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: '5px',
                padding: '3px 9px', borderRadius: '20px',
                background: 'rgba(255,61,90,0.12)', border: '1px solid rgba(255,61,90,0.35)',
              }}>
                <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#FF3D5A', boxShadow: '0 0 5px #FF3D5A' }} />
                <span style={{ fontSize: '10px', color: '#FF3D5A', fontWeight: 700 }}>{criticalCount} Critical</span>
              </div>
            )}
            {highCount > 0 && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: '5px',
                padding: '3px 9px', borderRadius: '20px',
                background: 'rgba(255,107,53,0.12)', border: '1px solid rgba(255,107,53,0.35)',
              }}>
                <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#FF6B35', boxShadow: '0 0 5px #FF6B35' }} />
                <span style={{ fontSize: '10px', color: '#FF6B35', fontWeight: 700 }}>{highCount} High</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Nurse cards ── */}
      <div style={{
        flex: 1, overflowY: 'auto',
        display: 'flex', flexDirection: 'column', gap: '6px',
        scrollbarWidth: 'none', paddingRight: '2px',
      }}>
        {sorted.map(nurse => {
          const fatigue = nurse.fatigue ?? 50;
          const level = getFatigueLevel(fatigue);
          const cfg = LEVEL_CONFIG[level];
          const breakdown = getNurseWeeklyBreakdown(nurse.name, schedule);
          const isBlocked = (nurse as any).overtime_status === 'BLOCKED';
          const isWarning = (nurse as any).overtime_status === 'WARNING';

          const nameParts = nurse.name.split(' ');
          const displayName = nameParts.length > 1
            ? `${nameParts[0]} ${nameParts[nameParts.length - 1][0]}.`
            : nameParts[0];

          return (
            <div key={nurse.id} style={{
              borderRadius: '10px',
              background: cfg.bg,
              border: `1px solid ${cfg.border}`,
              padding: '10px 12px',
              opacity: isBlocked ? 0.55 : 1,
              transition: 'opacity 0.2s',
            }}>

              {/* Row 1: dot + name + badge + % */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '7px' }}>
                <div style={{
                  width: '8px', height: '8px', borderRadius: '50%',
                  background: cfg.color, flexShrink: 0,
                  boxShadow: `0 0 7px ${cfg.color}99`,
                }} />

                <span style={{
                  fontSize: '12px', fontWeight: 600, flex: 1,
                  color: isBlocked ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.85)',
                  textDecoration: isBlocked ? 'line-through' : 'none',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {displayName}
                </span>

                {isBlocked && (
                  <span style={{
                    fontSize: '9px', fontWeight: 700, color: '#FF3D5A',
                    padding: '2px 5px', borderRadius: '4px',
                    background: 'rgba(255,61,90,0.15)', border: '1px solid rgba(255,61,90,0.4)',
                  }}>OT</span>
                )}
                {isWarning && !isBlocked && (
                  <span style={{
                    fontSize: '9px', color: '#FFC107',
                    padding: '2px 5px', borderRadius: '4px',
                    background: 'rgba(255,193,7,0.15)', border: '1px solid rgba(255,193,7,0.4)',
                  }}>⚠</span>
                )}

                <span style={{ fontSize: '14px', fontWeight: 700, color: cfg.color, minWidth: '38px', textAlign: 'right' }}>
                  {fatigue}%
                </span>
              </div>

              {/* Row 2: fatigue bar */}
              <div style={{
                height: '5px', borderRadius: '3px',
                background: 'rgba(255,255,255,0.06)',
                overflow: 'hidden', marginBottom: '8px',
              }}>
                <div style={{
                  height: '100%', width: `${fatigue}%`, borderRadius: '3px',
                  background: `linear-gradient(90deg, ${cfg.color}88, ${cfg.color})`,
                  boxShadow: `0 0 8px ${cfg.color}55`,
                  transition: 'width 0.5s ease',
                }} />
              </div>

              {/* Row 3: shift chips + total */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <ShiftChip count={breakdown.morning}   label="M" color="#00D4FF" />
                <ShiftChip count={breakdown.afternoon} label="A" color="#8B5CF6" />
                <ShiftChip count={breakdown.night}     label="N" color="#FF6B35" />
                <div style={{ flex: 1 }} />
                <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)' }}>
                  <span style={{ color: 'rgba(255,255,255,0.6)', fontWeight: 700 }}>{breakdown.total}</span>
                  <span>/5 · {breakdown.hours}h</span>
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Legend ── */}
      <div style={{
        marginTop: '10px', flexShrink: 0,
        padding: '8px 10px', borderRadius: '8px',
        background: 'rgba(255,255,255,0.025)',
        border: '1px solid rgba(255,255,255,0.06)',
      }}>
        <p style={{ fontSize: '8px', color: 'rgba(255,255,255,0.2)', letterSpacing: '1px', textTransform: 'uppercase', margin: '0 0 6px' }}>
          Fatigue Levels
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 12px' }}>
          {(Object.entries(LEVEL_CONFIG) as [FatigueLevel, typeof LEVEL_CONFIG[FatigueLevel]][]).map(([key, cfg]) => (
            <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: cfg.color, flexShrink: 0 }} />
              <span style={{ fontSize: '9px', color: 'rgba(255,255,255,0.35)' }}>
                {cfg.label}
                <span style={{ color: 'rgba(255,255,255,0.18)', marginLeft: '3px' }}>
                  {key === 'critical' ? '≥80%' : key === 'high' ? '≥60%' : key === 'medium' ? '≥40%' : '<40%'}
                </span>
              </span>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}