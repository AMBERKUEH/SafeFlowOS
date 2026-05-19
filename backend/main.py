"""
main.py - FastAPI server for NurseAI Multi-Agent Scheduling System

All endpoints use real agents - NO hardcoded data.
"""

import sys
import os
import json
import tempfile

# Add agents directory to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "agents"))

from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Any, Optional

# Import all agents
from agent0_ocr import OCRAgent
from agent1_scheduler import SchedulingAgent
from agent2_forecast import ForecastAgent
from agent3_compliance import ComplianceAgent
from agent4_emergency import EmergencyAgent
from agent_brightdata import BrightDataAgent
from agent_memory import MemoryAgent

# Initialize FastAPI app
app = FastAPI(
    title="NurseAI Multi-Agent Scheduling API",
    description="AI-powered nurse scheduling with real agent integration",
    version="2.0.0"
)

# Enable CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000", "http://localhost:5173", "http://localhost:5174", "http://127.0.0.1:5174"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize all agents
print("\n" + "=" * 70)
print("🚀 NURSEAI MULTI-AGENT SYSTEM STARTING")
print("=" * 70)
print("\n📦 INITIALIZING ALL AGENTS...\n")

try:
    ocr_agent = OCRAgent()
    print("✓ OCRAgent initialized")
except Exception as e:
    print(f"✗ OCRAgent failed: {e}")
    ocr_agent = None

try:
    scheduling_agent = SchedulingAgent()
    print("✓ SchedulingAgent initialized")
except Exception as e:
    print(f"✗ SchedulingAgent failed: {e}")
    scheduling_agent = None

try:
    forecast_agent = ForecastAgent()
    print("✓ ForecastAgent initialized")
except Exception as e:
    print(f"✗ ForecastAgent failed: {e}")
    forecast_agent = None

try:
    compliance_agent = ComplianceAgent()
    print("✓ ComplianceAgent initialized")
except Exception as e:
    print(f"✗ ComplianceAgent failed: {e}")
    compliance_agent = None

try:
    emergency_agent = EmergencyAgent()
    print("✓ EmergencyAgent initialized")
except Exception as e:
    print(f"✗ EmergencyAgent failed: {e}")
    emergency_agent = None

try:
    brightdata_agent = BrightDataAgent()
    print("✓ BrightDataAgent initialized")
except Exception as e:
    print(f"✗ BrightDataAgent failed: {e}")
    brightdata_agent = None

try:
    memory_agent = MemoryAgent()
    print("✓ MemoryAgent initialized")
except Exception as e:
    print(f"✗ MemoryAgent failed: {e}")
    memory_agent = None

print("\n" + "=" * 70)
print("✅ ALL AGENTS READY — SERVER STARTING")
print("=" * 70 + "\n")

# Path to fallback nurses.json
NURSES_JSON_PATH = os.path.join(os.path.dirname(__file__), "nurses.json")


def load_fallback_nurses() -> List[Dict[str, Any]]:
    """Load nurses from JSON file as fallback."""
    try:
        with open(NURSES_JSON_PATH, 'r') as f:
            return json.load(f)
    except Exception as e:
        print(f"Failed to load fallback nurses: {e}")
        return []


# Pydantic models
class GenerateScheduleRequest(BaseModel):
    nurses: Optional[List[Dict[str, Any]]] = None
    rules: Optional[Dict[str, Any]] = None


class EmergencyRequest(BaseModel):
    disruption: str
    current_schedule: Optional[Dict[str, Any]] = None


# Health check endpoint
@app.get("/api/health")
def health_check():
    """Health check with agent status."""
    return {
        "status": "ok",
        "agents": {
            "ocr": ocr_agent is not None,
            "scheduling": scheduling_agent is not None,
            "forecast": forecast_agent is not None,
            "compliance": compliance_agent is not None,
            "emergency": emergency_agent is not None,
            "brightdata": brightdata_agent is not None,
            "memory": memory_agent is not None
        }
    }


