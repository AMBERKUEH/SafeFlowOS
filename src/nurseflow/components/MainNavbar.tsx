import { NavLink } from 'react-router';
import { Calendar, Microscope } from 'lucide-react';

export function MainNavbar() {
  return (
    <nav 
      className="w-full flex items-center justify-between px-8"
      style={{ 
        height: '64px',
        backgroundColor: '#111827',
        borderBottom: '1px solid #1F2937'
      }}
    >
      {/* Logo */}
      <h1 
        className="text-xl"
        style={{ 
          fontFamily: 'Syne, sans-serif',
          fontWeight: 700,
          color: '#00D4FF'
        }}
      >
        NurseAI
      </h1>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2">
        <NavLink
          to="/schedule"
          className={({ isActive }) => `
            flex items-center gap-2 px-4 py-2 rounded-lg transition-all
            ${isActive 
              ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/50' 
              : 'text-gray-400 hover:text-white hover:bg-gray-800'}
          `}
        >
          <Calendar size={18} />
          <span className="font-medium">Schedule</span>
        </NavLink>
        
        <NavLink
          to="/surgeye"
          className={({ isActive }) => `
            flex items-center gap-2 px-4 py-2 rounded-lg transition-all
            ${isActive 
              ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/50' 
              : 'text-gray-400 hover:text-white hover:bg-gray-800'}
          `}
        >
          <Microscope size={18} />
          <span className="font-medium">SurgEye</span>
        </NavLink>
      </div>

      {/* Status Indicator */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-green-500/20 text-green-400 text-sm">
          <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          System Online
        </div>
      </div>
    </nav>
  );
}
