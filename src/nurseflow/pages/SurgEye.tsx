import { useEffect, useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  AlertTriangle, Camera, CheckCircle, XCircle, Clock, FileText, Loader2,
  Play, Square, ScanLine, AlertOctagon, User, Activity,
  LayoutDashboard, Users, Calendar, Settings, HelpCircle, Search, Bell, Grid,
  ChevronRight, Droplets, Menu, Microscope
} from 'lucide-react';

interface TimelineEvent {
  time: string;
  instrument: string;
  action: string;
  confidence?: number;
}

interface Session {
  session_id: string;
  nurse: string;
  started_at: string;
  duration: string;
  active: boolean;
}

interface BaselineData {
  baseline: Record<string, number>;
  screenshot: string;
  timestamp: string;
}

interface PostopResult {
  passed: boolean;
  baseline: Record<string, number>;
  final: Record<string, number>;
  missing: Record<string, number>;
  extra: Record<string, number>;
  summary: string;
  postop_image: string;
  investigation?: {
    investigation_id: string;
    flagged_nurse: string;
    message: string;
  };
}

interface Investigation {
  id: string;
  nurse_id: string;
  nurse_name: string;
  surgery_id: string;
  missing_items: Record<string, number>;
  status: string;
  created_at: string;
}

const SidebarItem = ({ icon: Icon, label, active = false, href = "#" }: { icon: any, label: string, active?: boolean, href?: string }) => (
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

export default function SurgEyePage() {
  const [isSidebarOpen, setSidebarOpen] = useState(true);

  // Camera/WebSocket state
  const [frame, setFrame] = useState('');
  const [connected, setConnected] = useState(false);
  const [wsStatus, setWsStatus] = useState<'connecting' | 'connected' | 'reconnecting' | 'offline'>('connecting');
  
  // Session state
  const [session, setSession] = useState<Session | null>(null);
  const [sessionDuration, setSessionDuration] = useState('00:00:00');
  
  // Baseline state
  const [baseline, setBaseline] = useState<BaselineData | null>(null);
  const [isScanningBaseline, setIsScanningBaseline] = useState(false);
  const [liveCounts, setLiveCounts] = useState<Record<string, number>>({});
  
  // Post-op state
  const [postopResult, setPostopResult] = useState<PostopResult | null>(null);
  const [isScanningPostop, setIsScanningPostop] = useState(false);
  
  // Investigation state
  const [investigations, setInvestigations] = useState<Investigation[]>([]);
  const [showInvestigationModal, setShowInvestigationModal] = useState(false);
  const [selectedInvestigation, setSelectedInvestigation] = useState<Investigation | null>(null);
  
  // Timeline
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const durationIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Connect to WebSocket with auto-reconnect
  useEffect(() => {
    const connect = () => {
      console.log('[WS] Connecting...');
      setWsStatus('connecting');
      
      wsRef.current = new WebSocket('ws://localhost:8005/ws');
      
      wsRef.current.onopen = () => {
        console.log('[WS] Connected!');
        setWsStatus('connected');
        setConnected(true);
      };
      
      wsRef.current.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          if (data.error) {
            console.error('[WS] Error:', data.error);
            return;
          }
          
          setFrame(data.frame);
          setLiveCounts(data.counts || {});
          
          if (data.baseline) {
            setBaseline({
              baseline: data.baseline,
              screenshot: data.baseline_image || '',
              timestamp: data.baseline_timestamp
            });
          }
          
          if (data.session) {
            setSession(data.session);
          }
          
          // Handle investigation trigger
          if (data.investigation_id) {
            fetchInvestigations();
          }
        } catch (e) {
          console.error('[WS] Parse error:', e);
        }
      };
      
      wsRef.current.onclose = () => {
        console.log('[WS] Disconnected, retrying in 2s...');
        setWsStatus('reconnecting');
        setConnected(false);
        reconnectTimerRef.current = setTimeout(connect, 2000);
      };
      
      wsRef.current.onerror = () => {
        wsRef.current?.close();
      };
    };
    
    connect();
    
    return () => {
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      wsRef.current?.close();
    };
  }, []);

  // Update session duration
  useEffect(() => {
    if (session?.active) {
      const updateDuration = () => {
        const started = new Date(session.started_at);
        const now = new Date();
        const diff = now.getTime() - started.getTime();
        const hours = Math.floor(diff / 3600000);
        const mins = Math.floor((diff % 3600000) / 60000);
        const secs = Math.floor((diff % 60000) / 1000);
        setSessionDuration(`${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`);
      };
      
      updateDuration();
      durationIntervalRef.current = setInterval(updateDuration, 1000);
      
      return () => {
        if (durationIntervalRef.current) clearInterval(durationIntervalRef.current);
      };
    }
  }, [session]);

  // Fetch current session on mount
  useEffect(() => {
    fetchSession();
    fetchInvestigations();
  }, []);

  // Fetch timeline periodically
  useEffect(() => {
    const fetchTimeline = async () => {
      try {
        const response = await fetch('http://localhost:8005/timeline');
        const data = await response.json();
        setTimeline(data.timeline || []);
      } catch (error) {
        console.error('Error fetching timeline:', error);
      }
    };

    if (session?.active) {
      fetchTimeline();
      const interval = setInterval(fetchTimeline, 2000);
      return () => clearInterval(interval);
    }
  }, [session?.active]);

  // DEMO: Fake baseline for presentation
  const demoSetBaseline = useCallback(async () => {
    if (!session) {
      alert('Please start a session first');
      return;
    }
    
    try {
      const response = await fetch('http://localhost:8005/api/demo/baseline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await response.json();
      
      if (data.status === 'baseline locked') {
        setBaseline({
          baseline: data.baseline,
          screenshot: '',
          timestamp: data.timestamp
        });
      }
    } catch (error) {
      console.error('Error setting demo baseline:', error);
    }
  }, [session]);

  // DEMO: Fake post-op PASS for presentation
  const demoPostopPass = useCallback(async () => {
    if (!session) {
      alert('No active session');
      return;
    }
    
    try {
      const response = await fetch('http://localhost:8005/api/demo/postop?passed=true', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await response.json();
      setPostopResult(data);
    } catch (error) {
      console.error('Error performing demo post-op:', error);
    }
  }, [session]);

  // DEMO: Fake post-op FAIL for presentation
  const demoPostopFail = useCallback(async () => {
    if (!session) {
      alert('No active session');
      return;
    }
    
    try {
      const response = await fetch('http://localhost:8005/api/demo/postop?passed=false', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await response.json();
      setPostopResult(data);
      if (data.investigation) {
        fetchInvestigations();
      }
    } catch (error) {
      console.error('Error performing demo post-op:', error);
    }
  }, [session]);

  const fetchSession = async () => {
    try {
      const response = await fetch('http://localhost:8005/api/session/current');
      const data = await response.json();
      if (data.active) {
        setSession(data);
      }
    } catch (error) {
      console.error('Error fetching session:', error);
    }
  };

  const fetchInvestigations = useCallback(async () => {
    try {
      const response = await fetch('http://localhost:8005/api/investigations');
      const data = await response.json();
      setInvestigations(data.investigations || []);
    } catch (error) {
      console.error('Error fetching investigations:', error);
    }
  }, []);

  // Start session
  const startSession = async () => {
    try {
      const response = await fetch('http://localhost:8005/api/session/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await response.json();
      setSession(data);
      setBaseline(null);
      setPostopResult(null);
    } catch (error) {
      console.error('Error starting session:', error);
      alert('❌ Failed to start session');
    }
  };

  // End session
  const endSession = async () => {
    try {
      await fetch('http://localhost:8005/api/session/end', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      setSession(null);
      setBaseline(null);
      setPostopResult(null);
    } catch (error) {
      console.error('Error ending session:', error);
    }
  };

  // Set baseline (pre-op scan)
  const scanBaseline = useCallback(async () => {
    if (!session) {
      alert('Please start a session first');
      return;
    }
    
    setIsScanningBaseline(true);
    try {
      const response = await fetch('http://localhost:8005/api/baseline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await response.json();
      
      if (data.status === 'baseline locked') {
        setBaseline({
          baseline: data.baseline,
          screenshot: data.screenshot,
          timestamp: data.timestamp
        });
      } else {
        alert('⚠️ ' + data.message);
      }
    } catch (error) {
      console.error('Error setting baseline:', error);
      alert('❌ Failed to set baseline');
    } finally {
      setIsScanningBaseline(false);
    }
  }, [session]);

  // Post-op check
  const scanPostop = useCallback(async () => {
    if (!session) {
      alert('No active session');
      return;
    }
    
    if (!baseline) {
      alert('Please set baseline first');
      return;
    }
    
    setIsScanningPostop(true);
    try {
      const response = await fetch('http://localhost:8005/api/postop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await response.json();
      
      if (data.error) {
        alert('⚠️ ' + data.error);
      } else {
        setPostopResult(data);
        if (data.investigation) {
          fetchInvestigations();
        }
      }
    } catch (error) {
      console.error('Error performing post-op check:', error);
      alert('❌ Failed to perform check');
    } finally {
      setIsScanningPostop(false);
    }
  }, [session, baseline, fetchInvestigations]);

  // Get count color based on baseline comparison
  const getCountColor = (instrument: string, count: number) => {
    if (!baseline) return 'text-on-surface';
    const expected = baseline.baseline[instrument] || 0;
    if (count === expected) return 'text-secondary';
    if (count < expected) return 'text-on-surface';
    return 'text-error';
  };

  const getCountBgColor = (instrument: string, count: number) => {
    if (!baseline) return 'bg-surface-container-low border-outline-variant';
    const expected = baseline.baseline[instrument] || 0;
    if (count === expected) return 'bg-secondary/10 border-secondary/30';
    if (count < expected) return 'bg-surface-container-low border-outline-variant';
    return 'bg-error/10 border-error/30';
  };

  return (
    <div className="flex h-screen bg-surface overflow-hidden font-sans">
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.nav
            initial={{ x: -256 }}
            animate={{ x: 0 }}
            exit={{ x: -256 }}
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

            <div className="flex-1 space-y-1 overflow-y-auto custom-scrollbar">
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

      <div className="flex-1 flex flex-col min-w-0 relative">
        <header className="flex justify-between items-center px-6 lg:px-container-margin w-full bg-surface-container-lowest/80 backdrop-blur-md h-16 shadow-[0_1px_10px_0_rgba(0,0,0,0.02)] z-30 sticky top-0 border-b border-outline-variant">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setSidebarOpen(!isSidebarOpen)}
              className="p-2 text-on-surface-variant hover:text-primary transition-colors rounded-full hover:bg-surface-container-low"
            >
              <Menu size={20} />
            </button>
            <div className="hidden sm:flex items-center gap-2 text-sm text-on-surface-variant">
              <span>SafeFlow OS</span>
              <ChevronRight size={14} />
              <span className="text-on-surface font-medium">SurgEye Analysis</span>
            </div>
          </div>

          <div className="flex-1 max-w-md mx-8 hidden lg:block">
            <div className="relative group">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-on-surface-variant group-focus-within:text-secondary transition-colors" size={18} />
              <input 
                className="w-full bg-surface-container-low border border-outline-variant rounded-full py-2 pl-11 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-secondary/10 focus:border-secondary/30 transition-all placeholder:text-on-surface-variant"
                placeholder="Search procedures, nurses, or instruments..."
                type="text"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button className="p-2.5 text-on-surface-variant hover:text-secondary transition-colors rounded-full hover:bg-surface-container-low relative">
              <Bell size={20} />
              <span className="absolute top-2.5 right-2.5 w-2 h-2 bg-error rounded-full ring-2 ring-white"></span>
            </button>
            <button className="p-2.5 text-on-surface-variant hover:text-secondary transition-colors rounded-full hover:bg-surface-container-low">
              <Grid size={20} />
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-6 md:p-8 lg:p-container-margin pb-24">
          <div className="max-w-[1500px] mx-auto">
            <motion.section
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-8 flex flex-col xl:flex-row xl:items-end justify-between gap-6"
            >
              <div>
                <p className="text-[11px] font-bold text-on-surface-variant uppercase tracking-widest mb-2">Surgical Safety</p>
                <h2 className="text-4xl md:text-5xl font-semibold text-on-surface tracking-tight">SurgEye Analysis</h2>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2 px-4 py-2.5 bg-surface-container-lowest border border-outline-variant rounded-full">
                  <div className={`w-2.5 h-2.5 rounded-full ${session?.active ? 'bg-secondary animate-pulse' : 'bg-outline'}`} />
                  <span className="text-sm font-medium text-on-surface">
                    {session?.active ? 'Active Session' : 'No Active Session'}
                  </span>
                </div>
                {session?.active && (
                  <>
                    <div className="flex items-center gap-2 px-4 py-2.5 bg-surface-container-lowest border border-outline-variant rounded-full text-sm text-on-surface-variant">
                      <User size={16} />
                      <span>{session.nurse}</span>
                    </div>
                    <div className="flex items-center gap-2 px-4 py-2.5 bg-surface-container-lowest border border-outline-variant rounded-full text-sm text-on-surface-variant">
                      <Clock size={16} />
                      <span>{sessionDuration}</span>
                    </div>
                  </>
                )}
              </div>
            </motion.section>
            <div className="mb-8 bg-surface-container-lowest border border-outline-variant rounded-2xl p-4 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3 text-sm text-on-surface-variant">
                  <div className={`w-2 h-2 rounded-full ${connected ? 'bg-secondary' : 'bg-error'}`} />
                  <span>{connected ? 'Live camera stream connected' : `Camera stream ${wsStatus}`}</span>
                </div>
                <div className="flex flex-wrap items-center gap-3">
            {!session?.active ? (
              <button
                onClick={startSession}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-on-primary rounded-full text-sm font-medium shadow-sm"
              >
                <Play size={18} />
                Start Session
              </button>
            ) : (
              <button
                onClick={endSession}
                className="flex items-center gap-2 px-4 py-2 bg-error text-white rounded-full text-sm font-medium shadow-sm"
              >
                <Square size={18} />
                End Session
              </button>
            )}
            {/* DEMO Buttons for Presentation */}
            {session?.active && (
              <>
                <button
                  onClick={demoSetBaseline}
                  className="flex items-center gap-2 px-3 py-2 bg-surface-container-low text-on-surface rounded-full hover:bg-surface-container transition-colors text-sm"
                  title="DEMO: Fake baseline without camera"
                >
                  DEMO Baseline
                </button>
                {baseline && (
                  <>
                    <button
                      onClick={demoPostopPass}
                      className="flex items-center gap-2 px-3 py-2 bg-secondary/10 text-secondary rounded-full hover:bg-secondary/15 transition-colors text-sm"
                      title="DEMO: Fake PASS result"
                    >
                      DEMO Pass
                    </button>
                    <button
                      onClick={demoPostopFail}
                      className="flex items-center gap-2 px-3 py-2 bg-error/10 text-error rounded-full hover:bg-error/15 transition-colors text-sm"
                      title="DEMO: Fake FAIL result"
                    >
                      DEMO Fail
                    </button>
                  </>
                )}
              </>
            )}
                </div>
              </div>
            </div>
      
      <div className="grid grid-cols-1 xl:grid-cols-[320px_minmax(0,1fr)_320px] gap-6">
        {/* Left Panel - Pre-op & Post-op */}
        <div className="flex flex-col gap-6">
          {/* Pre-op Section */}
          <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant p-5 shadow-sm">
            <h3 className="text-sm font-semibold text-on-surface mb-4 flex items-center gap-2">
              <ScanLine size={20} className="text-secondary" />
              Pre-Op Baseline
            </h3>
            
            {!baseline ? (
              <div className="text-center py-6">
                <p className="text-on-surface-variant mb-4 text-sm">Scan instruments before procedure</p>
                <button
                  onClick={scanBaseline}
                  disabled={isScanningBaseline || !session?.active}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-primary text-on-primary rounded-full hover:bg-primary-container transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
                >
                  {isScanningBaseline ? (
                    <>
                      <Loader2 size={18} className="animate-spin" />
                      Scanning... 3s
                    </>
                  ) : (
                    <>
                      <Camera size={18} />
                      Scan Baseline
                    </>
                  )}
                </button>
                {!session?.active && (
                  <p className="text-sm text-on-surface-variant mt-2">Start session first</p>
                )}
              </div>
            ) : (
              <div>
                <div className="flex items-center gap-2 mb-3 text-secondary">
                  <CheckCircle size={18} />
                  <span className="font-medium">Baseline Locked</span>
                </div>
                
                {baseline.screenshot && (
                  <img 
                    src={`data:image/jpeg;base64,${baseline.screenshot}`}
                    alt="Baseline"
                    className="w-full h-32 object-cover rounded-xl mb-3"
                  />
                )}
                
                <div className="space-y-2">
                  {Object.entries(baseline.baseline).map(([instrument, count]) => (
                    <div key={instrument} className="flex items-center justify-between">
                      <span className="text-on-surface-variant text-sm">{instrument}</span>
                      <div className="flex items-center gap-2">
                        <div className="w-20 h-2 bg-surface-container rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-secondary"
                            style={{ width: `${Math.min(count * 20, 100)}%` }}
                          />
                        </div>
                        <span className="text-secondary font-mono w-6 text-right">{count}</span>
                      </div>
                    </div>
                  ))}
                </div>
                
                <p className="text-xs text-on-surface-variant mt-3">
                  Set: {new Date(baseline.timestamp).toLocaleTimeString()}
                </p>
              </div>
            )}
          </div>
          
          {/* Post-op Section */}
          <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant p-5 shadow-sm">
            <h3 className="text-sm font-semibold text-on-surface mb-4 flex items-center gap-2">
              <CheckCircle size={20} className="text-secondary" />
              Post-Op Check
            </h3>
            
            {!postopResult ? (
              <div className="text-center py-6">
                <p className="text-on-surface-variant mb-4 text-sm">Verify instruments after procedure</p>
                <button
                  onClick={scanPostop}
                  disabled={isScanningPostop || !baseline}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-secondary text-on-secondary rounded-full hover:bg-secondary-container transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
                >
                  {isScanningPostop ? (
                    <>
                      <Loader2 size={18} className="animate-spin" />
                      Scanning... 3s
                    </>
                  ) : (
                    <>
                      <ScanLine size={18} />
                      End & Verify
                    </>
                  )}
                </button>
                {!baseline && (
                  <p className="text-sm text-on-surface-variant mt-2">Set baseline first</p>
                )}
              </div>
            ) : (
              <div>
                <div className={`flex items-center gap-2 mb-3 ${postopResult.passed ? 'text-secondary' : 'text-error'}`}>
                  {postopResult.passed ? <CheckCircle size={18} /> : <XCircle size={18} />}
                  <span className="font-medium">
                    {postopResult.passed ? 'PASS - All Accounted' : 'FAIL - Items Missing'}
                  </span>
                </div>
                
                {postopResult.postop_image && (
                  <img 
                    src={`data:image/jpeg;base64,${postopResult.postop_image}`}
                    alt="Post-op"
                    className="w-full h-32 object-cover rounded-xl mb-3"
                  />
                )}
                
                <div className="space-y-2 text-sm">
                  {Object.entries(postopResult.baseline).map(([instrument, expected]) => {
                    const actual = postopResult.final[instrument] || 0;
                    const status = actual === expected ? '✅' : actual < expected ? '❌' : '⚠️';
                    return (
                      <div key={instrument} className="flex items-center justify-between">
                        <span className="text-on-surface-variant">{instrument}</span>
                        <span className={actual === expected ? 'text-secondary' : 'text-error'}>
                          {expected} → {actual} {status}
                        </span>
                      </div>
                    );
                  })}
                </div>
                
                {!postopResult.passed && postopResult.investigation && (
                  <div className="mt-3 p-3 bg-error/5 border border-error/20 rounded-xl">
                    <p className="text-error text-sm">
                      <AlertOctagon size={14} className="inline mr-1" />
                      Investigation Opened
                    </p>
                    <p className="text-on-surface-variant text-xs mt-1">
                      {postopResult.investigation.flagged_nurse} has been flagged
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
          
          {/* Timeline */}
          <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant p-5 flex-1 shadow-sm">
            <h3 className="text-sm font-semibold text-on-surface mb-3 flex items-center gap-2">
              <Activity size={20} className="text-secondary" />
              Timeline
            </h3>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {timeline.length === 0 ? (
                <p className="text-on-surface-variant text-sm">No events yet</p>
              ) : (
                timeline.slice(-10).reverse().map((event, idx) => (
                  <div key={idx} className="text-sm border-l-2 border-outline-variant pl-3 py-1">
                    <span className="text-on-surface-variant text-xs">{event.time}</span>
                    <p className="text-on-surface">
                      {event.instrument} - {event.action}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
        
        {/* Center - Live Video */}
        <div className="flex-1 flex flex-col">
          <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant p-5 flex-1 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-on-surface flex items-center gap-2">
                <Camera size={20} className="text-secondary" />
                Live Monitor
              </h3>
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${connected ? 'bg-secondary' : 'bg-error'}`} />
                <span className="text-sm text-on-surface-variant">
                  {connected ? 'Live' : 'Disconnected'}
                </span>
              </div>
            </div>
            
            <div className="relative bg-inverse-surface rounded-xl overflow-hidden" style={{ height: '480px' }}>
              {frame ? (
                <img 
                  src={`data:image/jpeg;base64,${frame}`}
                  alt="Surgery Feed"
                  className="w-full h-full object-contain"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-inverse-on-surface/70">
                  <div className="text-center">
                    <Camera size={48} className="mx-auto mb-2 opacity-50" />
                    <p>Waiting for camera...</p>
                  </div>
                </div>
              )}
            </div>
          </div>
          
          {/* Live Counts */}
          <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant p-5 mt-6 shadow-sm">
            <h3 className="text-sm font-semibold text-on-surface mb-3">Live Instrument Counts</h3>
            {Object.keys(liveCounts).length === 0 ? (
              <p className="text-on-surface-variant">No instruments detected</p>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-5 gap-3">
                {Object.entries(liveCounts).map(([instrument, count]) => (
                  <div 
                    key={instrument}
                    className={`p-3 rounded-xl border ${getCountBgColor(instrument, count)}`}
                  >
                    <p className="text-xs text-on-surface-variant">{instrument}</p>
                    <p className={`text-2xl font-bold ${getCountColor(instrument, count)}`}>
                      {count}
                    </p>
                    {baseline && (
                      <p className="text-xs text-on-surface-variant">
                        expected: {baseline.baseline[instrument] || 0}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        
        {/* Right Panel - Investigations */}
        <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-on-surface mb-4 flex items-center gap-2">
            <AlertTriangle size={20} className="text-error" />
            Investigations
          </h3>
          
          {investigations.length === 0 ? (
            <p className="text-on-surface-variant text-center py-8">No investigations</p>
          ) : (
            <div className="space-y-3">
              {investigations.map((inv) => (
                <div 
                  key={inv.id}
                  className="p-3 bg-surface-container-low rounded-xl border border-outline-variant cursor-pointer hover:bg-surface-container transition-colors"
                  onClick={() => {
                    setSelectedInvestigation(inv);
                    setShowInvestigationModal(true);
                  }}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-on-surface-variant">{inv.id}</span>
                    <span className={`text-xs px-2 py-1 rounded ${
                      inv.status === 'under_investigation' 
                        ? 'bg-error/10 text-error' 
                        : 'bg-secondary/10 text-secondary'
                    }`}>
                      {inv.status}
                    </span>
                  </div>
                  <p className="text-sm text-on-surface">{inv.nurse_name}</p>
                  <p className="text-xs text-on-surface-variant">
                    {Object.entries(inv.missing_items).map(([k, v]) => `${v}x ${k}`).join(', ')}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
          </div>
        </main>
      </div>
      
      {/* Investigation Modal */}
      {showInvestigationModal && selectedInvestigation && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant p-6 max-w-lg w-full mx-4 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-semibold text-on-surface">Investigation Details</h3>
              <button 
                onClick={() => setShowInvestigationModal(false)}
                className="text-on-surface-variant hover:text-on-surface"
              >
                <XCircle size={24} />
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <p className="text-on-surface-variant text-sm">Investigation ID</p>
                <p className="text-on-surface">{selectedInvestigation.id}</p>
              </div>
              
              <div>
                <p className="text-on-surface-variant text-sm">Nurse</p>
                <p className="text-on-surface">{selectedInvestigation.nurse_name}</p>
              </div>
              
              <div>
                <p className="text-on-surface-variant text-sm">Missing Items</p>
                <div className="flex flex-wrap gap-2 mt-1">
                  {Object.entries(selectedInvestigation.missing_items).map(([item, count]) => (
                    <span key={item} className="px-2 py-1 bg-error/10 text-error rounded text-sm">
                      {count}x {item}
                    </span>
                  ))}
                </div>
              </div>
              
              <div>
                <p className="text-on-surface-variant text-sm">Created</p>
                <p className="text-on-surface">
                  {new Date(selectedInvestigation.created_at).toLocaleString()}
                </p>
              </div>
            </div>
            
            <button
              onClick={() => setShowInvestigationModal(false)}
              className="w-full mt-6 px-4 py-2 bg-primary text-on-primary rounded-full hover:bg-primary-container transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
