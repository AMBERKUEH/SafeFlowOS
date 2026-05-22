import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { motion } from 'motion/react';
import { StaffPanel } from '../components/StaffPanel';
import { WeeklySchedule } from '../components/WeeklySchedule';
import { ComplianceBar } from '../components/ComplianceBar';
import { NurseModal } from '../components/NurseModal';
import { AgentActivity } from '../components/AgentActivity';
import { PendingApproval, PendingApprovals } from '../components/PendingApprovals';
import { updateApprovalStatus } from '../services/api';
import { Activity, AlertTriangle, Bot, Calendar, CheckSquare, Clock, Loader2, Users } from 'lucide-react';
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
    warnings: any[];
    compliance_score: number;
  };
  forecast: any;
  retry_count: number;
  bright_data: any;
  memory_insights: string[];
}

const actionableComplianceReason = (reason: string) => {
  const text = reason.toLowerCase();
  const obsoleteRuleText = [
    'consecutive ev',
    'mandatory sd',
    'minimum 55%',
    'senior nurses',
    'minimum senior',
    'exactly 3',
    'exactly 4',
    'malaysian labour',
    'exceeds 40hr limit',
  ];
  return !obsoleteRuleText.some((pattern) => text.includes(pattern));
};

const MetricCard = ({
  icon: Icon,
  label,
  value,
  trend,
  tone = 'default',
  index,
}: {
  icon: any;
  label: string;
  value: string;
  trend?: string;
  tone?: 'default' | 'error';
  index: number;
}) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay: index * 0.08 }}
    className="bg-surface-container-lowest rounded-xl p-6 border border-outline-variant hover:shadow-sm transition-all group relative overflow-hidden"
  >
    <div className={`absolute top-0 right-0 w-32 h-32 rounded-full blur-2xl -mr-16 -mt-16 ${tone === 'error' ? 'bg-error/5' : 'bg-secondary/5'}`} />

    <div className="flex justify-between items-start mb-10 relative z-10">
      <div className="w-10 h-10 rounded-lg bg-surface-container-low flex items-center justify-center text-on-surface-variant group-hover:text-secondary transition-colors">
        <Icon size={22} />
      </div>
      {trend && (
        <span className={`text-[12px] font-semibold flex items-center gap-1.5 px-2.5 py-1 rounded-full border ${
          tone === 'error'
            ? 'bg-error-container text-error border-error/10'
            : 'bg-surface-container-lowest text-on-surface-variant border-outline-variant'
        }`}>
          {tone === 'error' && <span className="w-1.5 h-1.5 rounded-full bg-error animate-pulse" />}
          {trend}
        </span>
      )}
    </div>

    <div className="relative z-10">
      <p className="text-4xl font-semibold text-on-surface mb-1">{value}</p>
      <p className="text-sm text-on-surface-variant">{label}</p>
    </div>
  </motion.div>
);

const StatusCard = ({ activityCount, nurseCount }: { activityCount: number; nurseCount: number }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay: 0.24 }}
    className="bg-surface-container-lowest rounded-xl p-6 border border-outline-variant hover:shadow-sm transition-all flex flex-col justify-between relative overflow-hidden"
  >
    <div className="absolute inset-0 bg-gradient-to-br from-secondary/5 to-transparent z-0" />
    <div className="relative z-10 flex items-center gap-2 mb-auto">
      <Bot size={20} className="text-secondary fill-secondary/20" />
      <span className="text-sm text-on-surface font-medium">Agent Status</span>
    </div>
    <div className="relative z-10 mt-8">
      <div className="flex items-center gap-2 mb-1">
        <div className="w-2 h-2 rounded-full bg-secondary animate-pulse" />
        <p className="text-sm text-on-surface font-medium">Monitoring {nurseCount} nurses</p>
      </div>
      <p className="text-[12px] text-on-surface-variant">{activityCount} scheduling events logged</p>
    </div>
  </motion.div>
);

