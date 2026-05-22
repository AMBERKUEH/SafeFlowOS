import { AnimatePresence, motion } from 'motion/react';
import {
  Bell,
  Calendar,
  ChevronRight,
  Droplets,
  FileText,
  Grid,
  HelpCircle,
  LayoutDashboard,
  Menu,
  Microscope,
  Search,
  Settings,
  User,
  Users,
} from 'lucide-react';
import { useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router';

function SidebarItem({
  icon: Icon,
  label,
  href,
  active,
}: {
  icon: any;
  label: string;
  href: string;
  active?: boolean;
}) {
  return (
    <motion.div whileHover={{ scale: 0.98 }} whileTap={{ scale: 0.95 }}>
      <Link
        to={href}
        className={`flex items-center gap-4 px-4 py-2.5 rounded-lg transition-colors group ${
          active
            ? 'bg-surface-container-high text-on-surface'
            : 'text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface'
        }`}
      >
        <Icon size={20} className={active ? 'text-secondary' : 'group-hover:text-secondary transition-colors'} />
        <span className={`text-[15px] ${active ? 'font-medium' : 'font-normal'}`}>{label}</span>
      </Link>
    </motion.div>
  );
}

function resolveSection(pathname: string) {
  if (pathname.includes('/upload')) return 'upload';
  if (pathname.includes('/processing')) return 'processing';
  if (pathname.includes('/dashboard')) return 'dashboard';
  if (pathname.includes('/schedule')) return 'schedule';
  if (pathname.includes('/surgeye')) return 'surgeye';
  if (pathname === '/nurseflow' || pathname === '/upload' || pathname === '/nurseflow/') return 'upload';
  return 'dashboard';
}

export default function NurseflowLayout() {
  const [isSidebarOpen, setSidebarOpen] = useState(true);
  const location = useLocation();
  const section = resolveSection(location.pathname);

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
              <SidebarItem icon={LayoutDashboard} label="Dashboard" href="/" active={false} />
              <SidebarItem icon={Users} label="Patients" href="/" active={false} />
              <SidebarItem icon={Calendar} label="Nurse Schedule" href="/nurseflow/upload" active={section === 'upload' || section === 'processing' || section === 'schedule'} />
              <SidebarItem icon={Microscope} label="SurgEye Analysis" href="/nurseflow/surgeye" active={section === 'surgeye'} />
              <SidebarItem icon={FileText} label="Records" href="/" />
              <SidebarItem icon={Settings} label="Settings" href="/" />
            </div>

            <div className="mt-auto pt-6 border-t border-outline-variant space-y-1">
              <SidebarItem icon={HelpCircle} label="Support" href="/nurseflow/dashboard" />
              <SidebarItem icon={User} label="Account" href="/nurseflow/dashboard" />
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
              <span className="text-on-surface font-medium">NurseFlow</span>
            </div>
          </div>

          <div className="flex-1 max-w-md mx-8 hidden lg:block">
            <div className="relative group">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-on-surface-variant group-focus-within:text-secondary transition-colors" size={18} />
              <input
                className="w-full bg-surface-container-low border border-outline-variant rounded-full py-2 pl-11 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-secondary/10 focus:border-secondary/30 transition-all placeholder:text-on-surface-variant"
                placeholder="Search nurses, schedules, or commands..."
                type="text"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button className="p-2.5 text-on-surface-variant hover:text-secondary transition-colors rounded-full hover:bg-surface-container-low relative">
              <Bell size={20} />
              <span className="absolute top-2.5 right-2.5 w-2 h-2 bg-error rounded-full ring-2 ring-white" />
            </button>
            <button className="p-2.5 text-on-surface-variant hover:text-secondary transition-colors rounded-full hover:bg-surface-container-low">
              <Grid size={20} />
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
