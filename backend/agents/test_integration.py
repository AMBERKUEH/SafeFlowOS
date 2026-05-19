"""
test_integration.py - Integration test for ForecastAgent + SchedulingAgent

Tests the full pipeline:
1. ForecastAgent generates historical patient data
2. ForecastAgent predicts staffing requirements
3. SchedulingAgent generates schedule using those requirements
"""

import sys
import os

# Add the agents directory to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from agent1_scheduler import SchedulingAgent
from agent2_forecast import ForecastAgent


def test_integration():
    """
    Test the integration between ForecastAgent and SchedulingAgent.
    """
    print("=" * 70)
    print("NURSE SCHEDULING SYSTEM - INTEGRATION TEST")
    print("=" * 70)
    
    # Step 1: Initialize ForecastAgent
    print("\n📊 Step 1: Initializing ForecastAgent...")
    forecast_agent = ForecastAgent()
    print("   ✓ ForecastAgent ready")
    
    # Step 2: Get historical data
    print("\n📈 Step 2: Generating 30 days of historical patient data...")
    historical_data = forecast_agent.get_historical_data()
    print(f"   ✓ Generated {len(historical_data)} days of data")
    
    # Show sample
    print("\n   Sample data (first 5 days):")
    for record in historical_data[:5]:
        spike = " 🔥 SPIKE!" if record["patient_count"] > 150 else ""
        print(f"     {record['date']} ({record['day_of_week'][:3]}): "
              f"{record['patient_count']} patients{spike}")
    
    # Step 3: Predict staffing requirements
    print("\n🎯 Step 3: Predicting staffing requirements...")
    staffing_requirements = forecast_agent.predict(historical_data)
    
    print("\n   📋 FORECAST OUTPUT (Minimum Nurses Per Day):")
    print("   " + "-" * 50)
    for day, nurses in staffing_requirements.items():
        day_records = [r for r in historical_data if r["day_of_week"] == day]
        avg = sum(r["patient_count"] for r in day_records) / len(day_records)
        print(f"   {day:12s}: {nurses} nurses (avg {avg:.1f} patients)")
    print("   " + "-" * 50)
    
    # Step 4: Initialize SchedulingAgent
    print("\n📅 Step 4: Initializing SchedulingAgent...")
    scheduler = SchedulingAgent()
    print("   ✓ SchedulingAgent ready")
    
    # Step 5: Define nurses
    print("\n👩‍⚕️ Step 5: Defining nurse pool...")
    nurses = [
        {"name": "Zhang Wei", "skill": "N3", "ward": "ICU", "unavailable_days": ["Tuesday"]},
        {"name": "Li Na", "skill": "N2", "ward": "General", "unavailable_days": []},
        {"name": "Wang Fang", "skill": "N4", "ward": "ER", "unavailable_days": ["Friday"]},
        {"name": "Chen Jing", "skill": "N2", "ward": "Pediatrics", "unavailable_days": ["Wednesday"]},
        {"name": "Liu Yang", "skill": "N3", "ward": "ICU", "unavailable_days": []}
    ]
    print(f"   ✓ Loaded {len(nurses)} nurses")
    for nurse in nurses:
        unavailable = ", ".join(nurse["unavailable_days"]) if nurse["unavailable_days"] else "None"
        print(f"     • {nurse['name']} ({nurse['skill']}, {nurse['ward']}) - Unavailable: {unavailable}")
    
    # Step 6: Define rules
    print("\n📋 Step 6: Defining scheduling rules...")
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
    print(f"   ✓ Max shifts per week: {rules['max_shifts_per_week']}")
    print(f"   ✓ Min rest hours: {rules['min_rest_hours']}")
    print(f"   ✓ Ward skill requirements: {rules['ward_skill_requirements']}")
    
    # Step 7: Generate schedule
    print("\n🗓️  Step 7: Generating schedule with forecast constraints...")
    print("   (Using staffing requirements as minimum nurses per day)")
    
    try:
        schedule = scheduler.generate(nurses, rules, staffing_requirements)
        
        print("\n   ✅ SCHEDULE GENERATED SUCCESSFULLY!")
        print("\n   " + "=" * 50)
        print("   FINAL SCHEDULE:")
        print("   " + "=" * 50)
        
        days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
        shifts = ["morning", "afternoon", "night"]
        
        for day in days:
            print(f"\n   📅 {day.upper()}")
            print(f"   Required min nurses: {staffing_requirements.get(day, 2)}")
            
            if day in schedule:
                for shift in shifts:
                    nurses_in_shift = schedule[day].get(shift, [])
                    nurse_list = ", ".join(nurses_in_shift) if nurses_in_shift else "(empty)"
                    print(f"     {shift.capitalize():12s}: {nurse_list}")
            else:
                print("     (No schedule data)")
        
        print("\n   " + "=" * 50)
        
        # Step 8: Verify schedule meets requirements
        print("\n✅ Step 8: Verifying schedule meets forecast requirements...")
        all_requirements_met = True
        
        for day in days:
            if day in schedule:
                total_nurses = sum(len(schedule[day].get(shift, [])) for shift in shifts)
                required = staffing_requirements.get(day, 2)
                
                # Note: This counts total nurses across all shifts, not per shift
                # A more sophisticated check would verify per-shift coverage
                status = "✓" if total_nurses >= required else "✗"
                print(f"   {status} {day}: {total_nurses} total nurses (required: {required})")
                
                if total_nurses < required:
                    all_requirements_met = False
        
        print("\n" + "=" * 70)
        if all_requirements_met:
            print("🎉 SUCCESS: All forecast requirements met!")
        else:
            print("⚠️  WARNING: Some days may be understaffed")
        print("=" * 70)
        
        return True
        
    except Exception as e:
        print(f"\n   ❌ ERROR generating schedule: {e}")
        print("\n" + "=" * 70)
        print("FAILED: Integration test failed")
        print("=" * 70)
        import traceback
        traceback.print_exc()
        return False


if __name__ == "__main__":
    success = test_integration()
    sys.exit(0 if success else 1)
