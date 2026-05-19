import { Upload, FileText, Brain, CheckCircle, Loader2, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router';
import { useState, useRef, useEffect, DragEvent, ChangeEvent } from 'react';
import { uploadPDF, generateSchedule, fetchNurses, healthCheck } from '../services/api';
import { LiquidGradientBg } from '../components/LiquidGradientBg';

// Badge states
interface BadgeState {
  ocr: 'idle' | 'loading' | 'done' | 'error';
  scheduling: 'idle' | 'loading' | 'done' | 'error';
  compliance: 'idle' | 'loading' | 'done' | 'error';
}

export default function UploadPage() {
  const navigate = useNavigate();
  const [isDragging, setIsDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [extractedNurses, setExtractedNurses] = useState<any[] | null>(null);
  const [apiNurses, setApiNurses] = useState<any[] | null>(null);
  const [badgeStates, setBadgeStates] = useState<BadgeState>({
    ocr: 'idle',
    scheduling: 'idle',
    compliance: 'idle'
  });
  const [backendStatus, setBackendStatus] = useState<'checking' | 'connected' | 'error'>('checking');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Check backend health on mount
  useEffect(() => {
    const checkBackend = async () => {
      const health = await healthCheck();
      if (health && health.status === 'ok') {
        setBackendStatus('connected');
        const nursesData = await fetchNurses();
        if (nursesData && nursesData.nurses) {
          setApiNurses(nursesData.nurses);
        }
      } else {
        setBackendStatus('error');
        setError('Backend not connected — make sure uvicorn is running on port 8000');
      }
    };
    checkBackend();
  }, []);

  const handleFileSelect = async (selectedFile: File) => {
    if (selectedFile.type !== 'application/pdf') {
      setError('Please upload a PDF file only');
      return;
    }
    setFile(selectedFile);
    setError(null);
    setSuccess(null);
    setExtractedNurses(null);
    await extractPDF(selectedFile);
  };

  const extractPDF = async (pdfFile: File) => {
    setIsUploading(true);
    setSuccess('Extracting data from PDF...');
    setBadgeStates(prev => ({ ...prev, ocr: 'loading' }));
    const result = await uploadPDF(pdfFile);
    if (result && result.nurses) {
      setExtractedNurses(result.nurses);
      setSuccess(`✅ PDF extracted successfully — ${result.nurses_found} nurses found`);
      setBadgeStates(prev => ({ ...prev, ocr: 'done' }));
    } else {
      setError('OCR Agent failed — PDF may be unreadable or backend error');
      setSuccess(null);
      setBadgeStates(prev => ({ ...prev, ocr: 'error' }));
    }
    setIsUploading(false);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) handleFileSelect(droppedFile);
  };

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) handleFileSelect(selectedFile);
  };

  const animateBadges = async () => {
    setBadgeStates(prev => ({ ...prev, scheduling: 'loading' }));
    await new Promise(r => setTimeout(r, 2000));
    setBadgeStates(prev => ({ ...prev, scheduling: 'done', compliance: 'loading' }));
    await new Promise(r => setTimeout(r, 1000));
    setBadgeStates(prev => ({ ...prev, compliance: 'done' }));
  };

  const handleGenerate = async () => {
    if (backendStatus !== 'connected') {
      setError('Backend not connected — cannot generate schedule');
      return;
    }
    const nursesToUse = extractedNurses || apiNurses;
    if (!nursesToUse || nursesToUse.length === 0) {
      setError('No nurse data available — upload a PDF or wait for API to load');
      return;
    }
    // Store nurses and navigate to Processing page for animation
    localStorage.setItem('nurses', JSON.stringify(nursesToUse));
    navigate('/processing');
  };

  const handleDemoClick = async () => {
    if (backendStatus !== 'connected') {
      setError('Backend not connected — cannot run demo');
      return;
    }
    if (apiNurses && apiNurses.length > 0) {
      setExtractedNurses(apiNurses);
      setSuccess(`✅ Demo data loaded — ${apiNurses.length} nurses from API`);
      setTimeout(async () => { await handleGenerate(); }, 500);
    } else {
      setError('No nurse data available from API — cannot run demo');
    }
  };

  const getBadgeStyle = (state: 'idle' | 'loading' | 'done' | 'error') => {
    if (state === 'done') return { backgroundColor: 'rgba(0, 229, 160, 0.1)', border: '1px solid rgba(0, 229, 160, 0.5)' };
    if (state === 'error') return { backgroundColor: 'rgba(255, 61, 90, 0.1)', border: '1px solid rgba(255, 61, 90, 0.5)' };
    return { backgroundColor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' };
  };

  const getBadgeTextColor = (state: 'idle' | 'loading' | 'done' | 'error') => {
    if (state === 'done') return '#00E5A0';
    if (state === 'error') return '#FF3D5A';
    return 'rgba(255,255,255,0.6)';
  };

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-6 relative overflow-hidden"
      style={{ backgroundColor: '#050d1a' }}
    >
      <LiquidGradientBg />

      {/* Content */}
      <div style={{ width: '520px', position: 'relative', zIndex: 2 }}>
        {/* Logo */}
        <div className="mb-16">
          <h1
            style={{
              fontFamily: 'Syne, sans-serif',
              fontWeight: 700,
              fontSize: '20px',
              letterSpacing: '-0.3px',
              color: '#7ecfff',
            }}
          >
            NurseFlow
          </h1>
        </div>

        {/* Hero Text */}
        <div className="mb-10">
          <h2
            className="mb-3"
            style={{
              fontFamily: 'Syne, sans-serif',
              fontWeight: 700,
              fontSize: '38px',
              lineHeight: '1.15',
              color: '#ffffff',
              letterSpacing: '-0.5px',
            }}
          >
            Smart Rostering Starts With One File
          </h2>
          <p style={{ fontSize: '15px', color: 'rgba(255,255,255,0.4)', lineHeight: 1.6, textAlign: 'center' }}>
            Upload your existing roster PDF and let our AI agents optimise your scheduling.
          </p>
        </div>

        {/* Backend Status */}
        <div
          className="mb-4 p-2 rounded-lg text-center"
          style={{
            backgroundColor:
              backendStatus === 'connected' ? 'rgba(0,229,160,0.07)' :
              backendStatus === 'error' ? 'rgba(255,61,90,0.08)' : 'rgba(100,160,255,0.07)',
            border: `1px solid ${
              backendStatus === 'connected' ? 'rgba(0,229,160,0.3)' :
              backendStatus === 'error' ? 'rgba(255,61,90,0.3)' : 'rgba(100,160,255,0.2)'
            }`,
          }}
        >
          <p style={{
            fontSize: '12px',
            color:
              backendStatus === 'connected' ? '#00E5A0' :
              backendStatus === 'error' ? '#FF3D5A' : 'rgba(140,200,255,0.8)',
          }}>
            {backendStatus === 'checking' ? '⏳ Checking backend connection...' :
             backendStatus === 'connected' ? '✅ Backend connected — all agents ready' :
             '❌ Backend disconnected — start uvicorn on port 8000'}
          </p>
        </div>

        {/* Error */}
        {error && (
          <div
            className="mb-4 p-3 rounded-lg flex items-center gap-2"
            style={{ backgroundColor: 'rgba(255,61,90,0.1)', border: '1px solid rgba(255,61,90,0.35)' }}
          >
            <AlertCircle size={15} style={{ color: '#FF3D5A', flexShrink: 0 }} />
            <p style={{ fontSize: '13px', color: '#FF3D5A' }}>{error}</p>
          </div>
        )}

        {/* Success */}
        {success && (
          <div
            className="mb-4 p-3 rounded-lg"
            style={{ backgroundColor: 'rgba(0,229,160,0.07)', border: '1px solid rgba(0,229,160,0.3)' }}
          >
            <p style={{ fontSize: '13px', color: '#00E5A0' }}>{success}</p>
          </div>
        )}

        {/* Hidden File Input */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,application/pdf"
          onChange={handleInputChange}
          style={{ display: 'none' }}
        />

        {/* Upload Box */}
        <div
          className="mb-6 flex flex-col items-center justify-center cursor-pointer"
          style={{
            width: '520px',
            height: '190px',
            background: isDragging
              ? 'rgba(40, 100, 220, 0.12)'
              : extractedNurses
              ? 'rgba(0, 229, 160, 0.05)'
              : 'rgba(255,255,255,0.025)',
            border: extractedNurses
              ? '1.5px solid rgba(0,229,160,0.5)'
              : `1.5px dashed ${isDragging ? 'rgba(80,160,255,0.7)' : 'rgba(80,140,255,0.25)'}`,
            borderRadius: '14px',
            backdropFilter: 'blur(8px)',
            transition: 'all 0.25s ease',
          }}
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <Upload
            size={28}
            style={{
              color: extractedNurses ? '#00E5A0' : 'rgba(120,180,255,0.7)',
              marginBottom: '10px',
            }}
          />
          <p style={{ fontSize: '15px', color: 'rgba(255,255,255,0.85)', marginBottom: '4px' }}>
            {file ? file.name : 'Drop your PDF here'}
          </p>
          <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.3)' }}>
            {file ? 'Click to change file' : 'Supports scanned & digital PDFs'}
          </p>
        </div>

        {/* Feature Pills */}
        <div className="flex gap-2 mb-6">
          {[
            {
              key: 'ocr' as const,
              icon: badgeStates.ocr === 'loading'
                ? <Loader2 size={13} className="animate-spin" />
                : badgeStates.ocr === 'error'
                ? <AlertCircle size={13} />
                : <FileText size={13} />,
              label: badgeStates.ocr === 'done' ? '✅ OCR Extraction' :
                     badgeStates.ocr === 'error' ? '❌ OCR Failed' : '📄 OCR Extraction',
            },
            {
              key: 'scheduling' as const,
              icon: badgeStates.scheduling === 'loading'
                ? <Loader2 size={13} className="animate-spin" />
                : <Brain size={13} />,
              label: badgeStates.scheduling === 'done' ? '✅ AI Scheduling' : '🤖 AI Scheduling',
            },
            {
              key: 'compliance' as const,
              icon: badgeStates.compliance === 'loading'
                ? <Loader2 size={13} className="animate-spin" />
                : <CheckCircle size={13} />,
              label: badgeStates.compliance === 'done' ? '✅ Compliance Check' : '✅ Compliance Check',
            },
          ].map(({ key, icon, label }) => (
            <div
              key={key}
              className="flex items-center gap-2 px-3 py-2 rounded-lg"
              style={{
                ...getBadgeStyle(badgeStates[key]),
                transition: 'all 0.3s ease',
              }}
            >
              <span style={{ color: getBadgeTextColor(badgeStates[key]) }}>{icon}</span>
              <span style={{ fontSize: '12px', color: getBadgeTextColor(badgeStates[key]) }}>{label}</span>
            </div>
          ))}
        </div>

        {/* Generate Button */}
        <button
          onClick={handleGenerate}
          disabled={isGenerating || backendStatus !== 'connected'}
          className="flex items-center justify-center gap-2"
          style={{
            width: '520px',
            height: '48px',
            background: isGenerating || backendStatus !== 'connected'
              ? 'rgba(60, 130, 220, 0.3)'
              : 'linear-gradient(135deg, #1a6fd4 0%, #0fa3e0 100%)',
            color: '#ffffff',
            fontFamily: 'Syne, sans-serif',
            fontWeight: 700,
            fontSize: '13px',
            letterSpacing: '1.5px',
            borderRadius: '10px',
            border: isGenerating || backendStatus !== 'connected'
              ? '1px solid rgba(80,150,255,0.2)'
              : '1px solid rgba(120,200,255,0.25)',
            cursor: isGenerating || backendStatus !== 'connected' ? 'not-allowed' : 'pointer',
            opacity: isGenerating || backendStatus !== 'connected' ? 0.5 : 1,
            transition: 'all 0.2s ease',
            boxShadow: isGenerating || backendStatus !== 'connected'
              ? 'none'
              : '0 0 24px rgba(20, 120, 220, 0.35)',
          }}
          onMouseEnter={e => {
            if (!isGenerating && backendStatus === 'connected') {
              (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 0 36px rgba(20, 140, 255, 0.55)';
              (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-1px)';
            }
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 0 24px rgba(20, 120, 220, 0.35)';
            (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(0)';
          }}
        >
          {isGenerating ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              Generating...
            </>
          ) : (
            'GENERATE SCHEDULE'
          )}
        </button>

        {/* Footer */}
        <p className="text-center mt-6" style={{ fontSize: '11px', color: 'rgba(255,255,255,0.2)', letterSpacing: '0.3px' }}>
          Your data never leaves the hospital system
        </p>
      </div>
    </div>
  );
}