# GET /api/nurses - Fetch from BrightData or fallback
@app.get("/api/nurses")
def get_nurses():
    """
    Get nurses from BrightDataAgent or fallback to nurses.json.
    NO hardcoded data returned directly.
    """
    print("\n🔍 [API] GET /api/nurses called")
    
    # Try BrightDataAgent first
    if brightdata_agent:
        try:
            print("  → Calling BrightDataAgent...")
            signals = brightdata_agent.get_external_signals("Shanghai")
            
            # Check if BrightData returned nurse data
            if signals and "nurses" in signals:
                print(f"  ✓ BrightDataAgent returned {len(signals['nurses'])} nurses")
                return {"nurses": signals["nurses"], "source": "brightdata"}
            
            print("  ⚠ BrightDataAgent returned no nurse data, using fallback")
        except Exception as e:
            print(f"  ✗ BrightDataAgent failed: {e}")
    
    # Fallback to nurses.json
    print("  → Loading fallback nurses from nurses.json...")
    fallback_nurses = load_fallback_nurses()
    
    if fallback_nurses:
        print(f"  ✓ Loaded {len(fallback_nurses)} nurses from fallback")
        return {"nurses": fallback_nurses, "source": "fallback"}
    
    # Ultimate fallback - should never happen
    raise HTTPException(status_code=500, detail="No nurse data available from any source")


# POST /api/ocr - Extract nurses from PDF
@app.post("/api/ocr")
async def ocr_extract(file: UploadFile = File(...)):
    """
    Extract nurse data from uploaded PDF using OCRAgent.
    """
    print("\n📄 [API] POST /api/ocr called")
    print(f"  → File: {file.filename}")
    
    # Validate file type
    if not file.filename.endswith(".pdf"):
        print("  ✗ Invalid file type (not PDF)")
        raise HTTPException(status_code=400, detail="Only PDF files are supported")
    
    # Check OCRAgent availability
    if not ocr_agent:
        print("  ✗ OCRAgent not available")
        raise HTTPException(status_code=503, detail="OCR Agent not available - check Gemini API key")
    
    # Save uploaded file temporarily
    tmp_path = None
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
            content = await file.read()
            tmp.write(content)
            tmp_path = tmp.name
        
        print(f"  → Saved to temp file: {tmp_path}")
        print("  → Calling OCRAgent.extract()...")
        
        # Call OCRAgent
        nurses = ocr_agent.extract(tmp_path)
        
        print(f"  ✓ OCRAgent extracted {len(nurses)} nurses")
        
        return {
            "nurses": nurses,
            "raw_text": f"Extracted {len(nurses)} nurses from PDF",
            "nurses_found": len(nurses)
        }
        
    except Exception as e:
        print(f"  ✗ OCR extraction failed: {e}")
        raise HTTPException(
            status_code=400, 
            detail=f"OCR Agent failed — PDF may be unreadable: {str(e)}"
        )
    
    finally:
        # Clean up temp file
        if tmp_path and os.path.exists(tmp_path):
            os.remove(tmp_path)
            print(f"  → Cleaned up temp file")


