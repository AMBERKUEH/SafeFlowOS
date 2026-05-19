import { X } from 'lucide-react';

interface NavbarProps {
  filename?: string;
  onFileRemove?: () => void;
}

export function Navbar({ filename = 'march_roster_v2.pdf', onFileRemove }: NavbarProps) {
  return (
    <nav 
      className="w-full flex items-center justify-between px-8"
      style={{ 
        height: '64px',
        backgroundColor: '#111827'
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
        NurseFlow
      </h1>

      {/* Breadcrumb */}
      <div className="flex items-center gap-2" style={{ fontSize: '14px' }}>
        <span style={{ color: '#6B7280' }}>Upload</span>
        <span style={{ color: '#6B7280' }}>→</span>
        <span style={{ color: '#6B7280' }}>Process</span>
        <span style={{ color: '#6B7280' }}>→</span>
        <span style={{ color: '#FFFFFF' }}>Dashboard</span>
      </div>

      {/* File Pill */}
      <div 
        className="flex items-center gap-3 px-4 py-2 rounded-lg"
        style={{ backgroundColor: '#1A2235' }}
      >
        <span style={{ fontSize: '13px', color: '#FFFFFF' }}>{filename}</span>
        {onFileRemove && (
          <button 
            onClick={onFileRemove}
            className="hover:opacity-70 transition-opacity"
          >
            <X size={16} style={{ color: '#6B7280' }} />
          </button>
        )}
      </div>
    </nav>
  );
}
