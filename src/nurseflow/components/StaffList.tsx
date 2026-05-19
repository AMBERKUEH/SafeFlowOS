import { Nurse } from '../data/mockData';
import { Check } from 'lucide-react';

interface StaffListProps {
  nurses: Nurse[];
  onNurseClick?: (nurse: Nurse) => void;
}

const SKILL_CONFIG: Record<number, { color: string; bg: string }> = {
  1: { color: '#9CA3AF', bg: 'rgba(156,163,175,0.15)' },
  2: { color: '#FF6B35', bg: 'rgba(255,107,53,0.15)' },
  3: { color: '#00D4FF', bg: 'rgba(0,212,255,0.15)'  },
  4: { color: '#A78BFA', bg: 'rgba(167,139,250,0.15)' },
};

const WARD_CONFIG: Record<string, { color: string; bg: string }> = {
  ICU:        { color: '#00D4FF', bg: 'rgba(0,212,255,0.10)'   },
  ER:         { color: '#FF3D5A', bg: 'rgba(255,61,90,0.10)'   },
  General:    { color: '#00E5A0', bg: 'rgba(0,229,160,0.10)'   },
  Pediatrics: { color: '#FF6B35', bg: 'rgba(255,107,53,0.10)'  },
};

export function StaffList({ nurses, onNurseClick }: StaffListProps) {
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>

      {/* Header */}
      <h3 style={{
        fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: '11px',
        color: '#00D4FF', textTransform: 'uppercase', letterSpacing: '2px',
        margin: '0 0 12px',
      }}>
        Staff On Duty
      </h3>

      {/* List */}
      <div style={{
        flex: 1, overflowY: 'auto', scrollbarWidth: 'none',
        display: 'flex', flexDirection: 'column', gap: '6px',
      }}>
        {nurses.map(nurse => {
          const isBlocked = (nurse as any).overtime_status === 'BLOCKED';
          const isWarning = (nurse as any).overtime_status === 'WARNING';
          const isCritical = nurse.fatigue > 95;
          const weeklyHours = (nurse as any).weekly_hours ?? 0;

          const skillCfg = SKILL_CONFIG[nurse.skillLevel] ?? SKILL_CONFIG[1];
          const wardCfg  = WARD_CONFIG[nurse.ward] ?? { color: '#9CA3AF', bg: 'rgba(156,163,175,0.1)' };

          // Border colour: blocked → red, warning → orange, critical → red pulse, else subtle
          const borderColor = isBlocked
            ? 'rgba(255,61,90,0.5)'
            : isWarning
              ? 'rgba(255,107,53,0.4)'
              : 'rgba(255,255,255,0.06)';

          const cardBg = isBlocked
            ? 'rgba(255,61,90,0.06)'
            : isWarning
              ? 'rgba(255,107,53,0.05)'
              : 'rgba(255,255,255,0.03)';

          // Short name: first + last initial
          const parts = nurse.name.split(' ');
          const shortName = parts.length > 2
            ? `${parts[0]} ${parts[parts.length - 1][0]}.`
            : nurse.name;

          return (
            <div
              key={nurse.id}
              onClick={() => onNurseClick?.(nurse)}
              style={{
                borderRadius: '10px',
                background: cardBg,
                border: `1px solid ${borderColor}`,
                padding: '10px 12px',
                cursor: 'pointer',
                transition: 'border-color 0.2s, background 0.2s',
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLDivElement).style.borderColor = '#00D4FF55';
                (e.currentTarget as HTMLDivElement).style.background = 'rgba(0,212,255,0.04)';
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLDivElement).style.borderColor = borderColor;
                (e.currentTarget as HTMLDivElement).style.background = cardBg;
              }}
            >
              {/* Row 1: name + status indicator */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>

                {/* Fatigue dot */}
                <div style={{
                  width: '8px', height: '8px', borderRadius: '50%', flexShrink: 0,
                  background: isCritical || isBlocked ? '#FF3D5A' : isWarning ? '#FF6B35' : '#00E5A0',
                  boxShadow: `0 0 6px ${isCritical || isBlocked ? '#FF3D5A' : isWarning ? '#FF6B35' : '#00E5A0'}`,
                }} />

                {/* Name */}
                <span style={{
                  fontSize: '12px', fontWeight: 600, flex: 1,
                  color: isBlocked ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.85)',
                  textDecoration: isBlocked ? 'line-through' : 'none',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {shortName}
                </span>

                {/* Status badge — right-aligned, compact */}
                {isBlocked && (
                  <span style={{
                    fontSize: '9px', fontWeight: 700, letterSpacing: '0.3px',
                    color: '#FF3D5A', padding: '2px 6px', borderRadius: '4px',
                    background: 'rgba(255,61,90,0.15)', border: '1px solid rgba(255,61,90,0.4)',
                    whiteSpace: 'nowrap', flexShrink: 0,
                  }}>
                    ⛔ Max hrs
                  </span>
                )}
                {isWarning && !isBlocked && (
                  <span style={{
                    fontSize: '9px', fontWeight: 700,
                    color: '#FF6B35', padding: '2px 6px', borderRadius: '4px',
                    background: 'rgba(255,107,53,0.15)', border: '1px solid rgba(255,107,53,0.4)',
                    whiteSpace: 'nowrap', flexShrink: 0,
                  }}>
                    ⚠ {weeklyHours}h/40
                  </span>
                )}
              </div>

              {/* Row 2: skill + ward + requests honoured */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexWrap: 'wrap' }}>

                {/* Skill */}
                <span style={{
                  fontSize: '10px', fontWeight: 700,
                  color: skillCfg.color, background: skillCfg.bg,
                  padding: '2px 7px', borderRadius: '5px',
                }}>
                  N{nurse.skillLevel}
                </span>

                {/* Ward */}
                <span style={{
                  fontSize: '10px', fontWeight: 500,
                  color: wardCfg.color, background: wardCfg.bg,
                  padding: '2px 7px', borderRadius: '5px',
                }}>
                  {nurse.ward}
                </span>

                {/* Spacer */}
                <div style={{ flex: 1 }} />

                {/* Requests honoured tick */}
                {nurse.unavailable_days && nurse.unavailable_days.length > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                    {nurse.requests_honored ? (
                      <>
                        <Check size={10} color="#00E5A0" />
                        <span style={{ fontSize: '9px', color: 'rgba(0,229,160,0.7)' }}>Days off honoured</span>
                      </>
                    ) : (
                      <span style={{ fontSize: '9px', color: 'rgba(255,255,255,0.2)' }}>
                        {nurse.unavailable_days.slice(0, 2).join(', ')}
                        {nurse.unavailable_days.length > 2 ? ` +${nurse.unavailable_days.length - 2}` : ''} off
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer hint */}
      <p style={{
        marginTop: '8px', flexShrink: 0,
        fontSize: '10px', color: 'rgba(255,255,255,0.18)',
        fontStyle: 'italic', textAlign: 'center',
      }}>
        Tap a card for full details
      </p>
    </div>
  );
}