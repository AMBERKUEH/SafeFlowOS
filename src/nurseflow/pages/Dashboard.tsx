import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { Navbar } from '../components/Navbar';
import { StaffPanel } from '../components/StaffPanel';
import { WeeklySchedule } from '../components/WeeklySchedule';
import { ComplianceBar } from '../components/ComplianceBar';
import { NurseModal } from '../components/NurseModal';
import { AgentActivity } from '../components/AgentActivity';
import { LiquidGradientBg } from '../components/LiquidGradientBg';
import { Loader2 } from 'lucide-react';
import { AgentMessage } from '../data/mockData';

interface Nurse {
  name: string;
  skill: string;
  ward: string;
  unavailable_days: string[];
  fatigue_score: number;
}

interface ScheduleData {
  schedule: any;
  compliance: {
    passed: boolean;
    violations: any[];
    compliance_score: number;
  };
  forecast: any;
  retry_count: number;
  bright_data: any;
  memory_insights: string[];
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [selectedNurse, setSelectedNurse] = useState<Nurse | null>(null);
  const [nurses, setNurses] = useState<Nurse[]>([]);
  const [schedule, setSchedule] = useState<any>(null);
  const [scheduleData, setScheduleData] = useState<ScheduleData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activityLog, setActivityLog] = useState<AgentMessage[]>([]);
  const [complianceFlash, setComplianceFlash] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());

  // Live clock update every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const loadData = () => {
      try {
        const nursesData = localStorage.getItem('nurses');
        const scheduleResultStr = localStorage.getItem('scheduleResult');

        if (nursesData) {
          setNurses(JSON.parse(nursesData));
        } else {
          setError('No nurse data found. Please upload a PDF first.');
        }

        if (scheduleResultStr) {
          const result = JSON.parse(scheduleResultStr);
          setScheduleData({
            schedule: result.schedule,
            compliance: {
              passed: result.compliance?.status === 'PASSED',
              violations: result.compliance?.reasons || [],
              compliance_score: result.compliance?.score || 100,
            },
            forecast: result.staffing_requirements,
            retry_count: 0,
            bright_data: null,
            memory_insights: result.alerts || [],
          });

          const newActivityLog: AgentMessage[] = [];
          const currentTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

          if (result.schedule && nursesData) {
            const parsedNurses = JSON.parse(nursesData);
            const weeklyHours = result.compliance?.weekly_hours || {};
            const overtimeRisk = result.compliance?.overtime_risk || [];

            const updatedNurses = parsedNurses.map((nurse: any) => {
              const name = nurse.name;
              let totalShifts = 0;
              let nightShifts = 0;

              Object.entries(result.schedule).forEach(([day, shifts]: [string, any]) => {
                ['morning', 'afternoon', 'night'].forEach(shiftType => {
                  if (shifts[shiftType] && shifts[shiftType].includes(name)) {
                    totalShifts++;
                    if (shiftType === 'night') nightShifts++;
                  }
                });
              });

              const fatigueScore = Math.min(100, (totalShifts * 12) + (nightShifts * 8));
              const hours = weeklyHours[name] || 0;
              let overtimeStatus = 'OK';
              if (hours > 40) overtimeStatus = 'BLOCKED';
              else if (hours > 36) overtimeStatus = 'WARNING';

              let requestsHonored = true;
              if (nurse.unavailable_days && nurse.unavailable_days.length > 0) {
                requestsHonored = nurse.unavailable_days.every((dayOff: string) => {
                  const fullDay = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].find(
                    d => d.toLowerCase().startsWith(dayOff.toLowerCase())
                  );
                  if (!fullDay || !result.schedule[fullDay]) return true;
                  const daySchedule = result.schedule[fullDay];
                  return !['morning', 'afternoon', 'night'].some(
                    shift => daySchedule[shift] && daySchedule[shift].includes(name)
                  );
                });
              }

              return { ...nurse, fatigue_score: fatigueScore, total_shifts: totalShifts, night_shifts: nightShifts, weekly_hours: hours, overtime_status: overtimeStatus, requests_honored: requestsHonored };
            });

            setNurses(updatedNurses);
            localStorage.setItem('nurses', JSON.stringify(updatedNurses));

            const totalRequests = updatedNurses.reduce((sum: number, n: any) => sum + (n.unavailable_days?.length || 0), 0);
            if (totalRequests > 0) {
              newActivityLog.push({ id: Date.now().toString(), type: 'SCHEDULING', message: `Honored ${totalRequests} pre-approved nurse requests`, timestamp: currentTime });
            }

            const blockedNurses = updatedNurses.filter((n: any) => n.overtime_status === 'BLOCKED');
            blockedNurses.forEach((nurse: any) => {
              newActivityLog.push({ id: Date.now().toString(), type: 'COMPLIANCE', message: `${nurse.name} blocked from further shifts — 40hr limit reached`, timestamp: currentTime });
            });

            if (overtimeRisk.length > 0) {
              newActivityLog.push({ id: Date.now().toString(), type: 'COMPLIANCE', message: `Overtime alert: ${overtimeRisk.join(', ')} approaching 40hr weekly limit`, timestamp: currentTime });
            }
          }

          if (result.staffing_requirements) {
            const staffingStr = Object.entries(result.staffing_requirements).map(([day, count]) => `${day.slice(0, 3)} ${count}`).join(', ');
            newActivityLog.push({ id: Date.now().toString(), type: 'FORECAST', message: `Forecasted staffing: ${staffingStr}`, timestamp: currentTime });
          }

          if (result.compliance) {
            const score = result.compliance.score || 100;
            const violationCount = result.compliance.reasons?.length || 0;
            newActivityLog.push({
              id: Date.now().toString(),
              type: 'COMPLIANCE',
              message: result.compliance.status === 'PASSED'
                ? `PASSED — ${score}% rules met`
                : `FAILED — ${violationCount} violations found`,
              timestamp: currentTime,
            });
          }

          if (result.alerts) result.alerts.forEach((alert: string, idx: number) => newActivityLog.push({ id: `${Date.now()}-${idx}`, type: 'SCHEDULING', message: alert, timestamp: currentTime }));
          if (result.agent_activity) result.agent_activity.forEach((a: any, idx: number) => newActivityLog.push({ id: `${Date.now()}-${idx + 100}`, type: a.agent?.toUpperCase() as any || 'SCHEDULING', message: a.message, timestamp: currentTime }));

          setSchedule(result.schedule);
          setActivityLog(newActivityLog);
        }
      } catch (err) {
        setError('Failed to load data');
      } finally {
        setIsLoading(false);
      }
    };
    loadData();
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#050d1a' }}>
        <LiquidGradientBg />
        <Loader2 size={48} className="animate-spin" style={{ color: '#00D4FF', position: 'relative', zIndex: 2 }} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center" style={{ backgroundColor: '#050d1a' }}>
        <LiquidGradientBg />
        <div style={{ position: 'relative', zIndex: 2, textAlign: 'center' }}>
          <p style={{ color: '#FF3D5A', marginBottom: '16px' }}>{error}</p>
          <button onClick={() => navigate('/')} style={{ backgroundColor: '#1a6fd4', color: '#fff', padding: '12px 24px', borderRadius: '8px', border: 'none', cursor: 'pointer' }}>
            Go to Upload
          </button>
        </div>
      </div>
    );
  }

  const isCompliant = scheduleData?.compliance?.passed ?? true;
  const complianceMessage = isCompliant
    ? `✓ SCHEDULE COMPLIANT — ${scheduleData?.compliance?.compliance_score ?? 100}% RULES PASSED`
    : `✗ VIOLATIONS DETECTED — ${scheduleData?.compliance?.violations?.length ?? 0} ISSUES FOUND`;

  // Handle schedule update from emergency
  const handleScheduleUpdate = (newSchedule: any) => {
    setSchedule(newSchedule);
    const scheduleResultStr = localStorage.getItem('scheduleResult');
    if (scheduleResultStr) {
      const result = JSON.parse(scheduleResultStr);
      result.schedule = newSchedule;
      localStorage.setItem('scheduleResult', JSON.stringify(result));
    }
  };

  // Handle high severity emergency
  const handleHighSeverity = (severity: string) => {
    if (severity === 'HIGH') {
      setComplianceFlash(true);
      setTimeout(() => setComplianceFlash(false), 3000);
    }
  };

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#050d1a', position: 'relative' }}>
      <LiquidGradientBg />

      {/* All content sits above the gradient */}
      <div style={{ position: 'relative', zIndex: 2 }}>
        <Navbar onFileRemove={() => navigate('/')} />

        <div className="px-6 pt-4 flex justify-between items-start">
          {/* Live Date/Time */}
          <div style={{
            textAlign: 'right',
            fontFamily: 'Syne, sans-serif',
          }}>
            <div style={{
              fontSize: '12px',
              color: 'rgba(255,255,255,0.5)',
              letterSpacing: '0.5px',
            }}>
              {currentTime.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })} ({currentTime.toLocaleDateString('en-US', { weekday: 'long' })})
            </div>
            <div style={{
              fontSize: '22px',
              fontWeight: 700,
              color: '#00D4FF',
              fontVariantNumeric: 'tabular-nums',
              letterSpacing: '1px',
            }}>
              {currentTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}
            </div>
          </div>
        </div>

        <div className="p-6">
          <div className="grid grid-cols-12 gap-6 mb-6">
            {/* WeeklySchedule - on the left (col-span-9) */}
            <div className="col-span-9">
              <WeeklySchedule
                nurses={nurses.map((n, idx) => ({
                  id: String(idx), name: n.name,
                  skillLevel: Math.min(Math.max(parseInt(n.skill?.replace('N', '') || '1'), 1), 4) as 1 | 2 | 3 | 4,
                  ward: (n.ward as any) || 'General', fatigue: n.fatigue_score || 50, shifts: [],
                }))}
                schedule={schedule}
                staffingRequirements={scheduleData?.forecast}
              />
            </div>
            {/* StaffPanel - combines StaffList and FatigueIndex on the right */}
            <div className="col-span-3">
              <StaffPanel
                nurses={nurses.map((n, idx) => ({
                  id: String(idx),
                  name: n.name,
                  skillLevel: Math.min(Math.max(parseInt(n.skill?.replace('N', '') || '1'), 1), 4) as 1 | 2 | 3 | 4,
                  ward: (n.ward as any) || 'General',
                  fatigue: n.fatigue_score || 50,
                  shifts: [],
                  unavailable_days: n.unavailable_days || [],
                }))}
                schedule={schedule}
                onNurseClick={(nurse) => setSelectedNurse(nurses.find(n => n.name === nurse.name) || null)}
              />
            </div>
          </div>

          {/* Agent Activity Panel - Below Weekly Schedule */}
          <div style={{ marginBottom: '24px' }}>
            <AgentActivity
              messages={activityLog}
              schedule={schedule}
              onScheduleUpdate={handleScheduleUpdate}
              onEmergency={handleHighSeverity}
            />
          </div>

          <div style={{
            animation: complianceFlash ? 'flashRed 0.5s ease-in-out 6' : 'none'
          }}>
            <ComplianceBar
              isCompliant={isCompliant && !complianceFlash}
              message={isCompliant && !complianceFlash
                ? `✓ SCHEDULE COMPLIANT — ${scheduleData?.compliance?.compliance_score ?? 100}% RULES PASSED`
                : `✗ VIOLATIONS DETECTED — CHECK ACTIVITY LOG`}
            />
          </div>

          <style>{`
            @keyframes flashRed {
              0%, 100% { border-color: transparent; }
              50% { border: 2px solid #FF3D5A; }
            }
          `}</style>
        </div>
      </div>

      {selectedNurse && (
        <NurseModal
          nurse={{
            id: selectedNurse.name, name: selectedNurse.name,
            skillLevel: Math.min(Math.max(parseInt(selectedNurse.skill?.replace('N', '') || '1'), 1), 4) as 1 | 2 | 3 | 4,
            ward: (selectedNurse.ward as any) || 'General', shifts: [], fatigue: selectedNurse.fatigue_score || 50,
          }}
          onClose={() => setSelectedNurse(null)}
        />
      )}
    </div>
  );
}