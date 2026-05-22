import { CheckCircle, Circle, Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { runForecastAgent, runScheduleAgent, runComplianceAgent } from '../services/api';

export default function Processing() {
  const navigate = useNavigate();

  const nursesData = localStorage.getItem('nurses');
  const nurseCount = nursesData ? JSON.parse(nursesData).length : 0;

  const initialSteps = [
    { label: 'PDF received', status: 'complete' as const },
    { label: `OCR complete - ${nurseCount} nurses extracted`, status: 'complete' as const },
    { label: 'Forecast Agent analysing...', status: 'pending' as 'pending' | 'loading' | 'complete' },
    { label: 'Scheduling Agent...', status: 'pending' as 'pending' | 'loading' | 'complete' },
    { label: 'Compliance Agent...', status: 'pending' as 'pending' | 'loading' | 'complete' },
    { label: 'Schedule ready', status: 'pending' as 'pending' | 'loading' | 'complete' },
  ];

  const [progress, setProgress] = useState(33);
  const [steps, setSteps] = useState(initialSteps);
  const [error, setError] = useState<string | null>(null);
  const [isComplete, setIsComplete] = useState(false);

  useEffect(() => {
    const runGeneration = async () => {
      const storedNurses = localStorage.getItem('nurses');
      const nurses = storedNurses ? JSON.parse(storedNurses) : [];

      if (nurses.length === 0) {
        setError('No nurse data found. Please upload a PDF first.');
        return;
      }

      setSteps((prev) => prev.map((s, i) => (i === 2 ? { ...s, status: 'loading' as const } : s)));

      const forecastResult = await runForecastAgent(nurses);
      if (!forecastResult) {
        setError('Forecast Agent failed. Please try again.');
        return;
      }

      setSteps((prev) =>
        prev.map((s, i) =>
          i === 2 ? { ...s, status: 'complete' as const } : i === 3 ? { ...s, status: 'loading' as const } : s,
        ),
      );
      setProgress(50);

      const scheduleResult = await runScheduleAgent(nurses, forecastResult.staffing_requirements);
      if (!scheduleResult) {
        setError('Scheduling Agent failed. Please try again.');
        return;
      }

      setSteps((prev) =>
        prev.map((s, i) =>
          i === 3 ? { ...s, status: 'complete' as const } : i === 4 ? { ...s, status: 'loading' as const } : s,
        ),
      );
      setProgress(75);

      const complianceResult = await runComplianceAgent(scheduleResult.schedule, nurses);
      if (!complianceResult) {
        setError('Compliance Agent failed. Please try again.');
        return;
      }

      setSteps((prev) => prev.map((s, i) => (i === 4 ? { ...s, status: 'complete' as const } : s)));
      setProgress(90);

      const finalResult = {
        schedule: scheduleResult.schedule,
        staffing_requirements: forecastResult.staffing_requirements,
        compliance: complianceResult.compliance,
        alerts: [],
      };

      localStorage.setItem('scheduleResult', JSON.stringify(finalResult));

      setSteps((prev) => prev.map((s, i) => (i === 5 ? { ...s, status: 'complete' as const } : s)));
      setProgress(100);
      setIsComplete(true);

      setTimeout(() => navigate('/nurseflow/dashboard'), 500);
    };

    runGeneration();
  }, [navigate]);

  return (
    <div className="min-h-full flex flex-col items-center justify-center px-6 py-10 bg-surface">
      <div className="w-full max-w-[480px]">
        <div className="mb-10">
          <h1 className="text-2xl tracking-tight font-semibold text-on-surface">NurseFlow</h1>
        </div>

        <div className="mb-8 text-center">
          <h2 className="mb-3 text-3xl font-semibold text-on-surface">
            {error ? 'Processing Failed' : isComplete ? 'Schedule Ready!' : 'Analysing Your Roster...'}
          </h2>
          <p className="text-sm text-on-surface-variant">{error ? error : 'Our AI agents are processing your data'}</p>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-lg bg-error/10 border border-error/20">
            <p className="text-sm text-error">{error}</p>
            <button onClick={() => window.location.reload()} className="mt-3 px-4 py-2 rounded-md bg-error text-white text-sm">
              Retry
            </button>
          </div>
        )}

        <div className="mb-6 bg-surface-container-lowest border border-outline-variant rounded-lg p-6">
          <div className="flex flex-col gap-5">
            {steps.map((step, index) => (
              <div key={index} className="flex items-center gap-3">
                {step.status === 'complete' && <CheckCircle size={20} className="text-secondary" />}
                {step.status === 'loading' && <Loader2 size={20} className="animate-spin text-secondary" />}
                {step.status === 'pending' && <Circle size={20} className="text-on-surface-variant" />}
                <span className={`text-sm ${step.status === 'pending' ? 'text-on-surface-variant' : 'text-secondary'}`}>{step.label}</span>
              </div>
            ))}
          </div>
        </div>

        <div>
          <div className="flex justify-end mb-2">
            <span className="text-sm text-secondary font-semibold">{progress}%</span>
          </div>
          <div className="w-full rounded-full overflow-hidden h-1.5 bg-surface-container-high">
            <div
              className="h-full transition-all duration-300"
              style={{
                width: `${progress}%`,
                backgroundColor: error ? '#ba1a1a' : '#4648d4',
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
