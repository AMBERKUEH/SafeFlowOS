import { useState, useEffect } from 'react';
import { MainNavbar } from '../components/MainNavbar';
import { StaffPanel } from '../components/StaffPanel';
import { WeeklySchedule } from '../components/WeeklySchedule';
import { ComplianceBar } from '../components/ComplianceBar';
import { NurseModal } from '../components/NurseModal';
import { AgentActivity } from '../components/AgentActivity';
import { LiquidGradientBg } from '../components/LiquidGradientBg';
import { Loader2, AlertCircle, Users, Calendar, Activity } from 'lucide-react';
import { AgentMessage, Nurse } from '../data/mockData';

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

export default function SchedulePage() {
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
          setSchedule(result.schedule);
        }

        setIsLoading(false);
      } catch (err) {
        console.error('Error loading data:', err);
        setError('Failed to load schedule data');
        setIsLoading(false);
      }
    };

    loadData();
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-cyan-400" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-900 flex flex-col">
        <div className="relative z-50">
          <MainNavbar />
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
            <p className="text-red-400">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col">
      <div className="relative z-50">
        <MainNavbar />
      </div>
      
      <div className="flex-1 relative overflow-hidden">
        <LiquidGradientBg />
        
        <div className="relative z-10 p-6 h-full overflow-y-auto">
          {/* Header */}
          <div className="flex justify-between items-center mb-6">
            <div>
              <h1 className="text-2xl font-bold text-white">Nurse Schedule</h1>
              <p className="text-gray-400 text-sm">
                {currentTime.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
              </p>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 text-gray-400">
                <Users size={18} />
                <span>{nurses.length} Nurses</span>
              </div>
              <div className="flex items-center gap-2 text-gray-400">
                <Calendar size={18} />
                <span>7-Day Schedule</span>
              </div>
            </div>
          </div>

          {/* Main Grid - WeeklySchedule left, StaffPanel right */}
          <div className="grid grid-cols-12 gap-6 mb-6">
            {/* WeeklySchedule - on the left (col-span-9) */}
            <div className="col-span-9">
              <WeeklySchedule 
                schedule={schedule} 
                nurses={nurses}
                staffingRequirements={scheduleData?.forecast}
              />
            </div>
            {/* StaffPanel - combines StaffList and FatigueIndex on the right */}
            <div className="col-span-3">
              <StaffPanel
                nurses={nurses}
                schedule={schedule}
                onNurseClick={setSelectedNurse}
              />
            </div>
          </div>

          {/* Agent Activity Panel - Below Weekly Schedule */}
          <div style={{ marginBottom: '24px' }}>
            <AgentActivity 
              messages={activityLog}
              schedule={schedule}
            />
          </div>

          {/* Compliance Bar */}
          {scheduleData?.compliance && (
            <div className="mt-4">
              <ComplianceBar 
                isCompliant={scheduleData.compliance.passed}
                message={scheduleData.compliance.passed ? 'Schedule Compliant' : scheduleData.compliance.violations[0] || 'Compliance Issues'}
              />
            </div>
          )}
        </div>
      </div>

      {/* Nurse Modal */}
      {selectedNurse && (
        <NurseModal 
          nurse={selectedNurse} 
          onClose={() => setSelectedNurse(null)} 
        />
      )}
    </div>
  );
}