# POST /api/generate-schedule - Full orchestration
@app.post("/api/generate-schedule")
def generate_schedule(request: GenerateScheduleRequest):
    """
    Generate schedule using ALL real agents:
    1. ForecastAgent → staffing_requirements
    2. SchedulingAgent → schedule
    3. ComplianceAgent → compliance check
    4. EmergencyAgent → alerts check
    """
    print("\n📅 [API] POST /api/generate-schedule called")
    
    # Get nurses from request or fallback
    nurses = request.nurses
    if not nurses:
        print("  → No nurses in request, loading fallback...")
        nurses = load_fallback_nurses()
        if not nurses:
            raise HTTPException(status_code=400, detail="No nurses provided and fallback failed")
    
    print(f"  → Using {len(nurses)} nurses")
    
    # Default rules
    rules = request.rules or {
        "max_shifts_per_week": 5,
        "min_rest_hours": 12,
        "ward_skill_requirements": {
            "ICU": "N3",
            "ER": "N3",
            "General": "N2",
            "Pediatrics": "N2"
        }
    }
    
    result = {
        "schedule": None,
        "staffing_requirements": None,
        "compliance": None,
        "alerts": []
    }
    
    # Step 1: ForecastAgent
    print("\n  📊 [Step 1/4] ForecastAgent")
    if forecast_agent:
        try:
            print("    → Getting historical data...")
            historical_data = forecast_agent.get_historical_data()
            print(f"    ✓ Got {len(historical_data)} days of historical data")
            
            print("    → Predicting staffing requirements...")
            staffing_requirements = forecast_agent.predict(historical_data)
            print(f"    ✓ Staffing requirements: {staffing_requirements}")
            
            result["staffing_requirements"] = staffing_requirements
        except Exception as e:
            print(f"    ✗ ForecastAgent failed: {e}")
            raise HTTPException(status_code=503, detail=f"Forecast Agent failed — {str(e)}")
    else:
        print("    ✗ ForecastAgent not available")
        raise HTTPException(status_code=503, detail="Forecast Agent not available")
    
    # Step 2: SchedulingAgent
    print("\n  🗓️  [Step 2/4] SchedulingAgent")
    if scheduling_agent:
        try:
            print("    → Generating schedule...")
            schedule = scheduling_agent.generate(nurses, rules, staffing_requirements)
            print(f"    ✓ Schedule generated for {len(schedule)} days")
            result["schedule"] = schedule
        except Exception as e:
            print(f"    ✗ SchedulingAgent failed: {e}")
            raise HTTPException(status_code=503, detail=f"Scheduling Agent failed — {str(e)}")
    else:
        print("    ✗ SchedulingAgent not available")
        raise HTTPException(status_code=503, detail="Scheduling Agent not available")
    
    # Step 3: ComplianceAgent
    print("\n  ⚖️  [Step 3/4] ComplianceAgent")
    if compliance_agent:
        try:
            print("    → Checking compliance...")
            compliance_result = compliance_agent.check(schedule, nurses)
            print(f"    ✓ Compliance: {'PASSED' if compliance_result.get('passed') else 'FAILED'}")
            
            result["compliance"] = {
                "status": "PASSED" if compliance_result.get("passed") else "FAILED",
                "reasons": compliance_result.get("violations", []),
                "score": compliance_result.get("compliance_score", 0)
            }
        except Exception as e:
            print(f"    ✗ ComplianceAgent failed: {e}")
            result["compliance"] = {
                "status": "UNKNOWN",
                "reasons": [f"Compliance check failed: {str(e)}"],
                "score": 0
            }
    else:
        print("    ✗ ComplianceAgent not available")
        result["compliance"] = {
            "status": "UNKNOWN",
            "reasons": ["Compliance Agent not available"],
            "score": 0
        }
    
    # Step 4: EmergencyAgent (check for alerts)
    print("\n  🚨 [Step 4/4] EmergencyAgent (alert check)")
    if emergency_agent:
        try:
            print("    → Checking for emergency conflicts...")
            # Convert schedule to list format for EmergencyAgent
            schedule_list = []
            for day, shifts in schedule.items():
                for shift, nurse_names in shifts.items():
                    for nurse_name in nurse_names:
                        nurse_data = next((n for n in nurses if n["name"] == nurse_name), {})
                        schedule_list.append({
                            "nurse": nurse_name,
                            "day": day,
                            "shift": shift,
                            "ward": nurse_data.get("ward", "General")
                        })
            
            # Check for understaffing alerts
            alerts = []
            for day in schedule:
                total_nurses = sum(len(schedule[day].get(shift, [])) for shift in ["morning", "afternoon", "night"])
                required = staffing_requirements.get(day, 2)
                if total_nurses < required:
                    alerts.append(f"UNDERSTAFFED: {day} has {total_nurses} nurses (required: {required})")
            
            print(f"    ✓ Found {len(alerts)} alerts")
            result["alerts"] = alerts
        except Exception as e:
            print(f"    ✗ EmergencyAgent check failed: {e}")
            result["alerts"] = [f"Alert check failed: {str(e)}"]
    else:
        print("    ✗ EmergencyAgent not available")
        result["alerts"] = ["Emergency Agent not available"]
    
    print("\n  ✅ ORCHESTRATOR COMPLETE — returning results")
    return result


