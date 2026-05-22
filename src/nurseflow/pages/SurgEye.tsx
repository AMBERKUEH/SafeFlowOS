import { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  AlertTriangle, CheckCircle, XCircle, FileText,
  ScanLine, AlertOctagon, User, Activity,
  LayoutDashboard, Users, Calendar, Settings, HelpCircle,
  Search, Bell, Grid, ChevronRight, Droplets, Menu,
  Microscope, Upload, ImageIcon, Camera, CameraOff
} from 'lucide-react';

const MAIN_API = 'http://localhost:8000';
const SURGERY_ID = 'S001';
const SCAN_LOADING_MS = 3500;

function wait(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

type ScanMode = 'upload' | 'camera';

interface BaselineResult {
  surgery_id: string;
  scan_type: string;
  detected_items: Record<string, number>;
  source: string;
  status: string;
}

interface PostopResult {
  surgery_id: string;
  scan_type: string;
  detected_items: Record<string, number>;
  missing_items: Record<string, number>;
  passed: boolean;
  status: string;
  risk: string;
  human_review_required: boolean;
  timestamp: string;
}

const SidebarItem = ({
  icon: Icon, label, active = false, href = '#'
}: {
  icon: any; label: string; active?: boolean; href?: string;
}) => (
  <motion.a
    href={href}
    whileHover={{ scale: 0.98 }}
    whileTap={{ scale: 0.95 }}
    className={`flex items-center gap-4 px-4 py-2.5 rounded-lg transition-colors group ${
      active
        ? 'bg-surface-container-high text-on-surface'
        : 'text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface'
    }`}
  >
    <Icon size={20} className={active ? 'text-secondary' : 'group-hover:text-secondary transition-colors'} />
    <span className={`text-[15px] ${active ? 'font-medium' : 'font-normal'}`}>{label}</span>
  </motion.a>
);

function ImageUploadBox({
  label, preview, onFileSelect, disabled,
}: {
  label: string; preview: string | null; onFileSelect: (file: File) => void; disabled?: boolean;
}) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onFileSelect(file);
  };
  return (
    <label className={`block w-full cursor-pointer ${disabled ? 'opacity-50 pointer-events-none' : ''}`}>
      <div className="border-2 border-dashed border-outline-variant rounded-xl overflow-hidden hover:border-secondary transition-colors">
        {preview ? (
          <img src={preview} alt={label} className="w-full h-40 object-cover" />
        ) : (
          <div className="flex flex-col items-center justify-center h-40 gap-2 text-on-surface-variant">
            <ImageIcon size={32} className="opacity-40" />
            <span className="text-sm">{label}</span>
            <span className="text-xs opacity-60">Click to upload</span>
          </div>
        )}
      </div>
      <input type="file" accept="image/*" className="hidden" onChange={handleChange} disabled={disabled} />
    </label>
  );
}

function CameraBox({
  videoRef, captured, disabled, label,
}: {
  videoRef: React.RefObject<HTMLVideoElement>; captured: string | null; disabled?: boolean; label: string;
}) {
  return (
    <div className={`border-2 border-dashed border-secondary/40 rounded-xl overflow-hidden relative ${disabled ? 'opacity-50' : ''}`}>
      {captured ? (
        <img src={captured} alt="Captured" className="w-full h-40 object-cover" />
      ) : (
        <div className="relative w-full h-40 bg-black rounded-xl overflow-hidden">
          <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
          <div className="absolute bottom-2 left-2 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-error animate-pulse" />
            <span className="text-white text-xs font-medium">LIVE</span>
          </div>
          <div className="absolute top-2 right-2 text-white/60 text-xs">{label}</div>
        </div>
      )}
    </div>
  );
}

