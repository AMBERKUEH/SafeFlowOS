import { CheckCircle, Circle, Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { runForecastAgent, runScheduleAgent, runComplianceAgent } from '../services/api';
import { LiquidGradientBg } from '../components/LiquidGradientBg';

export default function Processing() {
  const navigate = useNavigate();
  
  // Get nurse count from localStorage for display
  const nursesData = localStorage.getItem('nurses');
  const nurseCount = nursesData ? JSON.parse(nursesData).length : 0;
  
  const initialSteps = [
    { label: 'PDF received', status: 'complete' as const },
    { label: `OCR complete — ${nurseCount} nurses extracted`, status: 'complete' as const },
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
      // Get nurses from localStorage
      const nursesData = localStorage.getItem('nurses');
      const nurses = nursesData ? JSON.parse(nursesData) : [];
      
      if (nurses.length === 0) {
        setError('No nurse data found. Please upload a PDF first.');
        return;
      }

      // Step 3: Forecast Agent (REAL API CALL)
      setSteps((prev) => prev.map((s, i) => 
        i === 2 ? { ...s, status: 'loading' as const } : s
      ));
      
      const forecastResult = await runForecastAgent(nurses);
      if (!forecastResult) {
        setError('Forecast Agent failed. Please try again.');
        return;
      }
      
      setSteps((prev) => prev.map((s, i) => 
        i === 2 ? { ...s, status: 'complete' as const } : 
        i === 3 ? { ...s, status: 'loading' as const } : s
      ));
      setProgress(50);

      // Step 4: Scheduling Agent (REAL API CALL)
      const scheduleResult = await runScheduleAgent(nurses, forecastResult.staffing_requirements);
      if (!scheduleResult) {
        setError('Scheduling Agent failed. Please try again.');
        return;
      }
      
      setSteps((prev) => prev.map((s, i) => 
        i === 3 ? { ...s, status: 'complete' as const } : 
        i === 4 ? { ...s, status: 'loading' as const } : s
      ));
      setProgress(75);

      // Step 5: Compliance Agent (REAL API CALL)
      const complianceResult = await runComplianceAgent(scheduleResult.schedule, nurses);
      if (!complianceResult) {
        setError('Compliance Agent failed. Please try again.');
        return;
      }
      
      setSteps((prev) => prev.map((s, i) => 
        i === 4 ? { ...s, status: 'complete' as const } : s
      ));
      setProgress(90);

      // Combine all results and save
      const finalResult = {
        schedule: scheduleResult.schedule,
        staffing_requirements: forecastResult.staffing_requirements,
        compliance: complianceResult.compliance,
        alerts: [],
      };
      
      localStorage.setItem('scheduleResult', JSON.stringify(finalResult));
      
      // Step 6: Complete
      setSteps((prev) => prev.map((s, i) => 
        i === 5 ? { ...s, status: 'complete' as const } : s
      ));
      setProgress(100);
      setIsComplete(true);
      
      // Navigate after short delay
      setTimeout(() => navigate('/dashboard'), 500);
    };

    runGeneration();
  }, [navigate]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6" style={{ backgroundColor: '#050d1a', position: 'relative' }}>
      <LiquidGradientBg />
      <div style={{ width: '480px', position: 'relative', zIndex: 2 }}>
        {/* Logo */}
        <div className="mb-16">
          <h1 
            className="text-2xl tracking-tight"
            style={{ 
              fontFamily: 'Syne, sans-serif',
              fontWeight: 700,
              color: '#00D4FF'
            }}
          >
            NurseFlow
          </h1>
        </div>

        {/* Title */}
        <div className="mb-8 text-center">
          <h2 
            className="mb-3"
            style={{ 
              fontFamily: 'Syne, sans-serif',
              fontWeight: 700,
              fontSize: '28px',
              color: '#FFFFFF'
            }}
          >
            {error ? 'Processing Failed' : isComplete ? 'Schedule Ready!' : 'Analysing Your Roster...'}
          </h2>
          <p style={{ fontSize: '14px', color: '#6B7280' }}>
            {error ? error : 'Our AI agents are processing your data'}
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div 
            className="mb-6 p-4 rounded-lg"
            style={{ 
              backgroundColor: 'rgba(255, 61, 90, 0.2)',
              border: '1px solid #FF3D5A'
            }}
          >
            <p style={{ fontSize: '14px', color: '#FF3D5A' }}>{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="mt-3 px-4 py-2 rounded"
              style={{
                backgroundColor: '#FF3D5A',
                color: '#FFFFFF',
                fontSize: '13px',
                border: 'none',
                cursor: 'pointer'
              }}
            >
              Retry
            </button>
          </div>
        )}

        {/* Steps Card */}
        <div 
          className="mb-6"
          style={{ 
            backgroundColor: '#111827',
            borderRadius: '8px',
            padding: '24px',
          }}
        >
          <div className="flex flex-col gap-5">
            {steps.map((step, index) => (
              <div key={index} className="flex items-center gap-3">
                {step.status === 'complete' && (
                  <CheckCircle size={20} style={{ color: '#00E5A0' }} />
                )}
                {step.status === 'loading' && (
                  <Loader2 size={20} className="animate-spin" style={{ color: '#00D4FF' }} />
                )}
                {step.status === 'pending' && (
                  <Circle size={20} style={{ color: '#6B7280' }} />
                )}
                <span 
                  style={{ 
                    fontSize: '14px',
                    color: step.status === 'pending' ? '#6B7280' : step.status === 'loading' ? '#00D4FF' : '#00E5A0'
                  }}
                >
                  {step.label}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Progress Bar */}
        <div>
          <div className="flex justify-end mb-2">
            <span style={{ fontSize: '14px', color: '#00D4FF', fontWeight: 600 }}>
              {progress}%
            </span>
          </div>
          <div 
            className="w-full rounded-full overflow-hidden"
            style={{ 
              height: '6px',
              backgroundColor: '#1A2235'
            }}
          >
            <div 
              className="h-full transition-all duration-300"
              style={{ 
                width: `${progress}%`,
                backgroundColor: error ? '#FF3D5A' : '#00D4FF'
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
