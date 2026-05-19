import { ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { AgentMessage } from '../data/mockData';
import { handleEmergency } from '../services/api';

interface AgentActivityProps {
  messages: AgentMessage[];
  schedule?: any;
  onScheduleUpdate?: (schedule: any) => void;
  onEmergency?: (severity: string) => void;
}

const messageColors = {
  SCHEDULING: '#00D4FF',
  FORECAST: '#8B5CF6',
  COMPLIANCE: '#00E5A0',
  EMERGENCY: '#FF3D5A',
};

export function AgentActivity({ 
  messages: initialMessages, 
  schedule, 
  onScheduleUpdate, 
  onEmergency 
}: AgentActivityProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [inputValue, setInputValue] = useState('');
  // Ensure unique IDs for initial messages
  const [messages, setMessages] = useState<AgentMessage[]>(() => 
    initialMessages.map((msg, idx) => ({
      ...msg,
      id: msg.id || `${Date.now()}-${idx}`,
    }))
  );
  const [isLoading, setIsLoading] = useState(false);
  const [isEmergency, setIsEmergency] = useState(false);
  const [messageIdCounter, setMessageIdCounter] = useState(initialMessages.length);

  const handleSubmit = async () => {
    if (!inputValue.trim()) return;

    setIsLoading(true);

    // Get current schedule from prop or localStorage
    const currentSchedule = schedule || (() => {
      const scheduleData = localStorage.getItem('scheduleData');
      return scheduleData ? JSON.parse(scheduleData).schedule : {};
    })();

    // Call Emergency API
    const result = await handleEmergency(inputValue, currentSchedule);

    if (result) {
      // Add emergency message to activity log
      const newId = `${Date.now()}-${messageIdCounter}`;
      setMessageIdCounter(prev => prev + 1);
      const emergencyMessage: AgentMessage = {
        id: newId,
        type: 'EMERGENCY',
        message: result.action_taken || 'Emergency processed',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, emergencyMessage]);

      // Update schedule if provided
      if (result.updated_schedule && onScheduleUpdate) {
        onScheduleUpdate(result.updated_schedule);
      }

      // Check severity and notify parent
      if (result.severity === 'HIGH') {
        setIsEmergency(true);
        if (onEmergency) {
          onEmergency('HIGH');
        }
        // Dispatch event to notify dashboard
        window.dispatchEvent(new CustomEvent('emergency-triggered', { 
          detail: { severity: 'HIGH' } 
        }));
      }
    } else {
      // Add error message
      const newId = `${Date.now()}-${messageIdCounter}`;
      setMessageIdCounter(prev => prev + 1);
      const errorMessage: AgentMessage = {
        id: newId,
        type: 'EMERGENCY',
        message: 'Failed to process emergency. Please try again.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, errorMessage]);
    }

    // Clear input
    setInputValue('');
    setIsLoading(false);
  };

  return (
    <div
      className="mt-6"
      style={{
        backgroundColor: '#111827',
        borderRadius: '8px',
        overflow: 'hidden',
        border: isEmergency ? '2px solid #FF3D5A' : 'none',
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-6 py-4 cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-3">
          <h3
            style={{
              fontFamily: 'Syne, sans-serif',
              fontWeight: 700,
              fontSize: '11px',
              color: isEmergency ? '#FF3D5A' : '#00D4FF',
              textTransform: 'uppercase',
              letterSpacing: '2px',
            }}
          >
            Agent Activity
          </h3>
          {isEmergency && (
            <span
              style={{
                backgroundColor: '#FF3D5A',
                color: '#FFFFFF',
                fontSize: '10px',
                padding: '2px 8px',
                borderRadius: '4px',
                fontWeight: 600,
              }}
            >
              ALERT
            </span>
          )}
        </div>
        {isExpanded ? (
          <ChevronUp size={20} style={{ color: '#6B7280' }} />
        ) : (
          <ChevronDown size={20} style={{ color: '#6B7280' }} />
        )}
      </div>

      {/* Content */}
      {isExpanded && (
        <>
          {/* Message Log */}
          <div
            className="px-6 overflow-y-auto"
            style={{
              maxHeight: '160px',
              borderTop: '1px solid #1A2235',
              borderBottom: '1px solid #1A2235',
            }}
          >
            <div className="py-3 flex flex-col gap-3">
              {messages.map((msg) => (
                <div key={msg.id} className="flex items-start gap-3">
                  <span
                    className="px-2 py-1 rounded text-xs shrink-0"
                    style={{
                      backgroundColor: '#1A2235',
                      color: messageColors[msg.type],
                      fontSize: '10px',
                      fontWeight: 600,
                      textTransform: 'uppercase',
                    }}
                  >
                    [{msg.type}]
                  </span>
                  <span
                    className="flex-1"
                    style={{ 
                      fontSize: '13px', 
                      color: msg.type === 'EMERGENCY' ? '#FF3D5A' : '#FFFFFF' 
                    }}
                  >
                    {msg.message}
                  </span>
                  <span
                    className="shrink-0"
                    style={{ fontSize: '11px', color: '#6B7280' }}
                  >
                    {msg.timestamp}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Input Row */}
          <div className="flex gap-2 p-4">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
              placeholder="Enter disruption (e.g., Nurse sick, emergency surge...)"
              disabled={isLoading}
              className="flex-1 px-4 py-2 rounded outline-none"
              style={{
                backgroundColor: '#1A2235',
                color: '#FFFFFF',
                fontSize: '13px',
                border: 'none',
              }}
            />
            <button
              onClick={handleSubmit}
              disabled={isLoading}
              className="px-6 py-2 rounded transition-opacity hover:opacity-80 disabled:opacity-50 flex items-center gap-2"
              style={{
                backgroundColor: isEmergency ? '#FF3D5A' : '#00D4FF',
                color: '#0A0F1E',
                fontFamily: 'Syne, sans-serif',
                fontWeight: 700,
                fontSize: '11px',
                textTransform: 'uppercase',
                letterSpacing: '1px',
                border: 'none',
                cursor: isLoading ? 'not-allowed' : 'pointer',
                width: '100px',
              }}
            >
              {isLoading ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                </>
              ) : (
                'Submit'
              )}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
