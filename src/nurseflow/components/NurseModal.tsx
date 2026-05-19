import { X, Loader2 } from 'lucide-react';
import { useState, useEffect } from 'react';
import { Nurse } from '../data/mockData';
import { explainNurse } from '../services/api';

interface NurseModalProps {
  nurse: Nurse;
  onClose: () => void;
}

const skillLabels = {
  1: 'N1',
  2: 'N2',
  3: 'N3',
  4: 'N4',
};

const wardColors = {
  ICU: '#00D4FF',
  ER: '#FF3D5A',
  General: '#00E5A0',
  Pediatrics: '#FF6B35',
};

const skillColors = {
  1: '#6B7280',
  2: '#FF6B35',
  3: '#00D4FF',
  4: '#FF3D5A',
};

export function NurseModal({ nurse, onClose }: NurseModalProps) {
  const [explanation, setExplanation] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const fetchExplanation = async () => {
      setIsLoading(true);
      setError(false);
      
      // Get schedule from localStorage
      const scheduleData = localStorage.getItem('scheduleData');
      const schedule = scheduleData ? JSON.parse(scheduleData).schedule : {};
      
      const result = await explainNurse(nurse.name, schedule);
      
      if (result) {
        setExplanation(result.explanation);
      } else {
        setError(true);
      }
      
      setIsLoading(false);
    };

    fetchExplanation();
  }, [nurse.name]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: 'rgba(10, 15, 30, 0.7)' }}
      onClick={onClose}
    >
      <div
        className="relative"
        style={{
          width: '440px',
          backgroundColor: '#111827',
          borderRadius: '12px',
          border: '2px solid #00D4FF',
          boxShadow: '0 0 40px rgba(0, 212, 255, 0.3)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between p-6 pb-4">
          <div className="flex items-center gap-3">
            <h2
              style={{
                fontFamily: 'Syne, sans-serif',
                fontWeight: 700,
                fontSize: '22px',
                color: '#FFFFFF',
              }}
            >
              {nurse.name}
            </h2>
            <span
              className="px-2 py-1 rounded"
              style={{
                backgroundColor: skillColors[nurse.skillLevel],
                color: '#FFFFFF',
                fontSize: '11px',
                fontWeight: 600,
              }}
            >
              {skillLabels[nurse.skillLevel]}
            </span>
            <span
              className="px-2 py-1 rounded"
              style={{
                backgroundColor: `${wardColors[nurse.ward]}33`,
                color: wardColors[nurse.ward],
                fontSize: '11px',
              }}
            >
              {nurse.ward}
            </span>
          </div>
          <button
            onClick={onClose}
            className="hover:opacity-70 transition-opacity"
          >
            <X size={20} style={{ color: '#6B7280' }} />
          </button>
        </div>

        {/* Shifts Section */}
        <div className="px-6 pb-4">
          <h3
            className="mb-3"
            style={{
              fontFamily: 'Syne, sans-serif',
              fontWeight: 700,
              fontSize: '11px',
              color: '#00D4FF',
              textTransform: 'uppercase',
              letterSpacing: '2px',
            }}
          >
            This Week's Shifts
          </h3>
          <div className="flex flex-col gap-2">
            {nurse.shifts.length > 0 ? (
              nurse.shifts.map((shift, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between py-2"
                >
                  <div className="flex items-center gap-4">
                    <span style={{ fontSize: '14px', color: '#6B7280', width: '40px' }}>
                      {shift.day}
                    </span>
                    <span style={{ fontSize: '14px', color: '#FFFFFF', width: '80px' }}>
                      {shift.shift}
                    </span>
                  </div>
                  <span
                    className="px-3 py-1 rounded"
                    style={{
                      backgroundColor: `${wardColors[shift.ward]}33`,
                      color: wardColors[shift.ward],
                      fontSize: '12px',
                    }}
                  >
                    {shift.ward}
                  </span>
                </div>
              ))
            ) : (
              <p style={{ fontSize: '14px', color: '#6B7280' }}>
                No shifts assigned yet
              </p>
            )}
          </div>
        </div>

        {/* Why Section */}
        <div className="px-6 pb-6">
          <h3
            className="mb-2"
            style={{
              fontFamily: 'Syne, sans-serif',
              fontWeight: 700,
              fontSize: '11px',
              color: '#00D4FF',
              textTransform: 'uppercase',
              letterSpacing: '2px',
            }}
          >
            Why These Shifts?
          </h3>
          
          {isLoading ? (
            <div className="flex items-center gap-2" style={{ color: '#6B7280' }}>
              <Loader2 size={16} className="animate-spin" />
              <span style={{ fontSize: '13px' }}>Getting explanation...</span>
            </div>
          ) : error ? (
            <p style={{ fontSize: '13px', color: '#6B7280', lineHeight: '1.6' }}>
              Could not load explanation
            </p>
          ) : (
            <p style={{ fontSize: '13px', color: '#FFFFFF', lineHeight: '1.6' }}>
              {explanation}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
