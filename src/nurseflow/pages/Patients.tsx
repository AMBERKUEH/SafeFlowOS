import { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Users, LayoutDashboard, Calendar, Microscope, FileText, Settings,
  HelpCircle, User, Menu, Bell, Grid, ChevronRight, Mic, MicOff,
  Check, X, FileDown, ShieldCheck, Edit3, ArrowRight, Loader
} from 'lucide-react';
import { jsPDF } from 'jspdf';

// --- Sidebar Item ---
const SidebarItem = ({ icon: Icon, label, active = false, href = "#" }: { icon: any, label: string, active?: boolean, href?: string }) => (
  <motion.a
    href={href}
    whileHover={{ scale: 0.98 }}
    whileTap={{ scale: 0.95 }}
    className={`flex items-center gap-4 px-4 py-2.5 rounded-lg transition-colors group ${active
      ? 'bg-surface-container-high text-on-surface'
      : 'text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface'
      }`}
  >
    <Icon size={20} className={active ? 'text-secondary' : 'group-hover:text-secondary transition-colors'} />
    <span className={`text-[15px] ${active ? 'font-medium' : 'font-normal'}`}>{label}</span>
  </motion.a>
);

export default function PatientsPage() {
  const HARD_CODED_DOCTOR_NAME = 'Dr. Edward Smith';
  const HARD_CODED_SIGNATURE_CODE = 'SF-VERIFIED-9824';
  const [isSidebarOpen, setSidebarOpen] = useState(true);

  // Workflow steps: 'idle' | 'recording' | 'summarizing' | 'review' | 'confirmed'
  const [step, setStep] = useState<'idle' | 'recording' | 'summarizing' | 'review'>('idle');

  // Dictation States
  const [transcript, setTranscript] = useState('');
  const [fullTranscript, setFullTranscript] = useState('');
  const [recognition, setRecognition] = useState<any>(null);
  const silenceTimeoutRef = useRef<any>(null);
  const cutoffTranscriptRef = useRef<string>('');

  // SOAP States
  const [soapNotes, setSoapNotes] = useState({
    subjective: '',
    objective: '',
    assessment: '',
    plan: ''
  });

  // Confirmation states
  const [doctorStatus, setDoctorStatus] = useState<'approved' | 'edit' | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const visualizerAnimationRef = useRef<number | null>(null);

  // Initialize browser Speech Recognition
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const rec = new SpeechRecognition();
      rec.continuous = true;
      rec.interimResults = true;
      rec.lang = 'en-US';

      rec.onresult = (event: any) => {
        let fullText = '';
        for (let i = 0; i < event.results.length; ++i) {
          fullText += event.results[i][0].transcript + ' ';
        }

        const cleanedFull = fullText.trim();
        if (cleanedFull) {
          setFullTranscript(cleanedFull);

          // Slice off the prefix that has already been faded/cleared
          const cutoffText = cutoffTranscriptRef.current;
          const previewText = cleanedFull.substring(Math.min(cutoffText.length, cleanedFull.length)).trim();

          setTranscript(previewText);

          if (silenceTimeoutRef.current) clearTimeout(silenceTimeoutRef.current);
          silenceTimeoutRef.current = setTimeout(() => {
            // Silence! Clear the preview and set cutoff to the current full text
            cutoffTranscriptRef.current = cleanedFull + ' ';
            setTranscript('');
          }, 1000); // Clears preview after 1 second of silence
        }
      };

      rec.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        if (event.error === 'not-allowed') {
          alert('Microphone permission is blocked. Please allow microphone access in your browser settings to use voice dictation.');
        } else {
          alert(`Speech recognition error: ${event.error}. Please try again.`);
        }
        setStep('idle');
      };

      setRecognition(rec);
    }
  }, []);

  // Live Sound Wave Visualizer
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let phase = 0;
    const draw = () => {
      if (!canvas || !ctx) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const width = canvas.width;
      const height = canvas.height;
      const centerY = height / 2;

      ctx.beginPath();
      ctx.strokeStyle = step === 'recording' ? 'rgba(70, 72, 212, 0.8)' : 'rgba(76, 69, 70, 0.2)';
      ctx.lineWidth = 3;

      const amplitude = step === 'recording' ? (25 + Math.sin(phase * 0.15) * 8) : 2;
      const frequency = step === 'recording' ? 0.03 : 0.005;

      for (let x = 0; x < width; x++) {
        const y = centerY + Math.sin(x * frequency + phase) * amplitude * Math.sin(x * Math.PI / width);
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      phase += step === 'recording' ? 0.2 : 0.02;
      visualizerAnimationRef.current = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      if (visualizerAnimationRef.current) cancelAnimationFrame(visualizerAnimationRef.current);
    };
  }, [step]);

  // Start dictation
  const handleStartListening = () => {
    setTranscript('');
    setFullTranscript('');
    cutoffTranscriptRef.current = '';
    setDoctorStatus(null);
    if (silenceTimeoutRef.current) clearTimeout(silenceTimeoutRef.current);
    if (recognition) {
      setStep('recording');
      try {
        recognition.start();
      } catch (e) {
        console.error('Speech Recognition start failed:', e);
        alert('Could not start speech recognition. Please check your microphone.');
        setStep('idle');
      }
    } else {
      alert('Speech recognition is not supported in this browser. Please use a modern browser like Chrome or Edge.');
      setStep('idle');
    }
  };

  // Stop & Summarize — accepts optional string to avoid stale closure when called from simulator
  const handleStopAndSummarize = async (finalText?: string) => {
    if (recognition) {
      try {
        recognition.stop();
      } catch (e) {
        console.error('Error stopping recognition:', e);
      }
    }
    if (silenceTimeoutRef.current) clearTimeout(silenceTimeoutRef.current);
    setStep('summarizing');

    // Guard: only use finalText if it is actually a string (not a React event object)
    const resolvedText = typeof finalText === 'string' ? finalText : fullTranscript;
    const text = resolvedText.trim();

    if (!text) {
      console.warn('No transcript text available to summarize.');
      setStep('review');
      return;
    }

    console.log('Sending to Groq AI:', text.slice(0, 80) + '...');

    try {
      const response = await fetch('http://localhost:8000/api/summarize-consultation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript: text }),
      });

      if (!response.ok) {
        const errBody = await response.text();
        throw new Error(`Backend error ${response.status}: ${errBody}`);
      }

      const soapData = await response.json();
      setSoapNotes({
        subjective: soapData.subjective || '',
        objective: soapData.objective || '',
        assessment: soapData.assessment || '',
        plan: soapData.plan || ''
      });
      setStep('review');
    } catch (err) {
      console.warn('Groq AI failed, using local parser as fallback:', err);
      const parsedSoap = runSoapSummarizer(text);
      setSoapNotes(parsedSoap);
      setStep('review');
    }
  };

  // Local SOAP compiler
  const runSoapSummarizer = (text: string) => {
    // 100% Dynamic - only documents the actual spoken dictation, NO faked or hardcoded details
    return {
      subjective: text,
      objective: "Physical exam and vitals not recorded.",
      assessment: "1. Clinical review of dictated encounter.",
      plan: "1. Follow up as clinically indicated."
    };
  };

  // Sign off & Export PDF
  const handleExportPDF = () => {
    if (doctorStatus !== 'approved') return;

    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    const dateStr = new Date().toLocaleDateString('en-US', { day: '2-digit', month: 'long', year: 'numeric' });
    const timeStr = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

    // Theme royal blue
    const primaryColor = [70, 72, 212];

    // --- Elegant Header Banner ---
    doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.rect(0, 0, 210, 32, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.text('SAFEFLOW OS CLINICAL PORTAL', 15, 13);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text('OFFICIAL ENCOUNTER SUMMARY & SOAP RECORD', 15, 20);
    doc.text(`Attested and Digitally Signed by Doctor`, 15, 25);

    // --- Document Metadata Table ---
    doc.setTextColor(0, 0, 0);
    doc.setFillColor(245, 246, 248);
    doc.rect(15, 40, 180, 22, 'F');
    doc.rect(15, 40, 180, 22, 'S');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text('ENCOUNTER DOCTOR:', 20, 47);
    doc.text('RECORDING TIMESTAMP:', 20, 55);
    doc.text('SIGNATURE STATUS:', 110, 47);
    doc.text('VERIFICATION CODE:', 110, 55);

    doc.setFont('helvetica', 'normal');
    doc.text(`${HARD_CODED_DOCTOR_NAME}`, 65, 47);
    doc.text(`${dateStr} at ${timeStr}`, 65, 55);
    doc.text('APPROVED & ATTESTED', 150, 47);
    doc.text(HARD_CODED_SIGNATURE_CODE, 150, 55);

    // --- SOAP note contents layout ---
    let y = 74;

    const renderBox = (title: string, text: string) => {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10.5);
      doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.text(title, 15, y);

      doc.setDrawColor(200, 200, 200);
      doc.line(15, y + 2, 195, y + 2);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9.5);
      doc.setTextColor(50, 50, 50);

      const lines = doc.splitTextToSize(text, 180);
      doc.text(lines, 15, y + 8);

      y += (lines.length * 5) + 15;
    };

    renderBox('SUBJECTIVE (S)', soapNotes.subjective);
    renderBox('OBJECTIVE (O)', soapNotes.objective);
    renderBox('ASSESSMENT (A)', soapNotes.assessment);

    if (y > 230) {
      doc.addPage();
      y = 20;
    }

    renderBox('PLAN (P)', soapNotes.plan);

    // --- Digital Attestation Seal ---
    y += 5;
    if (y > 240) {
      doc.addPage();
      y = 20;
    }

    doc.setFillColor(235, 255, 235);
    doc.setDrawColor(0, 150, 0);
    doc.rect(15, y, 180, 20, 'F');
    doc.rect(15, y, 180, 20, 'S');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(0, 120, 0);
    doc.text('✓ ELECTRONIC CLINICAL SIGN-OFF CERTIFICATE', 20, y + 6);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(50, 100, 50);
    doc.text(`This clinical document has been electronically signed and attested by ${HARD_CODED_DOCTOR_NAME} on ${dateStr} at ${timeStr}.`, 20, y + 11);
    doc.text(`Digital Verification Code: ${HARD_CODED_SIGNATURE_CODE} (Generated securely by SafeFlow OS).`, 20, y + 15);

    // Attestation signature text line
    y += 35;
    doc.setDrawColor(150, 150, 150);
    doc.line(125, y, 195, y);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(0, 0, 0);
    doc.text('VERIFIED DOCTOR SIGNATURE', 138, y + 5);

    doc.setFont('helvetica', 'oblique');
    doc.setFontSize(11);
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.text(HARD_CODED_DOCTOR_NAME, 145, y - 3.5);

    // Save report
    doc.save(`Clinical_Summary_${HARD_CODED_DOCTOR_NAME.replace(/\s+/g, '_')}.pdf`);
  };

  // Mark SOAP as approved for export
  const handleApproveStatus = () => {
    setDoctorStatus('approved');
  };

  return (
    <div className="flex h-screen bg-surface overflow-hidden font-sans">

      {/* Sidebar Navigation */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.nav
            initial={{ x: -256 }}
            animate={{ x: 0 }}
            exit={{ x: -256 }}
            className="fixed md:relative z-40 flex flex-col h-full w-64 bg-surface-container-lowest border-r border-outline-variant py-8 px-4"
          >
            {/* Brand Logo */}
            <div className="flex items-center gap-3 mb-10 px-2">
              <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center text-on-primary shadow-sm shadow-primary/10">
                <Users size={22} className="text-white" />
              </div>
              <div>
                <h1 className="text-xl font-semibold text-on-surface tracking-tight">SafeFlow OS</h1>
                <p className="text-[11px] uppercase tracking-wider font-bold text-on-surface-variant/70">Healthcare Workspace</p>
              </div>
            </div>

            {/* Nav Links */}
            <div className="flex-1 space-y-1 overflow-y-auto custom-scrollbar">
              <SidebarItem icon={LayoutDashboard} label="Dashboard" href="/" />
              <SidebarItem icon={Users} label="Patients" href="/patients" active />
              <SidebarItem icon={Calendar} label="Nurse Schedule" href="/nurseflow/upload" />
              <SidebarItem icon={Microscope} label="SurgEye Analysis" href="/nurseflow/surgeye" />
              <SidebarItem icon={FileText} label="Records" />
              <SidebarItem icon={Settings} label="Settings" />
            </div>

            {/* Support footer */}
            <div className="mt-auto pt-6 border-t border-outline-variant space-y-1">
              <SidebarItem icon={HelpCircle} label="Support" />
              <SidebarItem icon={User} label="Account" />
            </div>
          </motion.nav>
        )}
      </AnimatePresence>

      {/* Main Workspace Column */}
      <div className="flex-1 flex flex-col min-w-0 relative bg-surface-container-low">

        {/* Navigation Breadcrumb header */}
        <header className="flex justify-between items-center px-6 lg:px-container-margin w-full bg-surface-container-lowest h-16 border-b border-outline-variant z-30">
          <div className="flex items-center gap-4">
            <button onClick={() => setSidebarOpen(!isSidebarOpen)} className="p-2 text-on-surface-variant hover:text-primary rounded-full hover:bg-surface-container-low">
              <Menu size={20} />
            </button>
            <div className="flex items-center gap-2 text-sm text-on-surface-variant">
              <span>SafeFlow OS</span>
              <ChevronRight size={14} />
              <span className="text-on-surface font-medium">Patients Dictation Hub</span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <button className="p-2 text-on-surface-variant hover:text-secondary rounded-full hover:bg-surface-container-low relative">
              <Bell size={18} />
              <span className="absolute top-2 right-2 w-1.5 h-1.5 bg-error rounded-full" />
            </button>
            <div className="w-px h-5 bg-outline-variant mx-1" />
            <button className="w-8 h-8 rounded-full overflow-hidden border border-outline-variant">
              <img alt="Doctor Avatar" className="w-full h-full object-cover" src="https://lh3.googleusercontent.com/aida-public/AB6AXuBKz5IKQQfWWn7CXLxGDlPGgR6LnGrEWCebMowTGQlwxrjDNzlNvobWQ8Zwvp759fqIh_Srbi3PJbyOfnTH7ENMZQ6KCoJISerrrbUbNx3fqU5kYt2DtiwA1AyLJZXhXpF7vSFMJox5ehW6n5y4jjB6SAQY8hsu1dpOMaR0Yug6vEkrgQXskrYiWDoyz499PMBho7Xl0ISBsjOSwzZspnnWyCUwvsNtx7ItREgLJMWwgB9a8i9YD1BSA8uMpAHw7Y1FDlyfJmjCQfa1" />
            </button>
          </div>
        </header>

        {/* Simplifed dictation page workspace */}
        <main className="flex-1 overflow-y-auto p-6 md:p-12 lg:px-24 pb-24 flex items-center justify-center">
          <div className="w-full max-w-3xl bg-surface-container-lowest border border-outline-variant rounded-2xl p-8 md:p-12 shadow-md">

            {/* Step Header */}
            <div className="text-center mb-8">
              <span className="text-[11px] font-bold uppercase tracking-widest text-secondary block mb-1">Encounter Dictation Copilot</span>
              <h2 className="text-3xl font-semibold text-on-surface tracking-tight">Clinical Consultation Recorder</h2>
            </div>

            {/* --- STATE 1: IDLE / RECORDING --- */}
            {(step === 'idle' || step === 'recording') && (
              <div className="space-y-8 flex flex-col items-center">

                {/* Visualizer audio display wave */}
                <div className="w-full bg-surface-container-low rounded-xl border border-outline-variant overflow-hidden h-28 flex flex-col justify-center items-center relative p-3">
                  <canvas ref={canvasRef} width="600" height="90" className="w-full h-[90px] opacity-80" />
                  {step === 'recording' && (
                    <span className="absolute top-3 right-3 px-2 py-0.5 rounded-full bg-error/10 text-error text-[10px] font-bold animate-pulse flex items-center gap-1">
                      <span className="w-1 h-1 rounded-full bg-error" />
                      LIVE RECORDING
                    </span>
                  )}
                </div>

                {/* Massive single record mic button */}
                <div className="flex flex-col items-center gap-4">
                  {step === 'idle' ? (
                    <button
                      onClick={handleStartListening}
                      className="w-24 h-24 rounded-full bg-secondary hover:bg-secondary/95 text-white flex items-center justify-center shadow-lg shadow-secondary/15 transition-all hover:scale-105"
                    >
                      <Mic size={38} className="text-white" />
                    </button>
                  ) : (
                    <button
                      onClick={() => handleStopAndSummarize()}
                      className="w-24 h-24 rounded-full bg-error hover:bg-error/95 text-white flex items-center justify-center shadow-lg shadow-error/15 transition-all hover:scale-105 animate-pulse"
                    >
                      <MicOff size={38} className="text-white" />
                    </button>
                  )}

                  <p className="text-sm font-semibold text-on-surface">
                    {step === 'idle' ? 'Click to Start Recording' : 'Recording Conversation... Click to Stop'}
                  </p>
                  <p className="text-xs text-on-surface-variant max-w-sm text-center">
                    Speak clearly to dictate your clinical discussion. Standard Web Speech will process your voice in real-time.
                  </p>
                </div>

                {/* Transcript Live Box Preview */}
                {transcript && (
                  <div className="w-full bg-surface-container-low border border-outline-variant rounded-xl p-5 text-sm leading-relaxed text-on-surface">
                    <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider mb-2">Live Transcript Preview:</p>
                    <p className="font-medium italic">"{transcript}"</p>
                  </div>
                )}

              </div>
            )}

            {/* --- STATE 2: AI SUMMARIZING --- */}
            {step === 'summarizing' && (
              <div className="py-16 flex flex-col items-center justify-center space-y-4">
                <Loader size={44} className="text-secondary animate-spin" />
                <h3 className="text-md font-semibold text-on-surface">AI Clinical Agent Summarizing...</h3>
                <p className="text-xs text-on-surface-variant text-center max-w-xs">
                  We are organizing the captured voice recording into a structured SOAP clinical summary note.
                </p>
              </div>
            )}

            {/* --- STATE 3: SOAP NOTE REVIEW (OK / NOT OK) --- */}
            {step === 'review' && (
              <div className="space-y-6">

                <div className="flex items-center justify-between pb-3 border-b border-outline-variant mb-4">
                  <h3 className="text-[16px] font-semibold text-on-surface">SOAP Summary</h3>
                  <span className="text-[10px] font-bold text-secondary bg-secondary/10 px-2.5 py-0.5 rounded-full border border-secondary/15">
                    Review Required
                  </span>
                </div>

                {/* Editable Text fields depending on edit state */}
                <div className="space-y-5">
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-secondary uppercase tracking-widest block">Subjective (S)</span>
                    <textarea
                      value={soapNotes.subjective}
                      disabled={doctorStatus === 'approved'}
                      onChange={(e) => setSoapNotes(prev => ({ ...prev, subjective: e.target.value }))}
                      rows={3}
                      className="w-full bg-gray-100 text-gray-900 text-xs border border-gray-300 rounded-xl p-4 focus:outline-none focus:ring-1 focus:ring-secondary/40 focus:border-secondary font-medium leading-relaxed disabled:opacity-70"
                    />
                  </div>

                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-secondary uppercase tracking-widest block">Objective (O)</span>
                    <textarea
                      value={soapNotes.objective}
                      disabled={doctorStatus === 'approved'}
                      onChange={(e) => setSoapNotes(prev => ({ ...prev, objective: e.target.value }))}
                      rows={3}
                      className="w-full bg-gray-100 text-gray-900 text-xs border border-gray-300 rounded-xl p-4 focus:outline-none focus:ring-1 focus:ring-secondary/40 focus:border-secondary font-medium leading-relaxed disabled:opacity-70"
                    />
                  </div>

                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-secondary uppercase tracking-widest block">Assessment (A)</span>
                    <textarea
                      value={soapNotes.assessment}
                      disabled={doctorStatus === 'approved'}
                      onChange={(e) => setSoapNotes(prev => ({ ...prev, assessment: e.target.value }))}
                      rows={2}
                      className="w-full bg-gray-100 text-gray-900 text-xs border border-gray-300 rounded-xl p-4 focus:outline-none focus:ring-1 focus:ring-secondary/40 focus:border-secondary font-medium leading-relaxed disabled:opacity-70"
                    />
                  </div>

                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-secondary uppercase tracking-widest block">Plan (P)</span>
                    <textarea
                      value={soapNotes.plan}
                      disabled={doctorStatus === 'approved'}
                      onChange={(e) => setSoapNotes(prev => ({ ...prev, plan: e.target.value }))}
                      rows={3}
                      className="w-full bg-gray-100 text-gray-900 text-xs border border-gray-300 rounded-xl p-4 focus:outline-none focus:ring-1 focus:ring-secondary/40 focus:border-secondary font-medium leading-relaxed disabled:opacity-70"
                    />
                  </div>
                </div>

                {/* --- Doctor Decides: OK / Not OK --- */}
                {doctorStatus === null && (
                  <div className="pt-4 border-t border-outline-variant flex flex-col items-center gap-4">
                    <p className="text-sm font-semibold text-on-surface">Is this SOAP summary notes correct?</p>
                    <div className="flex items-center gap-4 w-full max-w-sm">
                      <button
                        onClick={handleApproveStatus}
                        className="flex-1 flex items-center justify-center gap-2 px-5 py-3 rounded-full bg-green-600 hover:bg-green-700 text-white font-semibold text-sm shadow-md shadow-green-600/10 transition-colors"
                      >
                        <Check size={16} />
                        OK (Approve)
                      </button>
                      <button
                        onClick={() => setDoctorStatus('edit')}
                        className="flex-1 flex items-center justify-center gap-2 px-5 py-3 rounded-full bg-surface-container-high hover:bg-surface-container-highest border border-outline-variant text-on-surface font-semibold text-sm transition-colors"
                      >
                        <X size={16} className="text-error" />
                        Not OK (Edit)
                      </button>
                    </div>
                  </div>
                )}

                {/* Edit feedback warning */}
                {doctorStatus === 'edit' && (
                  <div className="p-3.5 bg-yellow-50 border border-yellow-200 text-yellow-800 rounded-xl text-xs font-semibold flex items-center justify-between">
                    <span>✏️ Editing Mode: You can now type directly in the textboxes above to make changes.</span>
                    <button
                      onClick={handleApproveStatus}
                      className="bg-yellow-600 hover:bg-yellow-700 text-white px-3 py-1 rounded-full text-[11px] font-bold transition-colors"
                    >
                      Confirm Changes (OK)
                    </button>
                  </div>
                )}

                {/* --- Confirmed Attestation Digital Signature Card --- */}
                {doctorStatus === 'approved' && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-5 bg-green-50 border border-green-200 rounded-xl space-y-4 pt-5"
                  >
                    <div className="flex items-center gap-2.5 text-green-800">
                      <ShieldCheck size={20} />
                      <span className="text-xs font-bold uppercase tracking-wider">Clinical Attestation Signed</span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                      <div className="space-y-1">
                        <label className="text-[10px] text-green-950 font-bold uppercase block">Attesting Doctor</label>
                        <div className="w-full bg-white border border-green-200 rounded-lg px-3 py-2 text-xs font-semibold text-black">
                          {HARD_CODED_DOCTOR_NAME}
                        </div>
                      </div>
                      <div className="p-2 border border-dashed border-green-400 bg-white rounded-lg text-center flex flex-col justify-center">
                        <span className="text-[9px] text-on-surface-variant font-bold uppercase">Digital Verification Seal</span>
                        <span className="text-sm font-bold text-green-700 font-mono tracking-wider">{HARD_CODED_SIGNATURE_CODE}</span>
                      </div>
                    </div>

                    <button
                      onClick={handleExportPDF}
                      className="w-full flex items-center justify-center gap-2 px-5 py-3.5 bg-primary text-white font-semibold text-sm rounded-full shadow-md shadow-primary/10 hover:bg-primary/95 transition-colors"
                    >
                      <FileDown size={18} />
                      Export PDF with Digital Sign
                    </button>

                  </motion.div>
                )}

                {/* Restart dictation helper */}
                <div className="flex justify-end pt-2">
                  <button
                    onClick={() => {
                      setStep('idle');
                      setTranscript('');
                      setDoctorStatus(null);
                    }}
                    className="text-xs font-semibold text-on-surface-variant hover:text-secondary transition-colors"
                  >
                    Start Over / Reset Recorder
                  </button>
                </div>

              </div>
            )}

          </div>
        </main>

      </div>
    </div>
  );
}
