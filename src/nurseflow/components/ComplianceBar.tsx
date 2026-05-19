import { CheckCircle, AlertCircle } from 'lucide-react';

interface ComplianceBarProps {
  isCompliant: boolean;
  message: string;
}

export function ComplianceBar({ isCompliant, message }: ComplianceBarProps) {
  return (
    <div
      className="w-full flex items-center justify-center gap-3 relative overflow-hidden"
      style={{
        height: '48px',
        backgroundColor: isCompliant ? '#00E5A0' : '#FF3D5A',
      }}
    >
      {/* Shimmer effect for compliant state */}
      {isCompliant && (
        <div
          className="absolute inset-0 opacity-20"
          style={{
            background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent)',
            animation: 'shimmer 2s infinite',
          }}
        />
      )}
      
      {isCompliant ? (
        <CheckCircle size={20} style={{ color: '#0A0F1E' }} />
      ) : (
        <AlertCircle size={20} style={{ color: '#FFFFFF' }} />
      )}
      
      <span
        style={{
          fontFamily: 'Syne, sans-serif',
          fontWeight: 700,
          fontSize: '14px',
          color: isCompliant ? '#0A0F1E' : '#FFFFFF',
          textTransform: 'uppercase',
          letterSpacing: '1px',
        }}
      >
        {message}
      </span>

      <style>{`
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
      `}</style>
    </div>
  );
}
