import { motion, AnimatePresence } from 'motion/react';
import { 
  LayoutDashboard, 
  Users, 
  Calendar, 
  FileText, 
  Settings, 
  HelpCircle, 
  User, 
  Search, 
  Bell, 
  Grid, 
  ChevronRight, 
  Plus, 
  Zap, 
  AlertTriangle, 
  CheckSquare, 
  Bot, 
  ArrowRight, 
  AlertCircle, 
  Pill, 
  MoreVertical, 
  Sparkles, 
  Send, 
  ExternalLink,
  Droplets,
  Menu,
  Microscope
} from 'lucide-react';
import { useState } from 'react';

// --- Components ---

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

const MetricCard = ({ icon: Icon, label, value, trend, trendColor = 'secondary', index }: { icon: any, label: string, value: string, trend?: string, trendColor?: 'secondary' | 'error', index: number }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay: index * 0.1 }}
    className="bg-surface-container-lowest rounded-xl p-6 border border-outline-variant hover:shadow-sm transition-all group cursor-pointer relative overflow-hidden"
  >
    <div className={`absolute top-0 right-0 w-32 h-32 bg-${trendColor}/5 rounded-full blur-2xl -mr-16 -mt-16 transition-transform group-hover:scale-110`} />
    
    <div className="flex justify-between items-start mb-10 relative z-10">
      <div className="w-10 h-10 rounded-lg bg-surface-container-low flex items-center justify-center text-on-surface-variant group-hover:text-secondary transition-colors">
        <Icon size={22} />
      </div>
      {trend && (
        <span className={`text-[12px] font-semibold flex items-center gap-1.5 px-2.5 py-1 rounded-full border ${
          trendColor === 'error' 
            ? 'bg-error-container text-error border-error/10' 
            : 'bg-surface-container-lowest text-on-surface-variant border-outline-variant'
        }`}>
          {trendColor === 'error' && <span className="w-1.5 h-1.5 rounded-full bg-error animate-pulse" />}
          {trend}
        </span>
      )}
    </div>
    
    <div className="relative z-10">
      <p className="text-4xl font-semibold text-on-surface mb-1">{value}</p>
      <p className="text-sm text-on-surface-variant">{label}</p>
    </div>
  </motion.div>
);

const CopilotStatusCard = ({ index }: { index: number }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay: index * 0.1 }}
    className="bg-surface-container-lowest rounded-xl p-6 border border-outline-variant hover:shadow-sm transition-all flex flex-col justify-between relative overflow-hidden"
  >
    <div className="absolute inset-0 bg-gradient-to-br from-secondary/5 to-transparent z-0" />
    <div className="relative z-10 flex items-center gap-2 mb-auto">
      <Bot size={20} className="text-secondary fill-secondary/20" />
      <span className="text-sm text-on-surface font-medium">Copilot Status</span>
    </div>
    <div className="relative z-10 mt-8">
      <div className="flex items-center gap-2 mb-1">
        <div className="w-2 h-2 rounded-full bg-secondary animate-pulse" />
        <p className="text-sm text-on-surface font-medium">Analyzing 5 new records</p>
      </div>
      <p className="text-[12px] text-on-surface-variant">All systems nominal</p>
    </div>
  </motion.div>
);

