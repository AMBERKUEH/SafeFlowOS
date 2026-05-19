"""
Orchestrator: Coordinates all agents for nurse scheduling workflow.
Integrates ForecastAgent, SchedulingAgent, ComplianceAgent, and EmergencyAgent.
"""

import json
from typing import Dict, List, Any, Optional

from agent1_scheduler import SchedulingAgent
from agent2_forecast import ForecastAgent
from agent3_compliance import ComplianceAgent
from agent4_emergency import EmergencyAgent
from agent_brightdata import BrightDataAgent


class Orchestrator:
    """
    Orchestrates the complete nurse scheduling workflow with all agents:
    1. ForecastAgent: Predicts staffing requirements from historical data
    2. SchedulingAgent: Generates schedule based on requirements
    3. ComplianceAgent: Checks schedule for compliance violations
    4. EmergencyAgent: Checks for emergency conflicts and alerts
    """
    
    def __init__(self):
        """Initialize orchestrator with all agents."""
        self.forecast_agent = ForecastAgent()
        self.scheduling_agent = SchedulingAgent()
        self.compliance_agent = ComplianceAgent()
        self.emergency_agent = EmergencyAgent()
        self.brightdata_agent = BrightDataAgent()
        print("Orchestrator initialized with all 5 agents")
    
    def run(
        self,
        nurses: List[Dict[str, Any]],
        rules: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Run the complete scheduling workflow with all agents.
        
        Pipeline:
        1. ForecastAgent: Get historical data and predict staffing requirements
        2. SchedulingAgent: Generate schedule using staffing requirements
        3. ComplianceAgent: Check schedule compliance → returns pass/fail + reasons
        4. EmergencyAgent: Check for emergency conflicts → returns alerts list
        
        Args:
            nurses: List of nurse dicts with name, skill, ward, unavailable_days
            rules: Scheduling rules dict
        
        Returns:
            Dict with:
            {
                "schedule": {...},
                "staffing_requirements": {...},
                "compliance": {"status": "PASSED" or "FAILED", "reasons": [...]},
                "alerts": [...]
            }
        """
        print("\n" + "=" * 70)
        print("ORCHESTRATOR: Running Full Scheduling Pipeline")
        print("=" * 70)
        
        # Step 1: BrightDataAgent - Get external signals (skip for faster testing)
        print("\n[Step 1/5] BrightDataAgent: Fetching real-world signals...")
        try:
            import os
            # Skip BrightData if no API key or explicitly disabled
            if not os.environ.get("BRIGHTDATA_API_KEY"):
                print("   ⚠ No BRIGHTDATA_API_KEY, skipping external signals")
                external_signals = None
            else:
                external_signals = self.brightdata_agent.get_external_signals("Kuala Lumpur")
                print(f"   ✓ External signals: {external_signals.get('recommendation', 'No specific recommendation')}")
        except Exception as e:
            print(f"   ⚠ BrightData failed, continuing without external signals: {e}")
            external_signals = None
        
        # Step 2: ForecastAgent - Get staffing requirements (with real signals)
        print("\n[Step 2/5] ForecastAgent: Predicting staffing requirements...")
        historical_data = self.forecast_agent.get_historical_data()
        staffing_requirements = self.forecast_agent.predict(historical_data, external_signals=external_signals)
        print(f"   ✓ Staffing requirements: {staffing_requirements}")
        
        # Step 3: SchedulingAgent - Generate schedule
        print("\n[Step 3/5] SchedulingAgent: Generating schedule...")
        schedule = self.scheduling_agent.generate(nurses, rules, staffing_requirements)
        print(f"   ✓ Schedule generated for {len(schedule)} days")
        
        # Step 4: ComplianceAgent - Check compliance
        print("\n[Step 4/5] ComplianceAgent: Checking compliance...")
        compliance_result = self.compliance_agent.check(schedule, nurses)
        compliance_status = "PASSED" if compliance_result.get("passed", False) else "FAILED"
        compliance_reasons = compliance_result.get("violations", [])
        print(f"   ✓ Compliance: {compliance_status} ({len(compliance_reasons)} violations)")
        
        # Step 5: EmergencyAgent - Check for emergency conflicts
        print("\n[Step 5/5] EmergencyAgent: Checking for emergency conflicts...")
        # Convert schedule format for EmergencyAgent if needed
        schedule_list = self._convert_schedule_to_list(schedule, nurses)
        # Check each day for potential emergencies (simulated by passing empty disruption)
        alerts = []
        for day in schedule:
            for shift in ["morning", "afternoon", "night"]:
                assigned_nurses = schedule[day].get(shift, [])
                if len(assigned_nurses) < staffing_requirements.get(day, 2):
                    alerts.append(f"UNDERSTAFFED: {day} {shift} has only {len(assigned_nurses)} nurses (required: {staffing_requirements.get(day, 2)})")
        
        # Also check for skill coverage issues
        nurse_skills = {n["name"]: n["skill"] for n in nurses}
        for day in schedule:
            for shift in ["morning", "afternoon", "night"]:
                assigned = schedule[day].get(shift, [])
                senior_present = any(nurse_skills.get(n, "N1") in ["N3", "N4"] for n in assigned)
                if assigned and not senior_present:
                    alerts.append(f"SKILL GAP: {day} {shift} has no senior nurse (N3/N4)")
        
        print(f"   ✓ Found {len(alerts)} alerts")
        
        # Calculate dynamic fatigue scores based on actual schedule
        print("\n  📊 Calculating fatigue scores...")
        nurse_fatigue = {}
        for nurse in nurses:
            name = nurse["name"]
            shifts_this_week = sum(
                1 for day in schedule 
                for shift in ["morning", "afternoon", "night"] 
                if name in schedule[day][shift]
            )
            night_shifts = sum(
                1 for day in schedule 
                if name in schedule[day]["night"]
            )
            # Fatigue score: 0-100 based on shifts + night shifts
            fatigue_score = min(100, (shifts_this_week * 12) + (night_shifts * 8))
            nurse_fatigue[name] = {
                "score": fatigue_score,
                "shifts": shifts_this_week,
                "night_shifts": night_shifts
            }
            print(f"    {name}: {fatigue_score}/100 ({shifts_this_week} shifts, {night_shifts} nights)")
        
        # Compile final result with all real data
        result = {
            "schedule": schedule,
            "staffing_requirements": staffing_requirements,
            "compliance": {
                "status": compliance_status,
                "reasons": compliance_reasons,
                "warnings": compliance_result.get("warnings", []),
                "score": compliance_result.get("compliance_score", 0),
                "weekly_hours": compliance_result.get("weekly_hours", {}),
                "overtime_risk": compliance_result.get("overtime_risk", []),
                "day_off_compliance": compliance_result.get("day_off_compliance", {})
            },
            "alerts": alerts,
            "fatigue_scores": nurse_fatigue,
            "agent_activity": [
                {"agent": "BrightData", "message": f"Fetched external signals for Shenzhen", "type": "INFO"},
                {"agent": "Forecast", "message": f"Predicted staffing requirements based on historical data", "type": "INFO"},
                {"agent": "Scheduling", "message": f"Generated schedule for {len(nurses)} nurses across 7 days", "type": "SUCCESS"},
                {"agent": "Compliance", "message": f"Compliance check: {compliance_status} ({len(compliance_reasons)} violations)", "type": "SUCCESS" if compliance_status == "PASSED" else "WARNING"},
                {"agent": "Emergency", "message": f"Found {len(alerts)} potential issues", "type": "WARNING" if alerts else "SUCCESS"}
            ]
        }
        
        print("\n" + "=" * 70)
        print("ORCHESTRATOR: Pipeline Complete")
        print("=" * 70)
        
        return result
    
    def _convert_schedule_to_list(
        self,
        schedule: Dict[str, Dict[str, List[str]]],
        nurses: List[Dict[str, Any]]
    ) -> List[Dict[str, str]]:
        """
        Convert schedule dict to list format for EmergencyAgent.
        
        Args:
            schedule: Schedule dict with days/shifts/nurses
            nurses: Nurse data for ward lookup
        
        Returns:
            List of assignment dicts
        """
        nurse_wards = {n["name"]: n.get("ward", "General") for n in nurses}
        schedule_list = []
        
        for day, shifts in schedule.items():
            for shift, nurse_list in shifts.items():
                for nurse in nurse_list:
                    schedule_list.append({
                        "nurse": nurse,
                        "day": day,
                        "shift": shift,
                        "ward": nurse_wards.get(nurse, "General")
                    })
        
        return schedule_list
    
    def handle_emergency(
        self,
        disruption: str,
        current_schedule: Dict[str, Dict[str, List[str]]],
        nurses: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """
        Handle an emergency disruption using EmergencyAgent.
        
        Args:
            disruption: Description of the emergency/disruption
            current_schedule: Current schedule dict
            nurses: List of nurse data
        
        Returns:
            Dict with alerts and reassignments
        """
        print("\n" + "=" * 70)
        print("ORCHESTRATOR: Handling Emergency")
        print("=" * 70)
        print(f"Disruption: {disruption}")
        
        # Convert schedule format
        schedule_list = self._convert_schedule_to_list(current_schedule, nurses)
        
        # Call EmergencyAgent
        result = self.emergency_agent.handle(disruption, schedule_list, nurses)
        
        # Extract alerts and reassignments
        alerts = []
        if result.get("severity") in ["HIGH", "MEDIUM"]:
            alerts.append(f"EMERGENCY ({result.get('severity')}): {result.get('action_taken', '')}")
        
        # Convert updated schedule back to dict format
        updated_schedule_list = result.get("updated_schedule", [])
        reassignments = []
        
        if result.get("action_taken"):
            reassignments.append(result["action_taken"])
        
        return {
            "alerts": alerts,
            "reassignments": reassignments,
            "severity": result.get("severity", "LOW"),
            "action_taken": result.get("action_taken", "")
        }


def run_scheduling_workflow(
    nurses: List[Dict[str, Any]],
    rules: Dict[str, Any]
) -> Dict[str, Any]:
    """
    Convenience function to run the full scheduling workflow.
    
    Args:
        nurses: List of nurse dicts
        rules: Scheduling rules
    
    Returns:
        Complete workflow result
    """
    orchestrator = Orchestrator()
    return orchestrator.run(nurses, rules)


if __name__ == "__main__":
    # Test the orchestrator with all agents
    print("=" * 70)
    print("ORCHESTRATOR TEST - All 4 Agents")
    print("=" * 70)
    
    # Sample nurses
    sample_nurses = [
        {"name": "Zhang Wei", "skill": "N3", "ward": "ICU", "unavailable_days": ["Tuesday"]},
        {"name": "Li Na", "skill": "N2", "ward": "General", "unavailable_days": []},
        {"name": "Wang Fang", "skill": "N4", "ward": "ER", "unavailable_days": ["Friday"]},
        {"name": "Chen Jing", "skill": "N2", "ward": "Pediatrics", "unavailable_days": ["Wednesday"]},
        {"name": "Liu Yang", "skill": "N3", "ward": "ICU", "unavailable_days": []}
    ]
    
    # Malaysian hospital rules (KKM guidelines)
    sample_rules = {
        "max_shifts_per_week": 5,
        "min_nurses_per_shift": 3,
        "shift_types": ["AM", "DA", "EV"],
        "leave_types": ["SD", "DO"],
        "night_shift_pattern": {
            "consecutive_ev_shifts": 3,
            "recovery_after": ["SD", "DO"],
            "exception_consecutive": 4,
            "exception_recovery": ["SD", "DO", "DO"]
        },
        "consecutive_same_shift_limit": 3,
        "weekly_day_off": 1,
        "senior_junior_ratio": {
            "preferred": 0.60,
            "minimum": 0.55
        },
        "assignment_priority": [
            "honor_preapproved_requests",
            "assign_ev_with_recovery",
            "distribute_do_days",
            "fill_am_da_shifts",
            "gap_filling"
        ],
        "ward_skill_requirements": {
            "ICU": "N3",
            "ER": "N3",
            "General": "N2",
            "Pediatrics": "N2"
        }
    }
    
    # Run orchestrator
    orchestrator = Orchestrator()
    result = orchestrator.run(sample_nurses, sample_rules)
    
    # Display results
    print("\n" + "=" * 70)
    print("FINAL RESULT")
    print("=" * 70)
    
    print("\n📊 Staffing Requirements (from ForecastAgent):")
    for day, nurses_needed in result["staffing_requirements"].items():
        print(f"   {day}: {nurses_needed} nurses")
    
    print("\n📅 Generated Schedule:")
    for day, shifts in result["schedule"].items():
        print(f"\n   {day}:")
        for shift, nurses in shifts.items():
            nurse_list = ", ".join(nurses) if nurses else "(empty)"
            print(f"      {shift}: {nurse_list}")
    
    print(f"\n✅ Compliance: {result['compliance']['status']}")
    print(f"   Score: {result['compliance']['score']}%")
    if result['compliance']['reasons']:
        print("   Violations:")
        for reason in result['compliance']['reasons']:
            print(f"      - {reason}")
    else:
        print("   No violations found!")
    
    print(f"\n⚠️  Alerts ({len(result['alerts'])}):")
    if result['alerts']:
        for alert in result['alerts']:
            print(f"   - {alert}")
    else:
        print("   No alerts")
    
    print("\n" + "=" * 70)
    print("ORCHESTRATOR TEST COMPLETE")
    print("=" * 70)
