const API_BASE = "http://localhost:8000";

// Helper to show errors
const showError = (message: string) => {
  console.error(`[ERROR] ${message}`);
};

// GET /api/nurses - Fetch nurses from API (BrightData or fallback)
export async function fetchNurses(): Promise<{ nurses: any[]; source: string } | null> {
  try {
    const response = await fetch(`${API_BASE}/api/nurses`);
    
    if (!response.ok) {
      const error = await response.json();
      showError(`Failed to fetch nurses: ${error.detail || 'Unknown error'}`);
      return null;
    }
    
    return await response.json();
  } catch (err) {
    showError("Network error fetching nurses — check backend is running on port 8000");
    return null;
  }
}

// POST /api/ocr - Upload PDF and extract nurses
export async function uploadPDF(file: File): Promise<{ nurses: any[]; raw_text: string; nurses_found: number } | null> {
  const formData = new FormData();
  formData.append("file", file);

  try {
    const response = await fetch(`${API_BASE}/api/ocr`, {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json();
      showError(`OCR failed: ${error.detail || 'PDF may be unreadable'}`);
      return null;
    }

    return await response.json();
  } catch (err) {
    showError("Network error during OCR — check backend is running");
    return null;
  }
}

// POST /api/generate-schedule - Generate schedule with all agents
export async function generateSchedule(
  nurses: any[], 
  rules?: any
): Promise<{
  schedule: any;
  staffing_requirements: any;
  compliance: { 
    status: string; 
    reasons: string[]; 
    score: number;
    weekly_hours: Record<string, number>;
    overtime_risk: Array<{nurse: string; hours: number; status: string}>;
  };
  alerts: string[];
  fatigue_scores: Record<string, {score: number; shifts: number; night_shifts: number}>;
  agent_activity: Array<{agent: string; message: string; type: string}>;
} | null> {
  try {
    const body: any = { nurses };
    if (rules) body.rules = rules;

    const response = await fetch(`${API_BASE}/api/generate-schedule`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.json();
      const agentName = error.detail?.includes("Forecast") ? "Forecast Agent" :
                       error.detail?.includes("Scheduling") ? "Scheduling Agent" :
                       error.detail?.includes("Compliance") ? "Compliance Agent" :
                       "Schedule Generation";
      showError(`${agentName} failed — ${error.detail || 'Unknown error'}`);
      return null;
    }

    return await response.json();
  } catch (err) {
    showError("Network error during schedule generation — check backend is running");
    return null;
  }
}

// POST /api/agent/forecast - Step 1: Forecast Agent
export async function runForecastAgent(
  nurses: any[]
): Promise<{
  step: string;
  status: string;
  staffing_requirements: Record<string, number>;
} | null> {
  try {
    const response = await fetch(`${API_BASE}/api/agent/forecast`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nurses }),
    });

    if (!response.ok) {
      const error = await response.json();
      showError(`Forecast Agent failed — ${error.detail || 'Unknown error'}`);
      return null;
    }

    return await response.json();
  } catch (err) {
    showError("Network error during forecast — check backend is running");
    return null;
  }
}

// POST /api/agent/schedule - Step 2: Scheduling Agent
export async function runScheduleAgent(
  nurses: any[],
  staffingRequirements: Record<string, number>
): Promise<{
  step: string;
  status: string;
  schedule: any;
} | null> {
  try {
    const response = await fetch(`${API_BASE}/api/agent/schedule`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nurses, staffing_requirements: staffingRequirements }),
    });

    if (!response.ok) {
      const error = await response.json();
      showError(`Scheduling Agent failed — ${error.detail || 'Unknown error'}`);
      return null;
    }

    return await response.json();
  } catch (err) {
    showError("Network error during scheduling — check backend is running");
    return null;
  }
}

// POST /api/agent/compliance - Step 3: Compliance Agent
export async function runComplianceAgent(
  schedule: any,
  nurses: any[]
): Promise<{
  step: string;
  status: string;
  compliance: {
    status: string;
    reasons: string[];
    score: number;
  };
} | null> {
  try {
    const response = await fetch(`${API_BASE}/api/agent/compliance`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ schedule, nurses }),
    });

    if (!response.ok) {
      const error = await response.json();
      showError(`Compliance Agent failed — ${error.detail || 'Unknown error'}`);
      return null;
    }

    return await response.json();
  } catch (err) {
    showError("Network error during compliance check — check backend is running");
    return null;
  }
}

// POST /api/emergency - Handle emergency disruption
export async function handleEmergency(
  disruption: string,
  currentSchedule?: any
): Promise<{
  alerts: string[];
  reassignments: string[];
  updated_schedule: any;
  severity: string;
  action_taken: string;
} | null> {
  try {
    const body: any = { disruption };
    if (currentSchedule) body.current_schedule = currentSchedule;

    const response = await fetch(`${API_BASE}/api/emergency`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.json();
      showError(`Emergency Agent failed — ${error.detail || 'Unknown error'}`);
      return null;
    }

    return await response.json();
  } catch (err) {
    showError("Network error during emergency handling — check backend is running");
    return null;
  }
}

// GET /api/context - Get memory context
export async function fetchContext(): Promise<{
  past_schedules: any[];
  patterns: any[];
  error?: string;
} | null> {
  try {
    const response = await fetch(`${API_BASE}/api/context`);
    
    if (!response.ok) {
      const error = await response.json();
      showError(`Failed to fetch context: ${error.detail || 'Unknown error'}`);
      return null;
    }
    
    return await response.json();
  } catch (err) {
    showError("Network error fetching context — check backend is running");
    return null;
  }
}

// GET /api/health - Health check
export async function healthCheck(): Promise<{ status: string; agents: any } | null> {
  try {
    const response = await fetch(`${API_BASE}/api/health`);
    
    if (!response.ok) {
      return null;
    }
    
    return await response.json();
  } catch (err) {
    return null;
  }
}

// POST /api/explain - Explain nurse schedule fit
export async function explainNurse(
  nurseName: string,
  schedule: any
): Promise<{ explanation: string } | null> {
  try {
    const response = await fetch(`${API_BASE}/api/explain`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nurse_name: nurseName, schedule })
    });

    if (!response.ok) {
      const error = await response.json();
      showError(`Explain nurse failed: ${error.detail || 'Unknown error'}`);
      return null;
    }

    return await response.json();
  } catch (err) {
    showError('Network error during nurse explanation — check backend is running');
    return null;
  }
}

// POST /api/update-schedule - Update schedule with emergency/natural language
export async function updateSchedule(
  currentSchedule: any,
  disruption: string
): Promise<{ 
  schedule: any; 
  alerts: string[]; 
  action_taken: string;
  severity: string;
  updated_schedule: any;
} | null> {
  try {
    const response = await fetch(`${API_BASE}/api/update-schedule`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ current_schedule: currentSchedule, disruption })
    });

    if (!response.ok) {
      const error = await response.json();
      showError(`Update schedule failed: ${error.detail || 'Unknown error'}`);
      return null;
    }

    return await response.json();
  } catch (err) {
    showError('Network error during schedule update — check backend is running');
    return null;
  }
}