const TaskItem = ({ icon: Icon, title, time, description, tags, statusColor = 'surface', isUrgent = false }: any) => (
  <div className={`p-5 hover:bg-surface-container-lowest transition-colors flex items-start gap-4 group cursor-pointer ${isUrgent ? 'border-l-4 border-error' : ''}`}>
    <div className={`w-11 h-11 rounded-full ${isUrgent ? 'bg-error-container animate-pulse' : 'bg-surface-container-low'} flex items-center justify-center shrink-0 mt-0.5`}>
      <Icon size={22} className={isUrgent ? 'text-error' : 'text-on-surface-variant'} />
    </div>
    <div className="flex-1 min-w-0">
      <div className="flex justify-between items-start mb-1">
        <h4 className="text-[15px] font-medium text-on-surface truncate group-hover:text-secondary transition-colors">{title}</h4>
        <span className={`text-[12px] font-medium ${isUrgent ? 'text-error' : 'text-on-surface-variant'} shrink-0`}>{time}</span>
      </div>
      <p className="text-sm text-on-surface-variant line-clamp-1 mb-3">{description}</p>
      <div className="flex items-center gap-2">
        {tags.map((tag: string) => (
          <span key={tag} className={`px-2.5 py-0.5 rounded-full font-semibold text-[11px] ${
            tag === 'High Priority' ? 'bg-error/10 text-error' : 
            tag === 'Copilot Analyzed' ? 'bg-secondary/10 text-secondary' : 
            'bg-surface-variant text-on-surface-variant'
          }`}>
            {tag}
          </span>
        ))}
      </div>
    </div>
    <button className="opacity-0 group-hover:opacity-100 p-2 text-on-surface-variant hover:text-on-surface transition-all rounded-full hover:bg-surface-variant">
      <MoreVertical size={18} />
    </button>
  </div>
);

// --- Main App ---