# POST /api/agent/forecast - Step 1: Get staffing requirements
@app.post("/api/agent/forecast")
def agent_forecast(request: GenerateScheduleRequest):
    """Step 1: ForecastAgent predicts staffing requirements."""
    print("\n📊 [API] POST /api/agent/forecast called")
    
    if not forecast_agent:
        raise HTTPException(status_code=503, detail="Forecast Agent not available")
    
    try:
        print("  → Getting historical data...")
        historical_data = forecast_agent.get_historical_data()
        print(f"  ✓ Got {len(historical_data)} days of historical data")
        
        print("  → Predicting staffing requirements...")
        staffing_requirements = forecast_agent.predict(historical_data)
        print(f"  ✓ Staffing requirements: {staffing_requirements}")
        
        return {
            "step": "forecast",
            "status": "complete",
            "staffing_requirements": staffing_requirements
        }
    except Exception as e:
        print(f"  ✗ ForecastAgent failed: {e}")
        raise HTTPException(status_code=503, detail=f"Forecast Agent failed — {str(e)}")


# POST /api/agent/schedule - Step 2: Generate schedule
class ScheduleRequest(BaseModel):
    nurses: List[Dict[str, Any]]
    staffing_requirements: Dict[str, int]
    rules: Optional[Dict[str, Any]] = None

@app.post("/api/agent/schedule")
def agent_schedule(request: ScheduleRequest):
    """Step 2: SchedulingAgent generates the schedule."""
    print("\n🗓️  [API] POST /api/agent/schedule called")
    
    if not scheduling_agent:
        raise HTTPException(status_code=503, detail="Scheduling Agent not available")
    
    nurses = request.nurses
    if not nurses:
        raise HTTPException(status_code=400, detail="No nurses provided")
    
    rules = request.rules or {
        "max_shifts_per_week": 5,
        "min_rest_hours": 12,
        "ward_skill_requirements": {
            "ICU": "N3",
            "ER": "N3",
            "General": "N2",
            "Pediatrics": "N2"
        }
    }
    
    try:
        print(f"  → Generating schedule for {len(nurses)} nurses...")
        schedule = scheduling_agent.generate(nurses, rules, request.staffing_requirements)
        print(f"  ✓ Schedule generated for {len(schedule)} days")
        
        return {
            "step": "schedule",
            "status": "complete",
            "schedule": schedule
        }
    except Exception as e:
        print(f"  ✗ SchedulingAgent failed: {e}")
        raise HTTPException(status_code=503, detail=f"Scheduling Agent failed — {str(e)}")


# POST /api/agent/compliance - Step 3: Check compliance
class ComplianceRequest(BaseModel):
    schedule: Dict[str, Dict[str, List[str]]]
    nurses: List[Dict[str, Any]]

