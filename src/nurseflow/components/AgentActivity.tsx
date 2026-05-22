import { ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { AgentMessage } from '../data/mockData';
import { PendingApproval } from './PendingApprovals';
import { handleEmergencyLeave, handleOverflow } from '../services/api';

interface AgentActivityProps {
  messages: AgentMessage[];
  nurses?: any[];
  schedule?: any;
  onScheduleUpdate?: (schedule: any, metadata?: any) => void;
  onEmergency?: (severity: string) => void;
  onApprovalCreate?: (approval: PendingApproval) => void;
}

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const SHIFTS = ['morning', 'afternoon', 'night'];
const DEPARTMENTS = ['ER', 'ICU', 'General', 'Pediatrics', 'Surgery'];
const formLabelClass = 'flex h-full flex-col gap-1';
const formHintClass = 'flex h-8 items-end text-[10px] font-bold uppercase leading-3 tracking-wider text-on-surface-variant';
const formControlClass = 'h-10 rounded-lg border border-outline-variant bg-surface-container-low px-3 text-[13px] text-on-surface';
const formButtonClass = 'mt-9 flex h-10 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-[11px] font-bold uppercase tracking-wider text-on-primary disabled:opacity-50';

const messageColors = {
  SCHEDULING: '#4648d4',
  FORECAST: '#4c4546',
  COMPLIANCE: '#4648d4',
  EMERGENCY: '#ba1a1a',
  ORCHESTRATOR: '#0f766e',
};

export function AgentActivity({
  messages: initialMessages,
  nurses = [],
  schedule,
  onScheduleUpdate,
  onEmergency,
  onApprovalCreate,
}: AgentActivityProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [mode, setMode] = useState<'leave' | 'overflow'>('leave');
  const [messages, setMessages] = useState<AgentMessage[]>(() =>
    initialMessages.map((msg, idx) => ({
      ...msg,
      id: msg.id || `${Date.now()}-${idx}`,
    })),
  );
  const [isLoading, setIsLoading] = useState(false);
  const [isEmergency, setIsEmergency] = useState(false);
  const [messageIdCounter, setMessageIdCounter] = useState(initialMessages.length);
  const [overflowResult, setOverflowResult] = useState<any | null>(null);

  const [leaveForm, setLeaveForm] = useState({
    nurseName: '',
    department: 'ER',
    day: 'Monday',
    shift: 'morning',
  });

  const [overflowForm, setOverflowForm] = useState({
    department: 'ER',
    incomingPatients: '8',
    highRiskPatients: '3',
    day: 'Monday',
    shift: 'morning',
  });

  const nurseNames = useMemo(() => nurses.map((nurse) => nurse.name).filter(Boolean), [nurses]);

  const currentSchedule = () => {
    if (schedule) return schedule;
    const scheduleResult = localStorage.getItem('scheduleResult');
    return scheduleResult ? JSON.parse(scheduleResult).schedule : {};
  };

  const appendMessages = (newMessages: AgentMessage[]) => {
    setMessageIdCounter((prev) => prev + newMessages.length);
    setMessages((prev) => [...prev, ...newMessages]);
  };

  const timestamp = () => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const handleLeaveSubmit = async () => {
    if (!leaveForm.nurseName) return;
    setIsLoading(true);

    const result = await handleEmergencyLeave({
      nurseName: leaveForm.nurseName,
      department: leaveForm.department,
      day: leaveForm.day,
      shift: leaveForm.shift,
      nurses,
      currentSchedule: currentSchedule(),
    });

    if (result) {
      const time = timestamp();
      const newMessages: AgentMessage[] = [
        {
          id: `${Date.now()}-${messageIdCounter}`,
          type: 'EMERGENCY',
          message: result.action_taken,
          timestamp: time,
        },
      ];

      if (result.transfer) {
        newMessages.push({
          id: `${Date.now()}-${messageIdCounter + 1}`,
          type: 'SCHEDULING',
          message: `${result.transfer.nurse} transferred from ${result.transfer.from} to ${result.transfer.to} for ${result.transfer.day} ${result.transfer.shift}. Schedule regenerated.`,
          timestamp: time,
        });
      }

      result.repair_notes?.forEach((note: string, idx: number) => {
        newMessages.push({
          id: `${Date.now()}-${messageIdCounter + 10 + idx}`,
          type: 'COMPLIANCE',
          message: note,
          timestamp: time,
        });
      });

      if (result.compliance) {
        const issueCount = result.compliance.reasons?.length || 0;
        const warningCount = result.compliance.warnings?.length || 0;
        newMessages.push({
          id: `${Date.now()}-${messageIdCounter + 30}`,
          type: 'COMPLIANCE',
          message:
            issueCount === 0
              ? `PASSED after emergency update - ${result.compliance.score}% rules met${warningCount ? `, ${warningCount} warnings` : ''}`
              : `NEEDS ATTENTION after emergency update - ${issueCount} issues remain`,
          timestamp: time,
        });
      }

      appendMessages(newMessages);
      onApprovalCreate?.({
        id: result.emergency_leave_id || `leave-${Date.now()}`,
        type: 'emergency_leave',
        title: `${result.emergency_event?.leave_nurse || leaveForm.nurseName} leave approval`,
        subtitle: `${leaveForm.day} ${leaveForm.shift} in ${leaveForm.department}`,
        status: 'pending',
        timestamp: time,
        items: [
          {
            label: result.replacement
              ? `${result.replacement} assigned as replacement`
              : 'No automatic replacement assigned',
            detail: result.action_taken,
          },
          ...(result.repair_notes || []).map((note: string) => ({
            label: 'Roster repair',
            detail: note,
          })),
        ],
      });
      if (result.updated_schedule && onScheduleUpdate) {
        onScheduleUpdate(result.updated_schedule, {
          compliance: result.compliance,
          alerts: result.alerts,
          emergency_event: result.emergency_event,
        });
      }
      if (result.severity === 'HIGH') {
        setIsEmergency(true);
        onEmergency?.('HIGH');
      }
    } else {
      appendMessages([
        {
          id: `${Date.now()}-${messageIdCounter}`,
          type: 'EMERGENCY',
          message: 'Emergency leave could not be processed. Please check the nurse, day, and shift.',
          timestamp: timestamp(),
        },
      ]);
    }

    setIsLoading(false);
  };

  const handleOverflowSubmit = async () => {
    setIsLoading(true);

    const total = Math.max(0, Number(overflowForm.incomingPatients) || 0);
    const highRisk = Math.min(total, Math.max(0, Number(overflowForm.highRiskPatients) || 0));
    const incomingPatients = Array.from({ length: total }, (_, idx) => ({
      triage_level: idx < highRisk ? 'High Risk' : 'Yellow',
      symptoms: idx < highRisk ? ['high-risk overflow case'] : ['overflow case'],
    }));

    const result = await handleOverflow(
      nurses,
      currentSchedule(),
      incomingPatients,
      overflowForm.department,
      overflowForm.day,
      overflowForm.shift,
    );

    if (result) {
      setOverflowResult(result);
      const time = timestamp();
      const newMessages: AgentMessage[] = [
        {
          id: `${Date.now()}-${messageIdCounter}`,
          type: 'ORCHESTRATOR',
          message: result.orchestrator_decision,
          timestamp: time,
        },
        {
          id: `${Date.now()}-${messageIdCounter + 1}`,
          type: 'ORCHESTRATOR',
          message: `${result.load_level} ${result.department} load: ${result.high_risk_patients}/${result.incoming_patients} incoming patients are high-risk. Head nurse approval required before official schedule change.`,
          timestamp: time,
        },
      ];

      result.transfers?.forEach((transfer: any, idx: number) => {
        newMessages.push({
          id: `${Date.now()}-${messageIdCounter + 2 + idx}`,
          type: 'SCHEDULING',
          message: `Transfer recommendation: ${transfer.nurse} from ${transfer.from} to ${transfer.to} (${transfer.status}).`,
          timestamp: time,
        });
      });

      appendMessages(newMessages);
      onApprovalCreate?.({
        id: result.overflow_event_id || `overflow-${Date.now()}`,
        type: 'overflow',
        title: `${result.load_level} ${result.department} overload`,
        subtitle: `${result.high_risk_patients}/${result.incoming_patients} high-risk patients, ${result.transfers?.length || 0} support recommendation(s)`,
        status: 'pending',
        timestamp: time,
        items: (result.transfers || []).map((transfer: any) => ({
          label: `${transfer.nurse} to ${transfer.to}`,
          detail: `${transfer.from} to ${transfer.to} for ${result.current_day || overflowForm.day} ${result.current_shift || overflowForm.shift}`,
        })),
      });
      if (result.load_level === 'HIGH' || result.load_level === 'CRITICAL') {
        setIsEmergency(true);
        onEmergency?.('HIGH');
      }
    } else {
      appendMessages([
        {
          id: `${Date.now()}-${messageIdCounter}`,
          type: 'ORCHESTRATOR',
          message: 'Overflow assessment failed. Please check the patient counts and current schedule.',
          timestamp: timestamp(),
        },
      ]);
    }

    setIsLoading(false);
  };

  const staffing = overflowResult?.department_staffing;

  return (
    <div
      className={`overflow-hidden rounded-xl border bg-surface-container-lowest ${
        isEmergency ? 'border-error shadow-sm shadow-error/10' : 'border-outline-variant shadow-sm'
      }`}
    >
      <div className="flex items-center justify-between px-6 py-4 cursor-pointer" onClick={() => setIsExpanded(!isExpanded)}>
        <div className="flex items-center gap-3">
          <h3 className={`text-[11px] font-bold uppercase tracking-widest ${isEmergency ? 'text-error' : 'text-on-surface-variant'}`}>
            Agent Activity
          </h3>
          {isEmergency && <span className="rounded bg-error px-2 py-0.5 text-[10px] font-semibold text-white">ALERT</span>}
        </div>
        {isExpanded ? <ChevronUp size={20} className="text-on-surface-variant" /> : <ChevronDown size={20} className="text-on-surface-variant" />}
      </div>

      {isExpanded && (
        <>
          <div className="max-h-40 overflow-y-auto border-y border-outline-variant px-6">
            <div className="py-3 flex flex-col gap-3">
              {messages.map((msg) => (
                <div key={msg.id} className="flex items-start gap-3">
                  <span
                    className="px-2 py-1 rounded text-xs shrink-0"
                    style={{
                      backgroundColor:
                        msg.type === 'EMERGENCY'
                          ? 'rgba(186, 26, 26, 0.1)'
                          : msg.type === 'ORCHESTRATOR'
                            ? 'rgba(15, 118, 110, 0.1)'
                            : 'rgba(70, 72, 212, 0.1)',
                      color: messageColors[msg.type],
                      fontSize: '10px',
                      fontWeight: 600,
                      textTransform: 'uppercase',
                    }}
                  >
                    [{msg.type}]
                  </span>
                  <span className={`flex-1 text-[13px] ${msg.type === 'EMERGENCY' ? 'text-error' : 'text-on-surface'}`}>
                    {msg.message}
                  </span>
                  <span className="shrink-0 text-[11px] text-on-surface-variant">{msg.timestamp}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="border-b border-outline-variant px-4 pt-4">
            <div className="flex gap-2">
              {[
                ['leave', 'Emergency Leave'],
                ['overflow', 'Overflow'],
              ].map(([value, label]) => (
                <button
                  key={value}
                  onClick={() => setMode(value as 'leave' | 'overflow')}
                  className={`rounded-t-lg px-4 py-2 text-[11px] font-bold uppercase tracking-wider ${
                    mode === value ? 'bg-primary text-on-primary' : 'bg-surface-container-low text-on-surface-variant'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {mode === 'leave' ? (
            <div className="grid grid-cols-1 gap-3 p-4 md:grid-cols-5">
              <label className={formLabelClass}>
                <span className={formHintClass}>Nurse on leave</span>
                <select value={leaveForm.nurseName} onChange={(e) => setLeaveForm({ ...leaveForm, nurseName: e.target.value })} className={formControlClass}>
                  <option value="">Select affected nurse</option>
                  {nurseNames.map((name) => <option key={name} value={name}>{name}</option>)}
                </select>
              </label>
              <label className={formLabelClass}>
                <span className={formHintClass}>Department</span>
                <select value={leaveForm.department} onChange={(e) => setLeaveForm({ ...leaveForm, department: e.target.value })} className={formControlClass}>
                  {DEPARTMENTS.map((dept) => <option key={dept} value={dept}>{dept}</option>)}
                </select>
              </label>
              <label className={formLabelClass}>
                <span className={formHintClass}>Leave day</span>
                <select value={leaveForm.day} onChange={(e) => setLeaveForm({ ...leaveForm, day: e.target.value })} className={formControlClass}>
                  {DAYS.map((day) => <option key={day} value={day}>{day}</option>)}
                </select>
              </label>
              <label className={formLabelClass}>
                <span className={formHintClass}>Leave shift</span>
                <select value={leaveForm.shift} onChange={(e) => setLeaveForm({ ...leaveForm, shift: e.target.value })} className={formControlClass}>
                  {SHIFTS.map((shift) => <option key={shift} value={shift}>{shift}</option>)}
                </select>
              </label>
              <button onClick={handleLeaveSubmit} disabled={isLoading || !leaveForm.nurseName} className={formButtonClass}>
                {isLoading ? <Loader2 size={14} className="animate-spin" /> : 'Generate Again'}
              </button>
            </div>
          ) : (
            <div className="space-y-4 p-4">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-6">
                <label className={formLabelClass}>
                  <span className={formHintClass}>Overflow department</span>
                  <select value={overflowForm.department} onChange={(e) => setOverflowForm({ ...overflowForm, department: e.target.value })} className={formControlClass}>
                    {DEPARTMENTS.map((dept) => <option key={dept} value={dept}>{dept}</option>)}
                  </select>
                </label>
                <label className={formLabelClass}>
                  <span className={formHintClass}>Incoming patients</span>
                  <input type="number" min="0" value={overflowForm.incomingPatients} onChange={(e) => setOverflowForm({ ...overflowForm, incomingPatients: e.target.value })} placeholder="e.g. 8 new ER cases" className={formControlClass} />
                </label>
                <label className={formLabelClass}>
                  <span className={formHintClass}>High-risk patients</span>
                  <input type="number" min="0" value={overflowForm.highRiskPatients} onChange={(e) => setOverflowForm({ ...overflowForm, highRiskPatients: e.target.value })} placeholder="e.g. 3 critical cases" className={formControlClass} />
                </label>
                <label className={formLabelClass}>
                  <span className={formHintClass}>Current day</span>
                  <select value={overflowForm.day} onChange={(e) => setOverflowForm({ ...overflowForm, day: e.target.value })} className={formControlClass}>
                    {DAYS.map((day) => <option key={day} value={day}>{day}</option>)}
                  </select>
                </label>
                <label className={formLabelClass}>
                  <span className={formHintClass}>Current shift</span>
                  <select value={overflowForm.shift} onChange={(e) => setOverflowForm({ ...overflowForm, shift: e.target.value })} className={formControlClass}>
                    {SHIFTS.map((shift) => <option key={shift} value={shift}>{shift}</option>)}
                  </select>
                </label>
                <button onClick={handleOverflowSubmit} disabled={isLoading} className={formButtonClass}>
                  {isLoading ? <Loader2 size={14} className="animate-spin" /> : 'Assess Overflow'}
                </button>
              </div>

              {staffing && (
                <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                  {[
                    ['Current active', staffing.active_now_by_department],
                    ['After transfer', staffing.after_recommended_transfer],
                    ['Roster total', staffing.roster_total_by_department],
                  ].map(([title, counts]: any) => (
                    <div key={title} className="rounded-xl border border-outline-variant bg-surface-container-low p-3">
                      <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">{title}</p>
                      {Object.entries(counts).map(([dept, count]) => (
                        <div key={dept} className="flex justify-between text-[13px] text-on-surface">
                          <span>{dept}</span>
                          <span>{String(count)} nurses</span>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
