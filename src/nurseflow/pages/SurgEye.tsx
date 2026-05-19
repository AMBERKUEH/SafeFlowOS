import { useEffect, useState, useRef, useCallback } from 'react';
import { MainNavbar } from '../components/MainNavbar';
import { 
  AlertTriangle, Camera, CheckCircle, XCircle, Clock, FileText, Loader2,
  Play, Square, ScanLine, AlertOctagon, User, Activity, Download
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

export default function SurgEyePage() {
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
    if (!baseline) return 'text-gray-400';
    const expected = baseline.baseline[instrument] || 0;
    if (count === expected) return 'text-green-400';
    if (count < expected) return 'text-yellow-400';
    return 'text-red-400';
  };

  const getCountBgColor = (instrument: string, count: number) => {
    if (!baseline) return 'bg-gray-800';
    const expected = baseline.baseline[instrument] || 0;
    if (count === expected) return 'bg-green-500/20 border-green-500/50';
    if (count < expected) return 'bg-yellow-500/20 border-yellow-500/50';
    return 'bg-red-500/20 border-red-500/50';
  };

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col">
      <div className="relative z-50">
        <MainNavbar />
      </div>
      
      {/* Session Banner */}
      <div className="bg-gray-800 border-b border-gray-700 px-6 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full ${session?.active ? 'bg-green-400 animate-pulse' : 'bg-gray-500'}`} />
              <span className="text-white font-medium">
                {session?.active ? 'Active Session' : 'No Active Session'}
              </span>
            </div>
            {session?.active && (
              <>
                <div className="flex items-center gap-2 text-gray-300">
                  <User size={16} />
                  <span>Nurse: {session.nurse}</span>
                </div>
                <div className="flex items-center gap-2 text-gray-300">
                  <Clock size={16} />
                  <span>Duration: {sessionDuration}</span>
                </div>
              </>
            )}
          </div>
          <div className="flex items-center gap-3">
            {!session?.active ? (
              <button
                onClick={startSession}
                className="flex items-center gap-2 px-4 py-2 bg-green-500/20 text-green-400 rounded-lg hover:bg-green-500/30 transition-colors"
              >
                <Play size={18} />
                Start Session
              </button>
            ) : (
              <button
                onClick={endSession}
                className="flex items-center gap-2 px-4 py-2 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 transition-colors"
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
                  className="flex items-center gap-2 px-3 py-2 bg-purple-500/20 text-purple-400 rounded-lg hover:bg-purple-500/30 transition-colors text-sm"
                  title="DEMO: Fake baseline without camera"
                >
                  DEMO Baseline
                </button>
                {baseline && (
                  <>
                    <button
                      onClick={demoPostopPass}
                      className="flex items-center gap-2 px-3 py-2 bg-blue-500/20 text-blue-400 rounded-lg hover:bg-blue-500/30 transition-colors text-sm"
                      title="DEMO: Fake PASS result"
                    >
                      DEMO Pass
                    </button>
                    <button
                      onClick={demoPostopFail}
                      className="flex items-center gap-2 px-3 py-2 bg-orange-500/20 text-orange-400 rounded-lg hover:bg-orange-500/30 transition-colors text-sm"
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
      
      <div className="flex-1 flex p-4 gap-4">
        {/* Left Panel - Pre-op & Post-op */}
        <div className="w-80 flex flex-col gap-4">
          {/* Pre-op Section */}
          <div className="bg-gray-800 rounded-xl border border-gray-700 p-4">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <ScanLine size={20} className="text-cyan-400" />
              Pre-Op Baseline
            </h3>
            
            {!baseline ? (
              <div className="text-center py-6">
                <p className="text-gray-400 mb-4">Scan instruments before procedure</p>
                <button
                  onClick={scanBaseline}
                  disabled={isScanningBaseline || !session?.active}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-cyan-500/20 text-cyan-400 rounded-lg hover:bg-cyan-500/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
                  <p className="text-sm text-gray-500 mt-2">Start session first</p>
                )}
              </div>
            ) : (
              <div>
                <div className="flex items-center gap-2 mb-3 text-green-400">
                  <CheckCircle size={18} />
                  <span className="font-medium">Baseline Locked</span>
                </div>
                
                {baseline.screenshot && (
                  <img 
                    src={`data:image/jpeg;base64,${baseline.screenshot}`}
                    alt="Baseline"
                    className="w-full h-32 object-cover rounded-lg mb-3"
                  />
                )}
                
                <div className="space-y-2">
                  {Object.entries(baseline.baseline).map(([instrument, count]) => (
                    <div key={instrument} className="flex items-center justify-between">
                      <span className="text-gray-300">{instrument}</span>
                      <div className="flex items-center gap-2">
                        <div className="w-20 h-2 bg-gray-700 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-cyan-400"
                            style={{ width: `${Math.min(count * 20, 100)}%` }}
                          />
                        </div>
                        <span className="text-cyan-400 font-mono w-6 text-right">{count}</span>
                      </div>
                    </div>
                  ))}
                </div>
                
                <p className="text-xs text-gray-500 mt-3">
                  Set: {new Date(baseline.timestamp).toLocaleTimeString()}
                </p>
              </div>
            )}
          </div>
          
          {/* Post-op Section */}
          <div className="bg-gray-800 rounded-xl border border-gray-700 p-4">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <CheckCircle size={20} className="text-green-400" />
              Post-Op Check
            </h3>
            
            {!postopResult ? (
              <div className="text-center py-6">
                <p className="text-gray-400 mb-4">Verify instruments after procedure</p>
                <button
                  onClick={scanPostop}
                  disabled={isScanningPostop || !baseline}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-green-500/20 text-green-400 rounded-lg hover:bg-green-500/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
                  <p className="text-sm text-gray-500 mt-2">Set baseline first</p>
                )}
              </div>
            ) : (
              <div>
                <div className={`flex items-center gap-2 mb-3 ${postopResult.passed ? 'text-green-400' : 'text-red-400'}`}>
                  {postopResult.passed ? <CheckCircle size={18} /> : <XCircle size={18} />}
                  <span className="font-medium">
                    {postopResult.passed ? 'PASS - All Accounted' : 'FAIL - Items Missing'}
                  </span>
                </div>
                
                {postopResult.postop_image && (
                  <img 
                    src={`data:image/jpeg;base64,${postopResult.postop_image}`}
                    alt="Post-op"
                    className="w-full h-32 object-cover rounded-lg mb-3"
                  />
                )}
                
                <div className="space-y-2 text-sm">
                  {Object.entries(postopResult.baseline).map(([instrument, expected]) => {
                    const actual = postopResult.final[instrument] || 0;
                    const status = actual === expected ? '✅' : actual < expected ? '❌' : '⚠️';
                    return (
                      <div key={instrument} className="flex items-center justify-between">
                        <span className="text-gray-300">{instrument}</span>
                        <span className={actual === expected ? 'text-green-400' : 'text-red-400'}>
                          {expected} → {actual} {status}
                        </span>
                      </div>
                    );
                  })}
                </div>
                
                {!postopResult.passed && postopResult.investigation && (
                  <div className="mt-3 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                    <p className="text-red-400 text-sm">
                      <AlertOctagon size={14} className="inline mr-1" />
                      Investigation Opened
                    </p>
                    <p className="text-gray-400 text-xs mt-1">
                      {postopResult.investigation.flagged_nurse} has been flagged
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
          
          {/* Timeline */}
          <div className="bg-gray-800 rounded-xl border border-gray-700 p-4 flex-1">
            <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
              <Activity size={20} className="text-purple-400" />
              Timeline
            </h3>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {timeline.length === 0 ? (
                <p className="text-gray-500 text-sm">No events yet</p>
              ) : (
                timeline.slice(-10).reverse().map((event, idx) => (
                  <div key={idx} className="text-sm border-l-2 border-gray-600 pl-3 py-1">
                    <span className="text-gray-500 text-xs">{event.time}</span>
                    <p className="text-gray-300">
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
          <div className="bg-gray-800 rounded-xl border border-gray-700 p-4 flex-1">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <Camera size={20} className="text-cyan-400" />
                Live Monitor
              </h3>
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${connected ? 'bg-green-400' : 'bg-red-400'}`} />
                <span className="text-sm text-gray-400">
                  {connected ? 'Live' : 'Disconnected'}
                </span>
              </div>
            </div>
            
            <div className="relative bg-black rounded-lg overflow-hidden" style={{ height: '480px' }}>
              {frame ? (
                <img 
                  src={`data:image/jpeg;base64,${frame}`}
                  alt="Surgery Feed"
                  className="w-full h-full object-contain"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-500">
                  <div className="text-center">
                    <Camera size={48} className="mx-auto mb-2 opacity-50" />
                    <p>Waiting for camera...</p>
                  </div>
                </div>
              )}
            </div>
          </div>
          
          {/* Live Counts */}
          <div className="bg-gray-800 rounded-xl border border-gray-700 p-4 mt-4">
            <h3 className="text-lg font-semibold text-white mb-3">Live Instrument Counts</h3>
            {Object.keys(liveCounts).length === 0 ? (
              <p className="text-gray-500">No instruments detected</p>
            ) : (
              <div className="grid grid-cols-5 gap-3">
                {Object.entries(liveCounts).map(([instrument, count]) => (
                  <div 
                    key={instrument}
                    className={`p-3 rounded-lg border ${getCountBgColor(instrument, count)}`}
                  >
                    <p className="text-xs text-gray-400">{instrument}</p>
                    <p className={`text-2xl font-bold ${getCountColor(instrument, count)}`}>
                      {count}
                    </p>
                    {baseline && (
                      <p className="text-xs text-gray-500">
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
        <div className="w-80 bg-gray-800 rounded-xl border border-gray-700 p-4">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <AlertTriangle size={20} className="text-red-400" />
            Investigations
          </h3>
          
          {investigations.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No investigations</p>
          ) : (
            <div className="space-y-3">
              {investigations.map((inv) => (
                <div 
                  key={inv.id}
                  className="p-3 bg-gray-700/50 rounded-lg border border-gray-600 cursor-pointer hover:bg-gray-700 transition-colors"
                  onClick={() => {
                    setSelectedInvestigation(inv);
                    setShowInvestigationModal(true);
                  }}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-gray-400">{inv.id}</span>
                    <span className={`text-xs px-2 py-1 rounded ${
                      inv.status === 'under_investigation' 
                        ? 'bg-yellow-500/20 text-yellow-400' 
                        : 'bg-green-500/20 text-green-400'
                    }`}>
                      {inv.status}
                    </span>
                  </div>
                  <p className="text-sm text-white">{inv.nurse_name}</p>
                  <p className="text-xs text-gray-400">
                    {Object.entries(inv.missing_items).map(([k, v]) => `${v}x ${k}`).join(', ')}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      
      {/* Investigation Modal */}
      {showInvestigationModal && selectedInvestigation && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-xl border border-gray-700 p-6 max-w-lg w-full mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-semibold text-white">Investigation Details</h3>
              <button 
                onClick={() => setShowInvestigationModal(false)}
                className="text-gray-400 hover:text-white"
              >
                <XCircle size={24} />
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <p className="text-gray-400 text-sm">Investigation ID</p>
                <p className="text-white">{selectedInvestigation.id}</p>
              </div>
              
              <div>
                <p className="text-gray-400 text-sm">Nurse</p>
                <p className="text-white">{selectedInvestigation.nurse_name}</p>
              </div>
              
              <div>
                <p className="text-gray-400 text-sm">Missing Items</p>
                <div className="flex flex-wrap gap-2 mt-1">
                  {Object.entries(selectedInvestigation.missing_items).map(([item, count]) => (
                    <span key={item} className="px-2 py-1 bg-red-500/20 text-red-400 rounded text-sm">
                      {count}x {item}
                    </span>
                  ))}
                </div>
              </div>
              
              <div>
                <p className="text-gray-400 text-sm">Created</p>
                <p className="text-white">
                  {new Date(selectedInvestigation.created_at).toLocaleString()}
                </p>
              </div>
            </div>
            
            <button
              onClick={() => setShowInvestigationModal(false)}
              className="w-full mt-6 px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