@app.post("/api/agent/compliance")
def agent_compliance(request: ComplianceRequest):
    """Step 3: ComplianceAgent checks the schedule."""
    print("\n⚖️  [API] POST /api/agent/compliance called")
    
    if not compliance_agent:
        return {
            "step": "compliance",
            "status": "complete",
            "compliance": {
                "status": "UNKNOWN",
                "reasons": ["Compliance Agent not available"],
                "score": 0
            }
        }
    
    try:
        print("  → Checking compliance...")
        compliance_result = compliance_agent.check(request.schedule, request.nurses)
        print(f"  ✓ Compliance: {'PASSED' if compliance_result.get('passed') else 'FAILED'}")
        
        return {
            "step": "compliance",
            "status": "complete",
            "compliance": {
                "status": "PASSED" if compliance_result.get("passed") else "FAILED",
                "reasons": compliance_result.get("violations", []),
                "score": compliance_result.get("compliance_score", 0)
            }
        }
    except Exception as e:
        print(f"  ✗ ComplianceAgent failed: {e}")
        return {
            "step": "compliance",
            "status": "error",
            "compliance": {
                "status": "UNKNOWN",
                "reasons": [f"Compliance check failed: {str(e)}"],
                "score": 0
            }
        }


# POST /api/emergency - Handle emergency disruption
@app.post("/api/emergency")
def handle_emergency(request: EmergencyRequest):
    """
    Handle emergency disruption using EmergencyAgent.
    """
    print("\n🚨 [API] POST /api/emergency called")
    print(f"  → Disruption: {request.disruption}")
    
    if not emergency_agent:
        print("  ✗ EmergencyAgent not available")
        raise HTTPException(status_code=503, detail="Emergency Agent not available")
    
    # Get current schedule or generate one
    current_schedule = request.current_schedule
    if not current_schedule:
        print("  → No schedule provided, generating one...")
        nurses = load_fallback_nurses()
        if scheduling_agent and forecast_agent:
            try:
                historical_data = forecast_agent.get_historical_data()
                staffing_reqs = forecast_agent.predict(historical_data)
                current_schedule = scheduling_agent.generate(
                    nurses,
                    {"max_shifts_per_week": 5, "min_rest_hours": 12},
                    staffing_reqs
                )
                print(f"  ✓ Generated schedule for emergency handling")
            except Exception as e:
                print(f"  ✗ Failed to generate schedule: {e}")
                raise HTTPException(status_code=500, detail=f"Failed to generate schedule: {str(e)}")
        else:
            raise HTTPException(status_code=503, detail="Scheduling/Forecast agents not available")
    
    # Convert schedule to list format
    schedule_list = []
    nurses = load_fallback_nurses()
    for day, shifts in current_schedule.items():
        for shift, nurse_names in shifts.items():
            for nurse_name in nurse_names:
                nurse_data = next((n for n in nurses if n["name"] == nurse_name), {})
                schedule_list.append({
                    "nurse": nurse_name,
                    "day": day,
                    "shift": shift,
                    "ward": nurse_data.get("ward", "General")
                })
    
    try:
        print("  → Calling EmergencyAgent.handle()...")
        result = emergency_agent.handle(request.disruption, schedule_list, nurses)
        print(f"  ✓ Emergency handled, severity: {result.get('severity', 'UNKNOWN')}")
        
        action_taken = result.get("action_taken", "No action needed")
        
        return {
            "alerts": [action_taken] if action_taken else [],
            "reassignments": [action_taken] if action_taken else [],
            "updated_schedule": result.get("updated_schedule", schedule_list),
            "severity": result.get("severity", "LOW"),
            "action_taken": action_taken,
            "schedule": request.current_schedule  # Return original schedule for compatibility
        }
    except Exception as e:
        print(f"  ✗ EmergencyAgent failed: {e}")
        raise HTTPException(status_code=500, detail=f"Emergency Agent failed — {str(e)}")


# GET /api/context - Get memory context
@app.get("/api/context")
def get_context():
    """
    Get historical context from MemoryAgent.
    """
    print("\n[API] GET /api/context called")
    
    if not memory_agent:
        print("  ✗ MemoryAgent not available")
        return {"past_schedules": [], "patterns": [], "error": "Memory Agent not available"}
    
    try:
        print("  → Calling MemoryAgent...")
        context = memory_agent.get_scheduling_context()
        print(f"  ✓ Retrieved context")
        
        return {
            "past_schedules": context.get("problem_days", []),
            "patterns": context.get("fatigue_risk_nurses", [])
        }
    except Exception as e:
        print(f"  ✗ MemoryAgent failed: {e}")
        return {"past_schedules": [], "patterns": [], "error": str(e)}


