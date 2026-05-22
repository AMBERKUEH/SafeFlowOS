"""
Agent 3: Compliance Agent
Checks schedule compliance against the rules enforced by the scheduler.
"""

from dotenv import load_dotenv
import os

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
            {"role": "user", "content": prompt},
        ],
        temperature=0.3,
        max_tokens=1024,
    )

    return response.choices[0].message.content


class ComplianceAgent:
    """Checks schedule for actionable compliance violations."""

    def check(self, schedule, nurses):
        violations = []
        warnings = []
        total_rules = 7

        shifts = ["morning", "afternoon", "night"]
        shift_hours = {"morning": 8, "afternoon": 8, "night": 8}
        max_weekly_hours = 40
        max_night_shifts = 3

        days = list(schedule.keys())
        all_nurse_names = [n["name"] for n in nurses]
        unavailable_days = {n["name"]: set(n.get("unavailable_days", [])) for n in nurses}

        weekly_hours = {name: 0 for name in all_nurse_names}
        day_off_compliance = {name: True for name in all_nurse_names}
        nurse_shifts_by_day = {name: {} for name in all_nurse_names}

        for day_index, day in enumerate(days):
            day_schedule = schedule.get(day, {})
            for shift in shifts:
                assigned = day_schedule.get(shift, [])

                if len(assigned) < 3:
                    violations.append(f"{day} {shift} has only {len(assigned)} nurses - minimum 3 required")

                for nurse_name in assigned:
                    if nurse_name not in weekly_hours:
                        weekly_hours[nurse_name] = 0
                        nurse_shifts_by_day[nurse_name] = {}
                        day_off_compliance[nurse_name] = True

                    weekly_hours[nurse_name] += shift_hours[shift]
                    nurse_shifts_by_day[nurse_name].setdefault(day_index, []).append(shift)
                    day_off_compliance[nurse_name] = False

                    if day in unavailable_days.get(nurse_name, set()):
                        violations.append(f"{nurse_name} is assigned on unavailable day {day}")

        for nurse_name in all_nurse_names:
            for day_index, assigned_shifts in nurse_shifts_by_day[nurse_name].items():
                if len(assigned_shifts) > 1:
                    violations.append(
                        f"{nurse_name} is double-booked on {days[day_index]}: {', '.join(assigned_shifts)}"
                    )

            for day_index in range(len(days) - 1):
                today_shifts = nurse_shifts_by_day[nurse_name].get(day_index, [])
                next_day_shifts = nurse_shifts_by_day[nurse_name].get(day_index + 1, [])
                if "night" in today_shifts and "morning" in next_day_shifts:
                    violations.append(
                        f"{nurse_name} works night on {days[day_index]} then morning on {days[day_index + 1]} - rest period required"
                    )

            night_count = sum(1 for assigned_shifts in nurse_shifts_by_day[nurse_name].values() if "night" in assigned_shifts)
            if night_count > max_night_shifts:
                violations.append(f"{nurse_name} has {night_count} night shifts - maximum {max_night_shifts} allowed")

            working_days = sum(1 for assigned_shifts in nurse_shifts_by_day[nurse_name].values() if assigned_shifts)
            day_off_compliance[nurse_name] = working_days < 7
            if working_days == 7:
                violations.append(f"{nurse_name} has no rest day this week")

        overtime_risk = []
        for nurse_name, hours in weekly_hours.items():
            if hours > max_weekly_hours:
                warnings.append(f"{nurse_name} works {hours}hrs this week - overtime review recommended")
                overtime_risk.append(nurse_name)
            elif hours > 36:
                warnings.append(f"{nurse_name} at {hours}hrs - approaching 40hr limit")
                overtime_risk.append(nurse_name)

        violations = list(dict.fromkeys(violations))
        warnings = list(dict.fromkeys(warnings))

        passed = len(violations) == 0
        score = max(0, int((1 - min(len(violations), total_rules) / total_rules) * 100))

        return {
            "passed": passed,
            "violations": violations,
            "warnings": warnings,
            "compliance_score": score,
            "weekly_hours": weekly_hours,
            "overtime_risk": overtime_risk,
            "day_off_compliance": day_off_compliance,
        }

    def suggest_fix(self, violation):
        """Suggest a fix for a violation using Groq, with deterministic fallbacks."""
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
            if "minimum 3 required" in violation:
                return "Add another available nurse to meet minimum staffing."
            if "unavailable day" in violation:
                return "Move this nurse to a day they are available."
            if "double-booked" in violation:
                return "Remove one of the nurse's shifts on that day."
            if "night on" in violation and "then morning" in violation:
                return "Move the next-day morning shift to another nurse."
            if "night shifts" in violation:
                return "Redistribute night shifts across more nurses."
            if "40hr limit" in violation:
                return "Remove or reassign one shift to keep weekly hours within the limit."
            return "Review and adjust the schedule to resolve this violation."


if __name__ == "__main__":
    nurses = [
        {"name": "Zhang Wei", "skill": "N3", "unavailable_days": []},
        {"name": "Li Mei", "skill": "N2", "unavailable_days": []},
        {"name": "Arun", "skill": "N4", "unavailable_days": []},
        {"name": "Sara", "skill": "N1", "unavailable_days": []},
    ]

    schedule = {
        "Monday": {
            "morning": ["Zhang Wei"],
            "afternoon": ["Sara", "Li Mei"],
            "night": ["Sara", "Sara"],
        }
    }

    agent = ComplianceAgent()
    print(agent.check(schedule, nurses))
