import { Upload, FileText, Brain, CheckCircle, Loader2, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router';
import { useState, useRef, useEffect, DragEvent, ChangeEvent } from 'react';
import { uploadPDF, fetchNurses, healthCheck } from '../services/api';

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
        setError('Backend not connected - make sure uvicorn is running on port 8000');
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
    try {
      const result = await uploadPDF(pdfFile);
      if (result && result.nurses) {
        setExtractedNurses(result.nurses);
        setSuccess(`PDF extracted successfully - ${result.nurses_found} nurses found`);
        setBadgeStates(prev => ({ ...prev, ocr: 'done' }));
      } else {
        setError('OCR Agent failed - PDF may be unreadable or backend error');
        setSuccess(null);
        setBadgeStates(prev => ({ ...prev, ocr: 'error' }));
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'OCR failed';
      setError(message);
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

  const handleGenerate = async () => {
    if (backendStatus !== 'connected') {
      setError('Backend not connected - cannot generate schedule');
      return;
    }
    const nursesToUse = extractedNurses || apiNurses;
    if (!nursesToUse || nursesToUse.length === 0) {
      setError('No nurse data available - upload a PDF or wait for API to load');
      return;
    }

    setIsGenerating(true);
    localStorage.setItem('nurses', JSON.stringify(nursesToUse));
    navigate('/nurseflow/processing');
  };

  const badgeTone = (state: 'idle' | 'loading' | 'done' | 'error') => {
    if (state === 'error') return 'text-error';
    if (state === 'done') return 'text-secondary';
    return 'text-on-surface-variant';
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-6 bg-surface">
      <div className="w-full max-w-[520px]">
        <div className="mb-10">
          <h1 className="text-2xl font-semibold tracking-tight text-on-surface">NurseFlow</h1>
        </div>

        <div className="mb-10">
          <h2 className="mb-3 text-4xl font-semibold tracking-tight text-on-surface">Smart Rostering Starts With One File</h2>
          <p className="text-sm text-on-surface-variant leading-6">
            Upload your existing roster PDF and let our AI agents optimise your scheduling.
          </p>
        </div>

        <div
          className={`mb-4 p-3 rounded-lg text-center border ${
            backendStatus === 'connected'
              ? 'bg-secondary/10 text-secondary border-secondary/20'
              : backendStatus === 'error'
              ? 'bg-error/10 text-error border-error/20'
              : 'bg-surface-container-low text-on-surface-variant border-outline-variant'
          }`}
        >
          <p className="text-xs">
            {backendStatus === 'checking'
              ? 'Checking backend connection...'
              : backendStatus === 'connected'
              ? 'Backend connected - all agents ready'
              : 'Backend disconnected - start uvicorn on port 8000'}
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-lg border border-error/20 bg-error/10 flex items-center gap-2">
            <AlertCircle size={15} className="text-error shrink-0" />
            <p className="text-sm text-error">{error}</p>
          </div>
        )}

        {success && (
          <div className="mb-4 p-3 rounded-lg border border-secondary/20 bg-secondary/10">
            <p className="text-sm text-secondary">{success}</p>
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,application/pdf"
          onChange={handleInputChange}
          style={{ display: 'none' }}
        />

        <div
          className={`mb-6 h-[190px] w-full flex flex-col items-center justify-center cursor-pointer rounded-xl border-2 transition-all ${
            extractedNurses
              ? 'bg-secondary/5 border-secondary/40'
              : isDragging
              ? 'bg-surface-container-low border-secondary/50'
              : 'bg-surface-container-lowest border-dashed border-outline-variant'
          }`}
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <Upload size={28} className={`mb-2 ${extractedNurses ? 'text-secondary' : 'text-on-surface-variant'}`} />
          <p className="text-sm text-on-surface mb-1">{file ? file.name : 'Drop your PDF here'}</p>
          <p className="text-xs text-on-surface-variant">{file ? 'Click to change file' : 'Supports scanned and digital PDFs'}</p>
        </div>

        <div className="flex flex-wrap gap-2 mb-6">
          {[
            {
              key: 'ocr' as const,
              icon:
                badgeStates.ocr === 'loading' ? (
                  <Loader2 size={13} className="animate-spin" />
                ) : badgeStates.ocr === 'error' ? (
                  <AlertCircle size={13} />
                ) : (
                  <FileText size={13} />
                ),
              label:
                badgeStates.ocr === 'done'
                  ? 'OCR Extraction Done'
                  : badgeStates.ocr === 'error'
                  ? 'OCR Failed'
                  : 'OCR Extraction',
            },
            {
              key: 'scheduling' as const,
              icon: badgeStates.scheduling === 'loading' ? <Loader2 size={13} className="animate-spin" /> : <Brain size={13} />,
              label: badgeStates.scheduling === 'done' ? 'AI Scheduling Done' : 'AI Scheduling',
            },
            {
              key: 'compliance' as const,
              icon: badgeStates.compliance === 'loading' ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle size={13} />,
              label: badgeStates.compliance === 'done' ? 'Compliance Check Done' : 'Compliance Check',
            },
          ].map(({ key, icon, label }) => (
            <div key={key} className="flex items-center gap-2 px-3 py-2 rounded-lg border bg-surface-container-lowest border-outline-variant">
              <span className={badgeTone(badgeStates[key])}>{icon}</span>
              <span className={`text-xs ${badgeTone(badgeStates[key])}`}>{label}</span>
            </div>
          ))}
        </div>

        <button
          onClick={handleGenerate}
          disabled={isUploading || isGenerating || backendStatus !== 'connected'}
          className="w-full h-12 flex items-center justify-center gap-2 rounded-lg text-sm font-semibold tracking-wide transition-all border bg-primary text-on-primary border-primary enabled:hover:opacity-95 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isGenerating ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              Generating...
            </>
          ) : isUploading ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              Extracting...
            </>
          ) : (
            'GENERATE SCHEDULE'
          )}
        </button>

        <p className="text-center mt-6 text-xs text-on-surface-variant">Your data never leaves the hospital system</p>
      </div>
    </div>
  );
}