export default function Dashboard() {
  const navigate = useNavigate();
  const [selectedNurse, setSelectedNurse] = useState<Nurse | null>(null);
  const [nurses, setNurses] = useState<Nurse[]>([]);
  const [schedule, setSchedule] = useState<any>(null);
  const [scheduleData, setScheduleData] = useState<ScheduleData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activityLog, setActivityLog] = useState<AgentMessage[]>([]);
  const [pendingApprovals, setPendingApprovals] = useState<PendingApproval[]>([]);
  const [complianceFlash, setComplianceFlash] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());

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
          const complianceReasons = (result.compliance?.reasons || []).filter(actionableComplianceReason);
          const complianceWarnings = result.compliance?.warnings || [];
          setScheduleData({
            schedule: result.schedule,
            compliance: {
              passed: result.compliance?.status === 'PASSED' || complianceReasons.length === 0,
              violations: complianceReasons,
              warnings: complianceWarnings,
              compliance_score: complianceReasons.length === 0 ? 100 : result.compliance?.score || 100,
            },
            forecast: result.staffing_requirements,
            retry_count: 0,
            bright_data: null,
            memory_insights: result.alerts || [],
          });

          const newActivityLog: AgentMessage[] = [];
          const logTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          let logSequence = 0;
          const makeLogId = () => `${Date.now()}-${logSequence++}`;

          if (result.schedule && nursesData) {
            const parsedNurses = JSON.parse(nursesData);
            const weeklyHours = result.compliance?.weekly_hours || {};
            const overtimeRisk = result.compliance?.overtime_risk || [];

            const updatedNurses = parsedNurses.map((nurse: any) => {
              const name = nurse.name;
              let totalShifts = 0;
              let nightShifts = 0;

              Object.entries(result.schedule).forEach(([_, shifts]: [string, any]) => {
                ['morning', 'afternoon', 'night'].forEach((shiftType) => {
                  if (shifts[shiftType] && shifts[shiftType].includes(name)) {
                    totalShifts++;
                    if (shiftType === 'night') nightShifts++;
                  }
                });
              });

              const fatigueScore = Math.min(100, totalShifts * 12 + nightShifts * 8);
              const hours = weeklyHours[name] || 0;
              let overtimeStatus = 'OK';
              if (hours > 40) overtimeStatus = 'BLOCKED';
              else if (hours > 36) overtimeStatus = 'WARNING';

              let requestsHonored = true;
              if (nurse.unavailable_days && nurse.unavailable_days.length > 0) {
                requestsHonored = nurse.unavailable_days.every((dayOff: string) => {
                  const fullDay = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].find((d) =>
                    d.toLowerCase().startsWith(dayOff.toLowerCase()),
                  );
                  if (!fullDay || !result.schedule[fullDay]) return true;
                  const daySchedule = result.schedule[fullDay];
                  return !['morning', 'afternoon', 'night'].some(
                    (shift) => daySchedule[shift] && daySchedule[shift].includes(name),
                  );
                });
              }

              return {
                ...nurse,
                fatigue_score: fatigueScore,
                total_shifts: totalShifts,
                night_shifts: nightShifts,
                weekly_hours: hours,
                overtime_status: overtimeStatus,
                requests_honored: requestsHonored,
              };
            });

            setNurses(updatedNurses);
            localStorage.setItem('nurses', JSON.stringify(updatedNurses));

            const totalRequests = updatedNurses.reduce((sum: number, n: any) => sum + (n.unavailable_days?.length || 0), 0);
            if (totalRequests > 0) {
              newActivityLog.push({ id: makeLogId(), type: 'SCHEDULING', message: `Honored ${totalRequests} pre-approved nurse requests`, timestamp: logTime });
            }

            const blockedNurses = updatedNurses.filter((n: any) => n.overtime_status === 'BLOCKED');
            blockedNurses.forEach((nurse: any) => {
              newActivityLog.push({ id: makeLogId(), type: 'COMPLIANCE', message: `${nurse.name} blocked from further shifts - 40hr limit reached`, timestamp: logTime });
            });

            if (overtimeRisk.length > 0) {
              newActivityLog.push({ id: makeLogId(), type: 'COMPLIANCE', message: `Overtime alert: ${overtimeRisk.join(', ')} approaching 40hr weekly limit`, timestamp: logTime });
            }
          }

          if (result.staffing_requirements) {
            const staffingStr = Object.entries(result.staffing_requirements)
              .map(([day, count]) => `${day.slice(0, 3)} ${count}`)
              .join(', ');
            newActivityLog.push({ id: makeLogId(), type: 'FORECAST', message: `Forecasted staffing: ${staffingStr}`, timestamp: logTime });
          }

          if (result.compliance) {
            const score = result.compliance.score || 100;
            const violationCount = (result.compliance.reasons || []).filter(actionableComplianceReason).length;
            const warningCount = result.compliance.warnings?.length || 0;
            newActivityLog.push({
              id: makeLogId(),
              type: 'COMPLIANCE',
              message:
                violationCount === 0
                  ? warningCount > 0
                    ? `PASSED - ${score}% rules met, ${warningCount} warnings`
                    : `PASSED - ${score}% rules met`
                  : `NEEDS ATTENTION - ${violationCount} issues found`,
              timestamp: logTime,
            });
          }

          if (result.alerts) {
            result.alerts.forEach((alert: string, idx: number) =>
              newActivityLog.push({ id: makeLogId(), type: 'SCHEDULING', message: alert, timestamp: logTime }),
            );
          }

          if (result.agent_activity) {
            result.agent_activity.forEach((a: any, idx: number) =>
              newActivityLog.push({ id: makeLogId(), type: (a.agent?.toUpperCase() as any) || 'SCHEDULING', message: a.message, timestamp: logTime }),
            );
          }

          setSchedule(result.schedule);
          setActivityLog(newActivityLog);
        }

        const approvalsData = localStorage.getItem('pendingApprovals');
        if (approvalsData) {
          setPendingApprovals(JSON.parse(approvalsData));
        }
      } catch {
        setError('Failed to load data');
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-full flex items-center justify-center bg-surface">
        <Loader2 size={48} className="animate-spin text-secondary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-full flex flex-col items-center justify-center bg-surface">
        <div className="text-center">
          <p className="text-error mb-4">{error}</p>
          <button onClick={() => navigate('/nurseflow/upload')} className="bg-primary text-on-primary px-6 py-3 rounded-lg">
            Go to Upload
          </button>
        </div>
      </div>
    );
  }

  const complianceViolations = scheduleData?.compliance?.violations ?? [];
  const complianceWarnings = scheduleData?.compliance?.warnings ?? [];
  const violationCount = complianceViolations.length;
  const warningCount = complianceWarnings.length;
  const isCompliant = (scheduleData?.compliance?.passed ?? true) && violationCount === 0;
  const complianceScore = scheduleData?.compliance?.compliance_score ?? 100;
  const totalShifts = nurses.reduce((sum, nurse: any) => sum + (nurse.total_shifts || 0), 0);
  const fatigueAlerts = nurses.filter((nurse: any) => (nurse.fatigue_score || nurse.fatigue || 0) >= 80).length;

  const applyScheduleToNurses = (baseNurses: any[], newSchedule: any, weeklyHours: Record<string, number> = {}) => {
    return baseNurses.map((nurse: any) => {
      const name = nurse.name;
      let totalShifts = 0;
      let nightShifts = 0;

      Object.entries(newSchedule || {}).forEach(([_, shifts]: [string, any]) => {
        ['morning', 'afternoon', 'night'].forEach((shiftType) => {
          if (shifts[shiftType]?.includes(name)) {
            totalShifts++;
            if (shiftType === 'night') nightShifts++;
          }
        });
      });

      const hours = weeklyHours[name] ?? totalShifts * 8;
      return {
        ...nurse,
        fatigue_score: Math.min(100, totalShifts * 12 + nightShifts * 8),
        total_shifts: totalShifts,
        night_shifts: nightShifts,
        weekly_hours: hours,
        overtime_status: hours > 40 ? 'BLOCKED' : hours > 36 ? 'WARNING' : 'OK',
      };
    });
  };

  const handleScheduleUpdate = (newSchedule: any, metadata?: any) => {
    setSchedule(newSchedule);
    const scheduleResultStr = localStorage.getItem('scheduleResult');
    if (scheduleResultStr) {
      const result = JSON.parse(scheduleResultStr);
      result.schedule = newSchedule;
      if (metadata?.compliance) {
        result.compliance = metadata.compliance;
        const complianceReasons = (metadata.compliance.reasons || []).filter(actionableComplianceReason);
        setScheduleData((prev) => prev ? {
          ...prev,
          schedule: newSchedule,
          compliance: {
            passed: metadata.compliance.status === 'PASSED' || complianceReasons.length === 0,
            violations: complianceReasons,
            warnings: metadata.compliance.warnings || [],
            compliance_score: complianceReasons.length === 0 ? 100 : metadata.compliance.score || 0,
          },
        } : prev);
      }
      if (metadata?.alerts) {
        result.alerts = [...(result.alerts || []), ...metadata.alerts];
      }
      if (metadata?.emergency_event) {
        result.emergency_events = [...(result.emergency_events || []), metadata.emergency_event];
      }
      localStorage.setItem('scheduleResult', JSON.stringify(result));

      const updatedNurses = applyScheduleToNurses(nurses, newSchedule, metadata?.compliance?.weekly_hours || {});
      setNurses(updatedNurses);
      localStorage.setItem('nurses', JSON.stringify(updatedNurses));
    }
  };

  const handleHighSeverity = (severity: string) => {
    if (severity === 'HIGH') {
      setComplianceFlash(true);
      setTimeout(() => setComplianceFlash(false), 3000);
    }
  };

  const handleApprovalCreate = (approval: PendingApproval) => {
    setPendingApprovals((prev) => {
      const next = [approval, ...prev.filter((item) => item.id !== approval.id)];
      localStorage.setItem('pendingApprovals', JSON.stringify(next));
      return next;
    });
  };

  const handleApprovalStatusChange = async (id: string, status: 'approved' | 'declined') => {
    const approval = pendingApprovals.find((item) => item.id === id);
    if (!approval) return;

    const result = await updateApprovalStatus({
      approvalType: approval.type,
      approvalId: approval.id,
      status,
    });
    if (!result) return;

    setPendingApprovals((prev) => {
      const next = prev.map((approval) => (approval.id === id ? { ...approval, status } : approval));
      localStorage.setItem('pendingApprovals', JSON.stringify(next));
      return next;
    });
  };

  return (
    <div className="min-h-full bg-surface">
      <div className="p-6 md:p-8 lg:p-container-margin pb-24">
        <div className="max-w-6xl mx-auto">
          <motion.section
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-12 flex flex-col sm:flex-row sm:items-end justify-between gap-6"
          >
            <div>
              <p className="text-[11px] font-bold text-on-surface-variant uppercase tracking-widest mb-2">NurseFlow Workspace</p>
              <h2 className="text-4xl md:text-5xl font-semibold text-on-surface tracking-tight">Schedule Dashboard</h2>
            </div>
            <div className="flex items-center gap-3">
              <div className="px-5 py-2.5 bg-surface-container-lowest border border-outline-variant rounded-full text-sm font-medium text-on-surface">
                {currentTime.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
              </div>
              <div className="px-5 py-2.5 bg-primary text-on-primary rounded-full text-sm font-medium tabular-nums shadow-lg shadow-primary/10">
                {currentTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })}
              </div>
            </div>
          </motion.section>

          <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
            <MetricCard index={0} icon={Users} label="Nurses Scheduled" value={String(nurses.length)} trend="Active roster" />
            <MetricCard index={1} icon={Calendar} label="Weekly Shifts" value={String(totalShifts)} trend="7 days" />
            <MetricCard index={2} icon={AlertTriangle} label="Fatigue Alerts" value={String(fatigueAlerts)} trend={fatigueAlerts > 0 ? 'Review' : 'Clear'} tone={fatigueAlerts > 0 ? 'error' : 'default'} />
            <StatusCard activityCount={activityLog.length} nurseCount={nurses.length} />
          </section>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-12">
            <section className="lg:col-span-2 space-y-6">
              <div className="flex items-center justify-between pt-2">
                <h3 className="text-2xl font-semibold text-on-surface">Schedule Overview</h3>
                <div className="flex items-center gap-2 text-sm font-semibold text-on-surface-variant">
                  <CheckSquare size={16} className={isCompliant ? 'text-secondary' : 'text-error'} />
                  {isCompliant ? 'Compliant' : 'Needs review'}
                </div>
              </div>

              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.32 }}
                className="bg-surface-container-lowest rounded-2xl border border-outline-variant overflow-hidden shadow-sm"
              >
                <div className="p-5 flex items-start gap-4">
                  <div className={`w-11 h-11 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${isCompliant ? 'bg-secondary/10' : 'bg-error-container'}`}>
                    <CheckSquare size={22} className={isCompliant ? 'text-secondary' : 'text-error'} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start mb-1">
                      <h4 className="text-[15px] font-medium text-on-surface">Compliance Score</h4>
                      <span className={`text-[12px] font-medium ${isCompliant ? 'text-secondary' : 'text-error'} shrink-0`}>{complianceScore}%</span>
                    </div>
                    <p className="text-sm text-on-surface-variant mb-3">
                      {isCompliant ? 'Roster rules are currently satisfied.' : 'Review violations in the activity and compliance panels.'}
                    </p>
                    <div className="h-2 bg-surface-container-high rounded-full overflow-hidden">
                      <div className={`h-full ${isCompliant ? 'bg-secondary' : 'bg-error'}`} style={{ width: `${Math.min(complianceScore, 100)}%` }} />
                    </div>
                  </div>
                </div>
              </motion.div>
            </section>

            <aside className="space-y-8">
              <div>
                <h3 className="text-2xl font-semibold text-on-surface mb-6">Insights</h3>
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.38 }}
                  className="bg-surface-container-lowest rounded-2xl border border-outline-variant p-6 relative overflow-hidden group shadow-sm"
                >
                  <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-secondary/40 via-secondary/10 to-transparent" />
                  <div className="flex items-center gap-2 mb-6">
                    <div className="w-8 h-8 rounded-lg bg-secondary/10 flex items-center justify-center text-secondary">
                      <Activity size={16} />
                    </div>
                    <h4 className="text-sm font-semibold text-on-surface">Roster Signals</h4>
                  </div>
                  <div className="space-y-3">
                    <div className="p-3 rounded-xl bg-surface-container-low/50 border border-outline-variant/30">
                      <p className="text-sm text-on-surface mb-0.5 font-medium">{totalShifts} shifts assigned</p>
                      <p className="text-[11px] text-on-surface-variant font-medium">Across the current weekly schedule</p>
                    </div>
                    <div className="p-3 rounded-xl bg-surface-container-low/50 border border-outline-variant/30">
                      <p className="text-sm text-on-surface mb-0.5 font-medium">{fatigueAlerts} fatigue alerts</p>
                      <p className="text-[11px] text-on-surface-variant font-medium">Sorted by highest staff fatigue</p>
                    </div>
                  </div>
                </motion.div>
              </div>
            </aside>
          </div>

          <section className="mb-6">
            <div className="flex items-center justify-between pt-2 mb-6">
              <h3 className="text-2xl font-semibold text-on-surface">Schedule Board</h3>
              <div className="text-xs text-on-surface-variant tracking-wide">
                Last refreshed {currentTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}
              </div>
            </div>

            <div className="grid grid-cols-12 gap-6">
            <div className="col-span-12 lg:col-span-9 bg-surface-container-lowest border border-outline-variant rounded-2xl p-4 shadow-sm">
            <WeeklySchedule
              nurses={nurses.map((n, idx) => ({
                id: String(idx),
                name: n.name,
                skillLevel: Math.min(Math.max(parseInt(n.skill?.replace('N', '') || '1'), 1), 4) as 1 | 2 | 3 | 4,
                ward: (n.ward as any) || 'General',
                fatigue: n.fatigue_score || 50,
                shifts: [],
              }))}
              schedule={schedule}
              staffingRequirements={scheduleData?.forecast}
            />
            </div>

            <div className="col-span-12 lg:col-span-3 bg-surface-container-lowest border border-outline-variant rounded-2xl p-4 shadow-sm">
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
                onNurseClick={(nurse) => setSelectedNurse(nurses.find((n) => n.name === nurse.name) || null)}
              />
            </div>
          </div>
          </section>

          <div className="mb-6 grid grid-cols-1 gap-6 xl:grid-cols-12">
            <div className="xl:col-span-8">
              <AgentActivity
                messages={activityLog}
                nurses={nurses}
                schedule={schedule}
                onScheduleUpdate={handleScheduleUpdate}
                onEmergency={handleHighSeverity}
                onApprovalCreate={handleApprovalCreate}
              />
            </div>
            <div className="xl:col-span-4">
              <PendingApprovals approvals={pendingApprovals} onStatusChange={handleApprovalStatusChange} />
            </div>
          </div>

          <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-4 shadow-sm" style={{ animation: complianceFlash ? 'flashRed 0.5s ease-in-out 6' : 'none' }}>
            <ComplianceBar
              isCompliant={isCompliant && !complianceFlash}
              message={
                isCompliant && !complianceFlash
                  ? warningCount > 0
                    ? `SCHEDULE COMPLIANT - ${warningCount} WARNING${warningCount === 1 ? '' : 'S'} TO REVIEW`
                    : `SCHEDULE COMPLIANT - ${scheduleData?.compliance?.compliance_score ?? 100}% RULES PASSED`
                  : `COMPLIANCE NEEDS REVIEW - ${violationCount} ISSUE${violationCount === 1 ? '' : 'S'} FLAGGED`
              }
            />
          </div>

          <style>{`
          @keyframes flashRed {
            0%, 100% { border-color: transparent; }
            50% { border: 2px solid #ba1a1a; }
          }
        `}</style>
        </div>
      </div>

      {selectedNurse && (
        <NurseModal
          nurse={{
            id: selectedNurse.name,
            name: selectedNurse.name,
            skillLevel: Math.min(Math.max(parseInt(selectedNurse.skill?.replace('N', '') || '1'), 1), 4) as 1 | 2 | 3 | 4,
            ward: (selectedNurse.ward as any) || 'General',
            shifts: [],
            fatigue: selectedNurse.fatigue_score || 50,
          }}
          onClose={() => setSelectedNurse(null)}
        />
      )}
    </div>
  );
}