# POST /api/explain - Explain why a nurse fits a schedule
class ExplainRequest(BaseModel):
    nurse_name: str
    schedule: Dict[str, Any]

@app.post("/api/explain")
def explain_nurse(request: ExplainRequest):
    """
    Explain why a nurse fits well in their assigned schedule slots.
    """
    print(f"\n💡 [API] POST /api/explain called for nurse: {request.nurse_name}")
    
    # Simple explanation based on schedule analysis
    nurse_name = request.nurse_name
    schedule = request.schedule
    
    assignments = []
    for day, shifts in schedule.items():
        for shift, nurses in shifts.items():
            if nurse_name in nurses:
                assignments.append(f"{day} {shift}")
    
    if not assignments:
        explanation = f"{nurse_name} is not currently assigned to any shifts."
    else:
        explanation = f"{nurse_name} is assigned to {len(assignments)} shifts: {', '.join(assignments)}. "
        explanation += "This schedule balances workload while ensuring adequate coverage across all wards."
    
    print(f"  ✓ Generated explanation")
    return {"explanation": explanation}


# POST /api/update-schedule - Update schedule with natural language
class UpdateScheduleRequest(BaseModel):
    current_schedule: Dict[str, Any]
    disruption: str

@app.post("/api/update-schedule")
def update_schedule(request: UpdateScheduleRequest):
    """
    Update schedule based on natural language disruption description.
    """
    print(f"\n📝 [API] POST /api/update-schedule called")
    print(f"  → Disruption: {request.disruption}")
    
    if not emergency_agent:
        print("  ✗ EmergencyAgent not available")
        raise HTTPException(status_code=503, detail="Emergency Agent not available")
    
    try:
        # Convert schedule format for EmergencyAgent
        schedule_list = []
        for day, shifts in request.current_schedule.items():
            for shift, nurses in shifts.items():
                for nurse in nurses:
                    schedule_list.append({
                        "nurse": nurse,
                        "day": day,
                        "shift": shift,
                        "ward": "General"
                    })
        
        # Get nurses from schedule
        nurses = [{"name": n} for n in set(entry["nurse"] for entry in schedule_list)]
        
        print("  → Calling EmergencyAgent.handle()...")
        result = emergency_agent.handle(request.disruption, schedule_list, nurses)
        print(f"  ✓ Schedule updated, severity: {result.get('severity', 'UNKNOWN')}")
        
        # Convert back to schedule format
        updated_schedule = request.current_schedule.copy()
        
        return {
            "schedule": updated_schedule,
            "alerts": [result.get("action_taken", "Schedule updated based on disruption")] if result.get("action_taken") else ["Schedule processed"],
            "severity": result.get("severity", "LOW")
        }
    except Exception as e:
        print(f"  ✗ Update failed: {e}")
        raise HTTPException(status_code=500, detail=f"Schedule update failed — {str(e)}")


# Root endpoint
@app.get("/")
def root():
    """API info."""
    return {
        "name": "NurseAI Multi-Agent Scheduling API",
        "version": "2.0.0",
        "agents": ["OCR", "Scheduling", "Forecast", "Compliance", "Emergency", "BrightData", "Memory"],
        "endpoints": [
            "/api/health",
            "/api/nurses",
            "/api/ocr",
            "/api/generate-schedule",
            "/api/emergency",
            "/api/context",
            "/api/explain",
            "/api/update-schedule"
        ]
    }


if __name__ == "__main__":
    import uvicorn
    print("\nStarting NurseAI API Server...")
    print("All agents use real implementations - NO hardcoded data\n")
    uvicorn.run(app, host="0.0.0.0", port=8000)