export default function App() {
  const [isSidebarOpen, setSidebarOpen] = useState(true);

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
            {/* Brand */}
            <div className="flex items-center gap-3 mb-10 px-2">
              <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center text-on-primary shadow-sm shadow-primary/10">
                <Droplets size={22} />
              </div>
              <div>
                <h1 className="text-xl font-semibold text-on-surface tracking-tight">SafeFlow OS</h1>
                <p className="text-[11px] uppercase tracking-wider font-bold text-on-surface-variant/70">Healthcare Workspace</p>
              </div>
            </div>

            {/* Nav Links */}
            <div className="flex-1 space-y-1 overflow-y-auto custom-scrollbar">
              <SidebarItem icon={LayoutDashboard} label="Dashboard" href="/" active />
              <SidebarItem icon={Users} label="Patients" href="/patients" />
              <SidebarItem icon={Calendar} label="Nurse Schedule" href="/nurseflow/upload" />
              <SidebarItem icon={Microscope} label="SurgEye Analysis" href="/nurseflow/surgeye" />
              <SidebarItem icon={FileText} label="Records" />
              <SidebarItem icon={Settings} label="Settings" />
            </div>

            {/* Footer Links */}
            <div className="mt-auto pt-6 border-t border-outline-variant space-y-1">
              <SidebarItem icon={HelpCircle} label="Support" />
              <SidebarItem icon={User} label="Account" />
            </div>
          </motion.nav>
        )}
      </AnimatePresence>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 relative">
        {/* Top AppBar */}
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
              <span className="text-on-surface font-medium">Dashboard</span>
            </div>
          </div>

          {/* Global Search */}
          <div className="flex-1 max-w-md mx-8 hidden lg:block">
            <div className="relative group">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-on-surface-variant group-focus-within:text-secondary transition-colors" size={18} />
              <input 
                className="w-full bg-surface-container-low border border-outline-variant rounded-full py-2 pl-11 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-secondary/10 focus:border-secondary/30 transition-all placeholder:text-on-surface-variant"
                placeholder="Search patients, records, or commands..."
                type="text"
              />
              <div className="absolute right-3.5 top-1/2 -translate-y-1/2 flex items-center gap-1">
                <kbd className="hidden xl:inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold bg-surface-container border border-outline-variant text-on-surface-variant">⌘K</kbd>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <button className="p-2.5 text-on-surface-variant hover:text-secondary transition-colors rounded-full hover:bg-surface-container-low relative">
                <Bell size={20} />
                <span className="absolute top-2.5 right-2.5 w-2 h-2 bg-error rounded-full ring-2 ring-white"></span>
              </button>
              <button className="p-2.5 text-on-surface-variant hover:text-secondary transition-colors rounded-full hover:bg-surface-container-low">
                <Grid size={20} />
              </button>
            </div>
            <div className="w-px h-6 bg-outline-variant mx-1 hidden sm:block" />
            <button className="w-9 h-9 rounded-full overflow-hidden border border-outline-variant hover:ring-2 hover:ring-secondary/20 transition-all">
              <img 
                alt="Dr. Smith Profile" 
                className="w-full h-full object-cover"
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuBKz5IKQQfWWn7CXLxGDlPGgR6LnGrEWCebMowTGQlwxrjDNzlNvobWQ8Zwvp759fqIh_Srbi3PJbyOfnTH7ENMZQ6KCoJISerrrbUbNx3fqU5kYt2DtiwA1AyLJZXhXpF7vSFMJox5ehW6n5y4jjB6SAQY8hsu1dpOMaR0Yug6vEkrgQXskrYiWDoyz499PMBho7Xl0ISBsjOSwzZspnnWyCUwvsNtx7ItREgLJMWwgB9a8i9YD1BSA8uMpAHw7Y1FDlyfJmjCQfa1"
              />
            </button>
          </div>
        </header>

        {/* Main Content Scrollable */}
        <main className="flex-1 overflow-y-auto p-6 md:p-8 lg:p-container-margin pb-24">
          <div className="max-w-6xl mx-auto">
            {/* Page Header */}
            <motion.section 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-12 flex flex-col sm:flex-row sm:items-end justify-between gap-6"
            >
              <div>
                <p className="text-[11px] font-bold text-on-surface-variant uppercase tracking-widest mb-2">My Workspace</p>
                <h2 className="text-4xl md:text-5xl font-semibold text-on-surface tracking-tight">Good morning, Dr. Smith</h2>
              </div>
              <div className="flex items-center gap-3">
                <motion.button 
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="flex items-center gap-2 px-5 py-2.5 bg-surface-container-lowest border border-outline-variant rounded-full text-sm font-medium hover:bg-surface-container-low transition-colors text-black"
                >
                  <Plus size={18} /> New Record
                </motion.button>
                <motion.button 
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="flex items-center gap-2 px-5 py-2.5 bg-primary text-on-primary rounded-full text-sm font-medium shadow-lg shadow-primary/10"
                >
                  <Zap size={18} /> Quick Actions
                </motion.button>
              </div>
            </motion.section>

            {/* Metrics Bento Grid */}
            <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
              <MetricCard index={0} icon={Users} label="Scheduled Patients" value="24" trend="Today" />
              <MetricCard index={1} icon={AlertTriangle} label="High-Risk Alerts" value="3" trend="Active" trendColor="error" />
              <MetricCard index={2} icon={CheckSquare} label="Pending Approvals" value="12" />
              <CopilotStatusCard index={3} />
            </section>

            {/* Workspace Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Left Column: Tasks */}
              <section className="lg:col-span-2 space-y-6">
                {/* Urgent Task Card */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2 px-1">
                    <AlertCircle size={16} className="text-error" />
                    <h3 className="text-xs font-bold text-error uppercase tracking-widest">Urgent Attention</h3>
                  </div>
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="bg-error/5 rounded-2xl border border-error/20 overflow-hidden shadow-sm shadow-error/5"
                  >
                    <TaskItem 
                      icon={AlertCircle} 
                      title="Urgent Consult: Sarah Jenkins" 
                      time="Now" 
                      description="Cardiology consult requested regarding recent ECG abnormalities."
                      tags={['High Priority']}
                      isUrgent
                    />
                  </motion.div>
                </div>

                <div className="flex items-center justify-between pt-2">
                  <h3 className="text-2xl font-semibold text-on-surface">Workspace Overview</h3>
                  <button className="text-sm font-semibold text-on-surface-variant hover:text-secondary flex items-center gap-1 transition-colors">
                    View all <ArrowRight size={14} />
                  </button>
                </div>

                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.4 }}
                  className="bg-surface-container-lowest rounded-2xl border border-outline-variant overflow-hidden shadow-sm"
                >
                  <div className="divide-y divide-outline-variant">
                    {/* Routine Section */}
                    <TaskItem 
                      icon={Search} 
                      title="Review Labs: John Doe" 
                      time="10:30 AM" 
                      description="Complete metabolic panel results available for review. Glucose slightly elevated."
                      tags={['Routine', 'Copilot Analyzed']}
                    />
                    <TaskItem 
                      icon={Pill} 
                      title="Prescription Renewal: M. Scott" 
                      time="Yesterday" 
                      description="Lisinopril 20mg daily. Patient reports no side effects."
                      tags={['Pharmacy']}
                    />
                  </div>
                </motion.div>
              </section>

              {/* Right Column: Insights */}
              <aside className="space-y-8">
                <div>
                  <h3 className="text-2xl font-semibold text-on-surface mb-6">Insights</h3>
                  
                  {/* Copilot Card */}
                  <motion.div 
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.5 }}
                    className="bg-surface-container-lowest rounded-2xl border border-outline-variant p-6 relative overflow-hidden group shadow-sm"
                  >
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-secondary/40 via-secondary/10 to-transparent" />
                    
                    <div className="flex items-center gap-2 mb-6">
                      <div className="w-8 h-8 rounded-lg bg-secondary/10 flex items-center justify-center text-secondary">
                        <Sparkles size={16} />
                      </div>
                      <h4 className="text-sm font-semibold text-on-surface">Copilot Suggestions</h4>
                    </div>

                    <div className="space-y-3">
                      <div className="p-3 rounded-xl bg-surface-container-low/50 border border-outline-variant/30 hover:border-secondary/30 transition-all cursor-pointer">
                        <p className="text-sm text-on-surface mb-0.5 font-medium">Schedule follow-up for <span className="text-secondary">John Doe</span></p>
                        <p className="text-[11px] text-on-surface-variant font-medium">Based on recent lab results</p>
                      </div>
                      <div className="p-3 rounded-xl bg-surface-container-low/50 border border-outline-variant/30 hover:border-secondary/30 transition-all cursor-pointer">
                        <p className="text-sm text-on-surface mb-0.5 font-medium">Draft referral to Cardiology</p>
                        <p className="text-[11px] text-on-surface-variant font-medium">For Sarah Jenkins</p>
                      </div>
                    </div>

                    <div className="mt-6 relative">
                      <input 
                        className="w-full bg-surface-container-low border-none rounded-xl py-2.5 pl-4 pr-10 text-sm focus:ring-1 focus:ring-secondary/30 transition-all placeholder:text-on-surface-variant/70"
                        placeholder="Ask Copilot..."
                        type="text"
                      />
                      <button className="absolute right-3 top-1/2 -translate-y-1/2 text-secondary hover:text-secondary-container transition-colors">
                        <Send size={16} />
                      </button>
                    </div>
                  </motion.div>
                </div>

                {/* Timeline */}
                <motion.div 
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.6 }}
                  className="bg-surface-container-lowest rounded-2xl border border-outline-variant p-6 shadow-sm"
                >
                  <div className="flex items-center justify-between mb-6">
                    <h4 className="text-sm font-semibold text-on-surface">Upcoming Today</h4>
                    <button className="text-on-surface-variant hover:text-secondary transition-colors">
                      <ExternalLink size={16} />
                    </button>
                  </div>

                  <div className="space-y-6 relative before:absolute before:inset-y-0 before:left-2 before:w-px before:bg-outline-variant/50">
                    <div className="relative pl-7">
                      <div className="absolute left-[5px] top-1.5 w-1.5 h-1.5 rounded-full bg-secondary ring-4 ring-white" />
                      <p className="text-[11px] font-bold text-secondary mb-1">11:00 AM</p>
                      <p className="text-sm font-medium text-on-surface leading-tight">Team Huddle</p>
                    </div>
                    <div className="relative pl-7">
                      <div className="absolute left-[5px] top-1.5 w-1.5 h-1.5 rounded-full bg-outline-variant ring-4 ring-white" />
                      <p className="text-[11px] font-bold text-on-surface-variant mb-1">1:30 PM</p>
                      <p className="text-sm font-medium text-on-surface leading-tight">Patient: E. Williams</p>
                      <p className="text-[12px] text-on-surface-variant italic">Annual physical</p>
                    </div>
                    <div className="relative pl-7">
                      <div className="absolute left-[5px] top-1.5 w-1.5 h-1.5 rounded-full bg-outline-variant ring-4 ring-white" />
                      <p className="text-[11px] font-bold text-on-surface-variant mb-1">3:00 PM</p>
                      <p className="text-sm font-medium text-on-surface leading-tight">Admin Block</p>
                    </div>
                  </div>
                </motion.div>
              </aside>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
