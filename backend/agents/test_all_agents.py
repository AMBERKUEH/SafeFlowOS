"""
test_all_agents.py - Integration test for all 4 agents

Tests the complete orchestration pipeline:
1. ForecastAgent - Predicts staffing requirements
2. SchedulingAgent - Generates schedule
3. ComplianceAgent - Checks compliance
4. EmergencyAgent - Checks for emergency conflicts
"""

import sys
import os

# Add the agents directory to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from orchestrator import Orchestrator


def test_all_agents():
    """
    Test all 4 agents working together through the Orchestrator.
    """
    print("=" * 70)
    print("NURSEAI MULTI-AGENT SYSTEM - FULL INTEGRATION TEST")
    print("=" * 70)
    
    # Hardcoded nurses
    nurses = [
        {"name": "Zhang Wei", "skill": "N3", "ward": "ICU", "unavailable_days": ["Tuesday"]},
        {"name": "Li Na", "skill": "N2", "ward": "General", "unavailable_days": []},
        {"name": "Wang Fang", "skill": "N4", "ward": "ER", "unavailable_days": ["Friday"]},
        {"name": "Chen Jing", "skill": "N2", "ward": "Pediatrics", "unavailable_days": ["Wednesday"]},
        {"name": "Liu Yang", "skill": "N3", "ward": "ICU", "unavailable_days": []}
    ]
    
    # Scheduling rules
    rules = {
        "max_shifts_per_week": 5,
        "min_rest_hours": 12,
        "ward_skill_requirements": {
            "ICU": "N3",
            "ER": "N3",
            "General": "N2",
            "Pediatrics": "N2"
        }
    }
    
    print("\n👩‍⚕️ Nurses:")
    for nurse in nurses:
        unavailable = ", ".join(nurse["unavailable_days"]) if nurse["unavailable_days"] else "None"
        print(f"   • {nurse['name']} ({nurse['skill']}, {nurse['ward']}) - Unavailable: {unavailable}")
    
    print("\n📋 Rules:")
    print(f"   • Max shifts per week: {rules['max_shifts_per_week']}")
    print(f"   • Min rest hours: {rules['min_rest_hours']}")
    print(f"   • Ward skill requirements: {rules['ward_skill_requirements']}")
    
    # Create orchestrator and run
    print("\n" + "-" * 70)
    print("🚀 Running Orchestrator with all 4 agents...")
    print("-" * 70)
    
    try:
        orchestrator = Orchestrator()
        result = orchestrator.run(nurses, rules)
        
        # Check all outputs are non-empty
        schedule = result.get("schedule", {})
        staffing_requirements = result.get("staffing_requirements", {})
        compliance = result.get("compliance", {})
        alerts = result.get("alerts", [])
        
        print("\n" + "=" * 70)
        print("RESULTS")
        print("=" * 70)
        
        # 1. Staffing Requirements (ForecastAgent)
        print("\n📊 1. STAFFING REQUIREMENTS (ForecastAgent):")
        if staffing_requirements:
            for day, count in staffing_requirements.items():
                print(f"   {day:12s}: {count} nurses minimum")
        else:
            print("   ⚠️  EMPTY - ForecastAgent failed!")
        
        # 2. Generated Schedule (SchedulingAgent)
        print("\n📅 2. GENERATED SCHEDULE (SchedulingAgent):")
        if schedule:
            days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
            shifts = ["morning", "afternoon", "night"]
            for day in days:
                if day in schedule:
                    print(f"\n   {day}:")
                    for shift in shifts:
                        nurses_in_shift = schedule[day].get(shift, [])
                        nurse_list = ", ".join(nurses_in_shift) if nurses_in_shift else "(empty)"
                        print(f"      {shift:12s}: {nurse_list}")
        else:
            print("   ⚠️  EMPTY - SchedulingAgent failed!")
        
        # 3. Compliance Check (ComplianceAgent)
        print("\n✅ 3. COMPLIANCE CHECK (ComplianceAgent):")
        if compliance:
            status = compliance.get("status", "UNKNOWN")
            score = compliance.get("score", 0)
            reasons = compliance.get("reasons", [])
            
            status_icon = "✓" if status == "PASSED" else "✗"
            print(f"   Status: {status_icon} {status}")
            print(f"   Score: {score}%")
            
            if reasons:
                print("   Violations:")
                for reason in reasons:
                    print(f"      - {reason}")
            else:
                print("   No violations found!")
        else:
            print("   ⚠️  EMPTY - ComplianceAgent failed!")
        
        # 4. Alerts (EmergencyAgent)
        print("\n⚠️  4. ALERTS (EmergencyAgent):")
        if alerts:
            print(f"   Found {len(alerts)} alert(s):")
            for alert in alerts:
                print(f"      - {alert}")
        else:
            print("   No alerts - schedule looks good!")
        
        # Final verification
        print("\n" + "=" * 70)
        print("VERIFICATION")
        print("=" * 70)
        
        checks = [
            ("Staffing Requirements", bool(staffing_requirements)),
            ("Schedule", bool(schedule)),
            ("Compliance", bool(compliance)),
            ("Alerts (can be empty)", True)  # Alerts can be empty (no issues)
        ]
        
        all_passed = True
        for check_name, passed in checks:
            status = "✓ PASS" if passed else "✗ FAIL"
            print(f"   {status}: {check_name}")
            if not passed:
                all_passed = False
        
        print("\n" + "=" * 70)
        if all_passed and schedule and staffing_requirements and compliance:
            print("🎉 ALL AGENTS WORKING")
            print("=" * 70)
            return True
        else:
            print("❌ SOME AGENTS FAILED")
            print("=" * 70)
            return False
            
    except Exception as e:
        print(f"\n❌ ERROR: {e}")
        import traceback
        traceback.print_exc()
        print("\n" + "=" * 70)
        print("❌ TEST FAILED WITH EXCEPTION")
        print("=" * 70)
        return False


if __name__ == "__main__":
    success = test_all_agents()
    sys.exit(0 if success else 1)
