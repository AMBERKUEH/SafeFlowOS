"""
Agent 3: Compliance Agent
Checks schedule compliance using Groq API.
"""

from dotenv import load_dotenv
import os
import json
from typing import Dict, List, Any

load_dotenv()


def call_llm(prompt: str) -> str:
    """Call Groq API with the given prompt."""
    try:
        from groq import Groq
    except ImportError:
        raise ImportError("groq not installed. Run: pip install groq")
    
    api_key = os.environ.get("GROQ_API_KEY")
    if not api_key:
        raise ValueError("GROQ_API_KEY environment variable not set.")
    
    client = Groq(api_key=api_key)
    
    response = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[
            {"role": "system", "content": "You are a hospital scheduling compliance expert."},
            {"role": "user", "content": prompt}
        ],
        temperature=0.3,
        max_tokens=1024
    )
    
    return response.choices[0].message.content


class ComplianceAgent:
    """Checks schedule for compliance violations."""

    def check(self, schedule, nurses):
        """Check schedule compliance with Malaysian hospital rostering rules."""
        violations = []
        warnings = []
        total_rules = 12

        # Map shift types: AM=morning, DA=afternoon, EV=night
        SHIFT_MAP = {"morning": "AM", "afternoon": "DA", "night": "EV"}
        SHIFT_HOURS = {"morning": 8, "afternoon": 8, "night": 8}
        MAX_WEEKLY_HOURS = 40
        
        days = list(schedule.keys())
        nurse_skills = {n["name"]: n["skill"] for n in nurses}
        all_nurse_names = [n["name"] for n in nurses]
        
        # Track data structures
        weekly_hours = {n: 0 for n in all_nurse_names}
        day_off_compliance = {n: True for n in all_nurse_names}  # Start True, set False if working
        nurse_shifts_by_day = {n: {} for n in all_nurse_names}  # {nurse: {day_index: shift_type}}
        
        # Build nurse schedule tracking
        for d_index, day in enumerate(days):
            for shift in ["morning", "afternoon", "night"]:
                assigned = schedule[day][shift]
                
                # Rule 6: Minimum 3 nurses per shift
                if len(assigned) < 3:
                    violations.append(f"{day} {shift} has only {len(assigned)} nurses — minimum 3 required")
                
                for nurse in assigned:
                    # Track weekly hours
                    weekly_hours[nurse] += SHIFT_HOURS[shift]
                    
                    # Track shifts by day for pattern checking
                    if d_index not in nurse_shifts_by_day[nurse]:
                        nurse_shifts_by_day[nurse][d_index] = []
                    nurse_shifts_by_day[nurse][d_index].append(shift)
                    
                    # Mark as working this day (not a day off)
                    day_off_compliance[nurse] = False
        
        # Rule 1: NIGHT SHIFT PATTERN (EV shifts)
        # Pattern A (normal): exactly 3 consecutive EV → followed by 1 SD + 1 DO
        # Pattern B (exception): exactly 4 consecutive EV → followed by 1 SD + 2 DO
        for nurse in all_nurse_names:
            night_days = sorted([d for d, shifts in nurse_shifts_by_day[nurse].items() 
                                if "night" in shifts])
            
            if night_days:
                # Check for consecutive night patterns
                i = 0
                while i < len(night_days):
                    # Find consecutive night streak
                    streak_start = i
                    streak_len = 1
                    while i + 1 < len(night_days) and night_days[i + 1] == night_days[i] + 1:
                        streak_len += 1
                        i += 1
                    
                    last_night_day = night_days[streak_start + streak_len - 1]
                    
                    # Pattern A: exactly 3 consecutive EV shifts
                    if streak_len == 3:
                        # Check next 2 days are SD (no shifts) then DO (no shifts)
                        day_after_nights = last_night_day + 1
                        two_days_after = last_night_day + 2
                        
                        # SD = sleeping day (no shifts assigned)
                        has_sd = (day_after_nights < len(days) and 
                                  len(nurse_shifts_by_day[nurse].get(day_after_nights, [])) == 0)
                        # DO = day off (no shifts assigned)  
                        has_do = (two_days_after < len(days) and 
                                  len(nurse_shifts_by_day[nurse].get(two_days_after, [])) == 0)
                        
                        if not (has_sd and has_do):
                            violations.append(f"{nurse} missing mandatory SD+DO recovery after 3 EV shifts")
                    
                    # Pattern B: exactly 4 consecutive EV shifts (exception)
                    elif streak_len == 4:
                        # Check next 3 days are SD, DO, DO
                        day1_after = last_night_day + 1  # Should be SD
                        day2_after = last_night_day + 2  # Should be DO
                        day3_after = last_night_day + 3  # Should be DO
                        
                        has_sd = (day1_after < len(days) and 
                                  len(nurse_shifts_by_day[nurse].get(day1_after, [])) == 0)
                        has_do1 = (day2_after < len(days) and 
                                   len(nurse_shifts_by_day[nurse].get(day2_after, [])) == 0)
                        has_do2 = (day3_after < len(days) and 
                                   len(nurse_shifts_by_day[nurse].get(day3_after, [])) == 0)
                        
                        if not (has_sd and has_do1 and has_do2):
                            violations.append(f"{nurse} missing mandatory SD+DO+DO recovery after 4 EV exception shifts")
                    
                    # Invalid pattern: any other number of consecutive EV shifts
                    elif streak_len > 0:
                        violations.append(
                            f"{nurse} has {streak_len} consecutive EV shifts — must be exactly 3 "
                            f"(standard) or 4 (exception only)"
                        )
                    
                    i += 1
        
        # Rule 2: WEEKLY DAY OFF (DO)
        # Every nurse must have exactly 1 DO per week
        for nurse in all_nurse_names:
            working_days = len([d for d in range(len(days)) 
                               if len(nurse_shifts_by_day[nurse].get(d, [])) > 0])
            if working_days == 7:
                violations.append(f"{nurse} has no DO (day off) this week — violates Malaysian labour requirements")
                day_off_compliance[nurse] = False
            elif working_days == 6:
                day_off_compliance[nurse] = True  # Has exactly 1 day off
        
        # Rule 3: SAME SHIFT CONSECUTIVE LIMIT
        # No more than 3 consecutive AM or DA shifts
        for nurse in all_nurse_names:
            for shift_type in ["morning", "afternoon"]:
                shift_days = sorted([d for d, shifts in nurse_shifts_by_day[nurse].items() 
                                    if shift_type in shifts])
                
                if len(shift_days) >= 3:
                    # Check for more than 3 consecutive
                    streak = 1
                    for i in range(1, len(shift_days)):
                        if shift_days[i] == shift_days[i-1] + 1:
                            streak += 1
                            if streak > 3:
                                shift_label = "AM" if shift_type == "morning" else "DA"
                                violations.append(f"{nurse} exceeds 3 consecutive {shift_label} shifts")
                                break
                        else:
                            streak = 1
        
        # Rule 4: SENIOR/JUNIOR RATIO (minimum 55% senior N3/N4)
        for day in days:
            for shift in ["morning", "afternoon", "night"]:
                assigned = schedule[day][shift]
                if len(assigned) > 0:
                    senior_count = sum(1 for n in assigned if nurse_skills.get(n) in ["N3", "N4"])
                    senior_pct = (senior_count / len(assigned)) * 100
                    
                    if senior_pct < 55:
                        violations.append(f"{day} {shift} has only {senior_pct:.0f}% senior nurses — minimum 55% required")
        
        # Rule 5: WEEKLY HOURS (max 40)
        overtime_risk = []
        for nurse, hours in weekly_hours.items():
            if hours > MAX_WEEKLY_HOURS:
                violations.append(f"{nurse} works {hours}hrs this week — exceeds 40hr limit")
                overtime_risk.append(nurse)
            elif hours > 36:
                warnings.append(f"{nurse} at {hours}hrs — approaching 40hr limit")
                overtime_risk.append(nurse)
        
        # Remove duplicates while preserving order
        violations = list(dict.fromkeys(violations))
        warnings = list(dict.fromkeys(warnings))
        
        passed = len(violations) == 0
        score = max(0, int((1 - len(violations) / total_rules) * 100))

        return {
            "passed": passed,
            "violations": violations,
            "warnings": warnings,
            "compliance_score": score,
            "weekly_hours": weekly_hours,
            "overtime_risk": overtime_risk,
            "day_off_compliance": day_off_compliance
        }

    def suggest_fix(self, violation):
        """Suggest a fix for a violation using Groq."""
        try:
            prompt = f"""
You are a hospital scheduling compliance expert.

Give a one sentence fix for this schedule violation:
{violation}

Respond with ONLY the fix suggestion, no explanation."""

            response = call_llm(prompt)
            return response.strip()
        except Exception as e:
            print(f"Groq suggestion failed: {e}")
            # Fallback suggestions
            if "less than 2 nurses" in violation:
                return "Add more nurses to this shift to meet minimum staffing requirements."
            elif "not qualified" in violation:
                return "Replace with a nurse who has the required skill level (N3 or higher)."
            elif "consecutive nights" in violation:
                return "Give the nurse a day off after night shifts to ensure adequate rest."
            elif "night then morning" in violation:
                return "Ensure 12-hour rest period between night shift and next morning shift."
            elif "too many night shifts" in violation:
                return "Redistribute night shifts among more nurses to balance workload."
            elif "no senior nurse" in violation:
                return "Assign at least one N3 or N4 nurse to supervise this shift."
            else:
                return "Review and adjust the schedule to resolve this violation."


# Test run
if __name__ == "__main__":
    nurses = [
        {"name": "Zhang Wei", "skill": "N3"},
        {"name": "Li Mei", "skill": "N2"},
        {"name": "Arun", "skill": "N4"},
        {"name": "Sara", "skill": "N1"}
    ]

    schedule = {
        "Monday": {
            "morning": ["Zhang Wei"],  # only 1 nurse
            "afternoon": ["Sara", "Li Mei"],
            "night": ["Sara", "Sara"]  # duplicate + low skill
        }
    }

    agent = ComplianceAgent()
    result = agent.check(schedule, nurses)
    print(result)