export default function SurgEyePage() {
  const [isSidebarOpen, setSidebarOpen] = useState(true);
  const [scanMode, setScanMode] = useState<ScanMode>('upload');

  // Upload mode state
  const [baselineFile, setBaselineFile] = useState<File | null>(null);
  const [baselinePreview, setBaselinePreview] = useState<string | null>(null);
  const [postopFile, setPostopFile] = useState<File | null>(null);
  const [postopPreview, setPostopPreview] = useState<string | null>(null);

  // Camera mode state
  const baselineVideoRef = useRef<HTMLVideoElement>(null);
  const postopVideoRef = useRef<HTMLVideoElement>(null);
  const baselineCanvasRef = useRef<HTMLCanvasElement>(null);
  const postopCanvasRef = useRef<HTMLCanvasElement>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [baselineCaptured, setBaselineCaptured] = useState<string | null>(null);
  const [postopCaptured, setPostopCaptured] = useState<string | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Results
  const [baselineResult, setBaselineResult] = useState<BaselineResult | null>(null);
  const [postopResult, setPostopResult] = useState<PostopResult | null>(null);

  // Loading
  const [scanningBaseline, setScanningBaseline] = useState(false);
  const [scanningPostop, setScanningPostop] = useState(false);

  // Audit log
  const [auditLog, setAuditLog] = useState<{
    time: string; message: string; type: 'info' | 'success' | 'danger' | 'warning';
  }[]>([]);

  function addLog(message: string, type: 'info' | 'success' | 'danger' | 'warning' = 'info') {
    const time = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    setAuditLog(prev => [...prev, { time, message, type }]);
  }

  // Camera helpers
  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      streamRef.current = stream;
      if (baselineVideoRef.current) baselineVideoRef.current.srcObject = stream;
      if (postopVideoRef.current) postopVideoRef.current.srcObject = stream;
      setCameraActive(true);
      addLog('Camera connected — ready to scan', 'info');
    } catch (e) {
      addLog('Camera access denied or unavailable', 'danger');
    }
  }, []);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    setCameraActive(false);
    setBaselineCaptured(null);
    setPostopCaptured(null);
  }, []);

  function captureFrame(
    videoRef: React.RefObject<HTMLVideoElement>,
    canvasRef: React.RefObject<HTMLCanvasElement>
  ): File | null {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return null;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d')?.drawImage(video, 0, 0);
    const dataUrl = canvas.toDataURL('image/jpeg');
    const arr = dataUrl.split(',');
    const mime = arr[0].match(/:(.*?);/)![1];
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) u8arr[n] = bstr.charCodeAt(n);
    return new File([u8arr], 'capture.jpg', { type: mime });
  }

  function handleModeToggle(mode: ScanMode) {
    if (mode === scanMode) return;
    setScanMode(mode);
    reset();
    if (mode === 'camera') startCamera();
    else stopCamera();
  }

  function handleBaselineSelect(file: File) {
    setBaselineFile(file);
    setBaselinePreview(URL.createObjectURL(file));
    setBaselineResult(null);
    setPostopResult(null);
    setAuditLog([]);
  }

  function handlePostopSelect(file: File) {
    setPostopFile(file);
    setPostopPreview(URL.createObjectURL(file));
    setPostopResult(null);
  }

  async function runBaselineScan() {
    let file: File | null = null;

    if (scanMode === 'upload') {
      if (!baselineFile) return;
      file = baselineFile;
    } else {
      file = captureFrame(baselineVideoRef, baselineCanvasRef);
      if (!file) return;
      setBaselineCaptured(URL.createObjectURL(file));
    }

    setScanningBaseline(true);
    addLog(`Baseline scan started — ${scanMode === 'camera' ? 'capturing from camera' : 'uploading image'} to SurgEye Agent`, 'info');

    try {
      const formData = new FormData();
      formData.append('surgery_id', SURGERY_ID);
      formData.append('file', file);
      formData.append('source', scanMode);

      await wait(SCAN_LOADING_MS);

      const res = await fetch(`${MAIN_API}/api/surgeye/baseline-scan`, { method: 'POST', body: formData });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: BaselineResult = await res.json();
      setBaselineResult(data);

      if (Object.keys(data.detected_items).length === 0) {
        addLog('Camera scan complete — 0 instruments detected (camera mode)', 'warning');
      } else {
        const detectedStr = Object.entries(data.detected_items).map(([k, v]) => `${v}x ${k}`).join(', ');
        addLog(`Baseline locked — detected: ${detectedStr}`, 'success');
      }
    } catch (e) {
      addLog(`Baseline scan failed — ${e}`, 'danger');
    } finally {
      setScanningBaseline(false);
    }
  }

  async function runPostopScan() {
    if (!baselineResult) return;
    let file: File | null = null;

    if (scanMode === 'upload') {
      if (!postopFile) return;
      file = postopFile;
    } else {
      file = captureFrame(postopVideoRef, postopCanvasRef);
      if (!file) return;
      setPostopCaptured(URL.createObjectURL(file));
    }

    setScanningPostop(true);
    addLog(`Post-op scan started — ${scanMode === 'camera' ? 'capturing from camera' : 'uploading image'} to SurgEye Agent`, 'info');

    try {
      const formData = new FormData();
      formData.append('surgery_id', SURGERY_ID);
      formData.append('baseline_items', JSON.stringify(baselineResult.detected_items));
      formData.append('file', file);
      formData.append('source', scanMode);

      await wait(SCAN_LOADING_MS);

      const res = await fetch(`${MAIN_API}/api/surgeye/postop-scan`, { method: 'POST', body: formData });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: PostopResult = await res.json();
      setPostopResult(data);

      if (!data.passed) {
        const missingStr = Object.entries(data.missing_items).map(([k, v]) => `${v}x ${k}`).join(', ');
        addLog(`ALERT — missing instruments: ${missingStr}`, 'danger');
        addLog('Case requires human sign-off before closing', 'warning');
      } else {
        addLog('Post-op scan clear — all instruments accounted for', 'success');
      }
    } catch (e) {
      addLog(`Post-op scan failed — ${e}`, 'danger');
    } finally {
      setScanningPostop(false);
    }
  }

  function reset() {
    setBaselineFile(null);
    setBaselinePreview(null);
    setPostopFile(null);
    setPostopPreview(null);
    setBaselineResult(null);
    setPostopResult(null);
    setAuditLog([]);
    setBaselineCaptured(null);
    setPostopCaptured(null);
  }

  const canScanBaseline = scanMode === 'upload' ? !!baselineFile && !scanningBaseline : cameraActive && !scanningBaseline;
  const canScanPostop = scanMode === 'upload'
    ? !!postopFile && !!baselineResult && !scanningPostop
    : cameraActive && !!baselineResult && !scanningPostop;

  return (
    <div className="flex h-screen bg-surface overflow-hidden font-sans">
      <canvas ref={baselineCanvasRef} className="hidden" />
      <canvas ref={postopCanvasRef} className="hidden" />

      {/* Sidebar */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.nav
            initial={{ x: -256 }} animate={{ x: 0 }} exit={{ x: -256 }}
            className="fixed md:relative z-40 flex flex-col h-full w-64 bg-surface-container-lowest border-r border-outline-variant py-8 px-4"
          >
            <div className="flex items-center gap-3 mb-10 px-2">
              <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center text-on-primary shadow-sm shadow-primary/10">
                <Droplets size={22} />
              </div>
              <div>
                <h1 className="text-xl font-semibold text-on-surface tracking-tight">SafeFlow OS</h1>
                <p className="text-[11px] uppercase tracking-wider font-bold text-on-surface-variant/70">Healthcare Workspace</p>
              </div>
            </div>
            <div className="flex-1 space-y-1 overflow-y-auto">
              <SidebarItem icon={LayoutDashboard} label="Dashboard" href="/" />
              <SidebarItem icon={Users} label="Patients" href="/patients" />
              <SidebarItem icon={Calendar} label="Nurse Schedule" href="/nurseflow/upload" />
              <SidebarItem icon={Microscope} label="SurgEye Analysis" active href="/nurseflow/surgeye" />
              <SidebarItem icon={FileText} label="Records" />
              <SidebarItem icon={Settings} label="Settings" />
            </div>
            <div className="mt-auto pt-6 border-t border-outline-variant space-y-1">
              <SidebarItem icon={HelpCircle} label="Support" />
              <SidebarItem icon={User} label="Account" />
            </div>
          </motion.nav>
        )}
      </AnimatePresence>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="flex justify-between items-center px-6 w-full bg-surface-container-lowest/80 backdrop-blur-md h-16 z-30 sticky top-0 border-b border-outline-variant">
          <div className="flex items-center gap-4">
            <button onClick={() => setSidebarOpen(!isSidebarOpen)} className="p-2 text-on-surface-variant hover:text-primary transition-colors rounded-full hover:bg-surface-container-low">
              <Menu size={20} />
            </button>
            <div className="hidden sm:flex items-center gap-2 text-sm text-on-surface-variant">
              <span>SafeFlow OS</span>
              <ChevronRight size={14} />
              <span className="text-on-surface font-medium">SurgEye Analysis</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Mode toggle */}
            <div className="flex items-center gap-1 bg-surface-container-low border border-outline-variant rounded-full p-1">
              <button
                onClick={() => handleModeToggle('upload')}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                  scanMode === 'upload' ? 'bg-primary text-on-primary shadow-sm' : 'text-on-surface-variant hover:text-on-surface'
                }`}
              >
                <Upload size={13} /> Upload
              </button>
              <button
                onClick={() => handleModeToggle('camera')}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                  scanMode === 'camera' ? 'bg-primary text-on-primary shadow-sm' : 'text-on-surface-variant hover:text-on-surface'
                }`}
              >
                <Camera size={13} /> Camera
              </button>
            </div>

            <button className="p-2.5 text-on-surface-variant hover:text-secondary transition-colors rounded-full hover:bg-surface-container-low relative">
              <Bell size={20} />
              {postopResult && !postopResult.passed && (
                <span className="absolute top-2.5 right-2.5 w-2 h-2 bg-error rounded-full ring-2 ring-white" />
              )}
            </button>
            <button className="p-2.5 text-on-surface-variant hover:text-secondary transition-colors rounded-full hover:bg-surface-container-low">
              <Grid size={20} />
            </button>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto p-6 md:p-8 pb-24">
          <div className="max-w-[1200px] mx-auto">

            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mb-8 flex items-end justify-between">
              <div>
                <p className="text-[11px] font-bold text-on-surface-variant uppercase tracking-widest mb-2">Surgical Safety</p>
                <h2 className="text-4xl font-semibold text-on-surface tracking-tight">SurgEye Analysis</h2>
                {scanMode === 'camera' && (
                  <p className="text-sm text-on-surface-variant mt-1 flex items-center gap-1.5">
                    <span className={`w-2 h-2 rounded-full ${cameraActive ? 'bg-secondary animate-pulse' : 'bg-outline'}`} />
                    {cameraActive ? 'Camera active' : 'Camera inactive'}
                  </p>
                )}
              </div>
              <button onClick={reset} className="px-4 py-2 rounded-full border border-outline-variant text-sm text-on-surface-variant hover:bg-surface-container-low transition-colors">
                Reset
              </button>
            </motion.div>

            {/* Camera mode banner */}
            {scanMode === 'camera' && (
              <div className="mb-6 p-4 bg-surface-container-low border border-outline-variant rounded-2xl flex items-center justify-between">
                <div className="flex items-center gap-3 text-sm text-on-surface-variant">
                  <Camera size={18} className="text-secondary" />
                  <span>Camera mode — captures a snapshot from your laptop camera when you click Scan</span>
                </div>
                {!cameraActive ? (
                  <button onClick={startCamera} className="flex items-center gap-2 px-3 py-1.5 bg-primary text-on-primary rounded-full text-xs font-medium">
                    <Camera size={13} /> Start Camera
                  </button>
                ) : (
                  <button onClick={stopCamera} className="flex items-center gap-2 px-3 py-1.5 bg-error/10 text-error rounded-full text-xs font-medium">
                    <CameraOff size={13} /> Stop Camera
                  </button>
                )}
              </div>
            )}

            <div className="grid grid-cols-1 xl:grid-cols-[1fr_1fr_360px] gap-6">

              {/* LEFT — Baseline */}
              <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant p-5 shadow-sm flex flex-col gap-4">
                <h3 className="text-sm font-semibold text-on-surface flex items-center gap-2">
                  <ScanLine size={18} className="text-secondary" />
                  Pre-Op Baseline Scan
                </h3>

                {scanMode === 'upload' ? (
                  <ImageUploadBox label="Upload baseline image" preview={baselinePreview} onFileSelect={handleBaselineSelect} disabled={scanningBaseline} />
                ) : (
                  <CameraBox videoRef={baselineVideoRef} captured={baselineCaptured} disabled={!cameraActive} label="Baseline" />
                )}

                <button
                  onClick={runBaselineScan}
                  disabled={!canScanBaseline}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-primary text-on-primary rounded-full text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 transition-opacity"
                >
                  {scanningBaseline ? (
                    <><span className="animate-spin">⟳</span> Scanning...</>
                  ) : scanMode === 'camera' ? (
                    <><Camera size={16} /> Capture & Scan Baseline</>
                  ) : (
                    <><Upload size={16} /> Scan Baseline</>
                  )}
                </button>

                {baselineResult && (
                  <div className="mt-2">
                    <div className="flex items-center gap-2 text-secondary mb-3">
                      <CheckCircle size={16} />
                      <span className="text-sm font-medium">Baseline locked</span>
                    </div>
                    {Object.keys(baselineResult.detected_items).length === 0 ? (
                      <p className="text-sm text-on-surface-variant italic">0 instruments detected (camera mode)</p>
                    ) : (
                      <>
                        <div className="space-y-2">
                          {Object.entries(baselineResult.detected_items).map(([item, count]) => (
                            <div key={item} className="flex items-center justify-between text-sm">
                              <span className="text-on-surface-variant">{item}</span>
                              <span className="text-secondary font-medium">✓ {count}x detected</span>
                            </div>
                          ))}
                        </div>
                        <p className="text-xs text-on-surface-variant mt-3">
                          {Object.values(baselineResult.detected_items).reduce((a, b) => a + b, 0)} instruments recorded
                        </p>
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* CENTER — Post-op */}
              <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant p-5 shadow-sm flex flex-col gap-4">
                <h3 className="text-sm font-semibold text-on-surface flex items-center gap-2">
                  <CheckCircle size={18} className="text-secondary" />
                  Post-Op Verification
                </h3>

                {scanMode === 'upload' ? (
                  <ImageUploadBox label="Upload post-op image" preview={postopPreview} onFileSelect={handlePostopSelect} disabled={!baselineResult || scanningPostop} />
                ) : (
                  <CameraBox videoRef={postopVideoRef} captured={postopCaptured} disabled={!cameraActive || !baselineResult} label="Post-Op" />
                )}

                {!baselineResult && (
                  <p className="text-xs text-on-surface-variant text-center">Complete baseline scan first</p>
                )}

                <button
                  onClick={runPostopScan}
                  disabled={!canScanPostop}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-secondary text-on-secondary rounded-full text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 transition-opacity"
                >
                  {scanningPostop ? (
                    <><span className="animate-spin">⟳</span> Verifying...</>
                  ) : scanMode === 'camera' ? (
                    <><Camera size={16} /> Capture & Verify Post-Op</>
                  ) : (
                    <><ScanLine size={16} /> Verify Post-Op</>
                  )}
                </button>

                {postopResult && (
                  <div className="mt-2">
                    <div className={`flex items-center gap-2 mb-3 ${!postopResult.passed ? 'text-error' : 'text-secondary'}`}>
                      {!postopResult.passed ? <XCircle size={16} /> : <CheckCircle size={16} />}
                      <span className="text-sm font-medium">
                        {!postopResult.passed ? 'FAIL — instruments missing' : 'PASS — all accounted for'}
                      </span>
                    </div>
                    <div className="space-y-2">
                      {Object.entries(baselineResult!.detected_items).map(([item, expectedCount]) => {
                        const actualCount = postopResult.detected_items[item] ?? 0;
                        const found = actualCount >= expectedCount;
                        return (
                          <div key={item} className="flex items-center justify-between text-sm">
                            <span className="text-on-surface-variant">{item}</span>
                            <span className={found ? 'text-secondary' : 'text-error font-medium'}>
                              {found ? `✓ ${actualCount}/${expectedCount}` : `✗ ${actualCount}/${expectedCount} missing`}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                    {!postopResult.passed && (
                      <div className="mt-4 p-3 bg-error/5 border border-error/20 rounded-xl">
                        <p className="text-error text-sm font-medium flex items-center gap-1">
                          <AlertOctagon size={14} />
                          Alert — investigation required
                        </p>
                        <p className="text-on-surface-variant text-xs mt-1">
                          Missing: {Object.entries(postopResult.missing_items).map(([k, v]) => `${v}x ${k}`).join(', ')}
                        </p>
                        <p className="text-on-surface-variant text-xs mt-1">
                          Case must be reviewed before closing.
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* RIGHT — Audit log */}
              <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant p-5 shadow-sm flex flex-col">
                <h3 className="text-sm font-semibold text-on-surface mb-4 flex items-center gap-2">
                  <Activity size={18} className="text-secondary" />
                  Audit log
                </h3>
                {auditLog.length === 0 ? (
                  <p className="text-on-surface-variant text-sm text-center py-8">No events yet — scan to begin</p>
                ) : (
                  <div className="flex-1 space-y-0 overflow-y-auto max-h-[500px]">
                    {auditLog.map((ev, i) => (
                      <div key={i} className="flex gap-3 py-2 border-b border-outline-variant last:border-0">
                        <span className="text-[11px] text-on-surface-variant min-w-[60px] pt-0.5">{ev.time}</span>
                        <span className={`text-[13px] leading-relaxed ${
                          ev.type === 'danger' ? 'text-error'
                          : ev.type === 'warning' ? 'text-on-surface-variant'
                          : ev.type === 'success' ? 'text-secondary'
                          : 'text-on-surface'
                        }`}>
                          {ev.type === 'danger' && <AlertTriangle size={12} className="inline mr-1 mb-0.5" />}
                          {ev.message}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
                {postopResult && (
                  <div className={`mt-4 p-3 rounded-xl border text-sm ${
                    !postopResult.passed
                      ? 'bg-error/5 border-error/20 text-error'
                      : 'bg-secondary/5 border-secondary/20 text-secondary'
                  }`}>
                    <p className="font-medium">
                      {!postopResult.passed ? 'Surgical safety check FAILED' : 'Surgical safety check PASSED'}
                    </p>
                    <p className="text-xs mt-1 opacity-80">Surgery ID: {postopResult.surgery_id}</p>
                  </div>
                )}
              </div>

            </div>
          </div>
        </main>
      </div>
    </div>
  );
}