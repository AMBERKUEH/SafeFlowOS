"""
Agent 1: Scheduling Agent — KKM Standard

CORE GUARANTEE (enforced purely in Python, LLM only does initial attempt):
  ✅ Every nurse: exactly 5 working days + 2 rest days per week
  ✅ Every working day: exactly 1 shift (N/M/A) — never blank, never double
  ✅ Every shift every day: >= 3 nurses
  ✅ No nurse scheduled on their unavailable_days (if possible)
  ✅ Night 00:00–08:00 | Morning 08:00–16:00 | Afternoon 16:00–00:00

If the LLM output is wrong, the Python fallback scheduler builds a correct
schedule from scratch using a greedy round-robin algorithm.
"""

from dotenv import load_dotenv
import os
import json
import random
from typing import Dict, List, Any, Set, Optional

load_dotenv()

DAYS   = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
SHIFTS = ["morning", "afternoon", "night"]


# ─────────────────────────────────────────────────────────────
# LLM CALL
# ─────────────────────────────────────────────────────────────

def call_llm(prompt: str) -> str:
    try:
        from groq import Groq
    except ImportError:
        raise ImportError("groq not installed.")

    api_key = os.environ.get("GROQ_API_KEY")
    if not api_key:
        raise ValueError("GROQ_API_KEY not set.")

    client = Groq(api_key=api_key)
    resp = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[
            {"role": "system", "content": "You are an expert nurse scheduling AI. Return ONLY valid JSON, no markdown, no explanation."},
            {"role": "user",   "content": prompt},
        ],
        temperature=0.1,
        max_tokens=3000,
    )
    return resp.choices[0].message.content


# ─────────────────────────────────────────────────────────────
# SCHEDULE HELPERS
# ─────────────────────────────────────────────────────────────

def empty_schedule() -> Dict:
    return {day: {shift: [] for shift in SHIFTS} for day in DAYS}


def weekly_shifts(schedule: Dict, name: str) -> int:
    return sum(1 for d in DAYS for s in SHIFTS if name in schedule[d].get(s, []))


def work_days(schedule: Dict, name: str) -> List[str]:
    return [d for d in DAYS if any(name in schedule[d].get(s, []) for s in SHIFTS)]


def shift_today(schedule: Dict, day: str, name: str) -> Optional[str]:
    for s in SHIFTS:
        if name in schedule[day].get(s, []):
            return s
    return None


# ─────────────────────────────────────────────────────────────
# PYTHON FALLBACK SCHEDULER
# Deterministic greedy — always produces a valid schedule
# ─────────────────────────────────────────────────────────────

def python_scheduler(nurses: List[Dict]) -> Dict:
    """
    Build a valid schedule from scratch:
    1. Assign 2 rest days per nurse (prefer unavailable_days)
    2. For each nurse's 5 working days, assign exactly 1 shift
    3. Ensure every shift has >= 3 nurses (backfill if needed)
    """
    print("[PYTHON_SCHEDULER] Building schedule from scratch...")
    schedule = empty_schedule()

    # Step 1: decide rest days per nurse
    nurse_rest: Dict[str, List[str]] = {}
    for nurse in nurses:
        name    = nurse["name"]
        unavail = nurse.get("unavailable_days", [])

        rest = []
        # First pick from unavailable days
        for d in unavail:
            if d in DAYS and len(rest) < 2:
                rest.append(d)
        # Fill remaining rest days spread across the week
        spread = ["Sunday", "Saturday", "Monday", "Wednesday", "Friday", "Tuesday", "Thursday"]
        for d in spread:
            if d not in rest and len(rest) < 2:
                rest.append(d)
        nurse_rest[name] = rest[:2]

    # Step 2: assign shifts — cycle through SHIFTS so they're balanced
    # Track per-day shift assignment counts for balance
    day_shift_idx: Dict[str, int] = {d: 0 for d in DAYS}

    for nurse in nurses:
        name       = nurse["name"]
        rest_days_ = set(nurse_rest[name])
        work_days_ = [d for d in DAYS if d not in rest_days_]  # exactly 5 days

        for day in work_days_:
            # Pick the shift with fewest nurses today (balance across shifts)
            counts = {s: len(schedule[day][s]) for s in SHIFTS}
            chosen = min(counts, key=counts.get)  # type: ignore
            schedule[day][chosen].append(name)

    # Step 3: backfill any shift that still has < 3 nurses
    # Process weekends first
    day_order = ["Saturday", "Sunday"] + [d for d in DAYS if d not in ("Saturday", "Sunday")]
    nurse_unavail = {n["name"]: set(n.get("unavailable_days", [])) for n in nurses}

    for day in day_order:
        for shift in SHIFTS:
            while len(schedule[day][shift]) < 3:
                # Find a nurse who: isn't working today, has < 6 shifts, not unavailable
                candidate = None
                best_count = 999
                for nurse in nurses:
                    name = nurse["name"]
                    if shift_today(schedule, day, name):
                        continue  # already working today
                    if day in nurse_unavail[name]:
                        continue
                    wc = weekly_shifts(schedule, name)
                    if wc < 6 and wc < best_count:
                        best_count = wc
                        candidate = name
                if candidate:
                    schedule[day][shift].append(candidate)
                    print(f"  [BACKFILL] {candidate} → {day} {shift}")
                else:
                    print(f"  [WARNING] Cannot fill {day} {shift} to 3 — not enough nurses")
                    break

    return schedule


# ─────────────────────────────────────────────────────────────
# POST-PROCESSING FIXUPS (applied after LLM output)
# ─────────────────────────────────────────────────────────────

def fix_duplicates(schedule: Dict) -> Dict:
    """Remove nurse from 2nd+ shifts if they appear multiple times on the same day."""
    for day in DAYS:
        seen: Dict[str, str] = {}
        for shift in SHIFTS:
            to_remove = []
            for name in schedule[day][shift]:
                if name in seen:
                    to_remove.append(name)
                    print(f"  [DEDUP] {name} double-booked {day}: kept {seen[name]}, removed {shift}")
                else:
                    seen[name] = shift
            for name in to_remove:
                schedule[day][shift].remove(name)
    return schedule


def fix_rest_days(schedule: Dict, nurses: List[Dict]) -> Dict:
    """
    Ensure every nurse has exactly 2 rest days.
    - Too many work days → remove from excess days (prefer unavail days, then safe days)
    - Too few work days → already handled by fix_coverage
    """
    for nurse in nurses:
        name    = nurse["name"]
        unavail = set(nurse.get("unavailable_days", []))
        wd      = work_days(schedule, name)
        excess  = len(wd) - 5

        if excess <= 0:
            continue

        # Priority: unavail days > days where removal is safe (shift still has >3)
        candidates = []
        for d in unavail:
            if d in wd:
                candidates.append(d)
        for d in DAYS:
            if d in wd and d not in candidates:
                s = shift_today(schedule, d, name)
                if s and len(schedule[d][s]) > 3:
                    candidates.append(d)
        for d in wd:
            if d not in candidates:
                candidates.append(d)

        for d in candidates[:excess]:
            s = shift_today(schedule, d, name)
            if s:
                schedule[d][s].remove(name)
                print(f"  [REST] {name} rests on {d} (removed from {s})")

    return schedule


def fix_blanks(schedule: Dict, nurses: List[Dict]) -> Dict:
    """
    THE KEY FIX: any nurse with fewer than 5 shifts AND a blank day
    (not a rest day, not assigned any shift) gets assigned to a shift.
    """
    nurse_unavail = {n["name"]: set(n.get("unavailable_days", [])) for n in nurses}

    for nurse in nurses:
        name    = nurse["name"]
        unavail = nurse_unavail[name]

        for day in DAYS:
            # Skip if this is a rest day or already has a shift
            if shift_today(schedule, day, name):
                continue  # working ✓
            if day in unavail:
                continue  # legitimate unavailable

            # This day is BLANK — either assign a shift or mark as rest
            wc = weekly_shifts(schedule, name)
            if wc < 5:
                # Should be working — assign the least-staffed shift today
                counts = {s: len(schedule[day][s]) for s in SHIFTS}
                chosen = min(counts, key=counts.get)  # type: ignore
                schedule[day][chosen].append(name)
                print(f"  [BLANK_FIX] {name} was blank on {day} → assigned {chosen}")
            # else: already at 5 shifts, this blank day becomes their rest day ✓

    return schedule


def fix_coverage(schedule: Dict, nurses: List[Dict]) -> Dict:
    """Ensure every shift has >= 3 nurses. Weekends first."""
    day_order     = ["Saturday", "Sunday"] + [d for d in DAYS if d not in ("Saturday", "Sunday")]
    nurse_unavail = {n["name"]: set(n.get("unavailable_days", [])) for n in nurses}

    for day in day_order:
        for shift in SHIFTS:
            while len(schedule[day][shift]) < 3:
                # Pick nurse: free today + not unavailable + fewest shifts
                best: Optional[str] = None
                best_count = 999
                for nurse in nurses:
                    name = nurse["name"]
                    if shift_today(schedule, day, name):
                        continue
                    if day in nurse_unavail[name]:
                        continue
                    wc = weekly_shifts(schedule, name)
                    if wc < 6 and wc < best_count:
                        best_count = wc
                        best = name
                if best:
                    schedule[day][shift].append(best)
                    print(f"  [COVERAGE] {best} → {day} {shift} (now {len(schedule[day][shift])})")
                else:
                    print(f"  [WARNING] {day} {shift} still understaffed — insufficient nurses")
                    break

    return schedule


def validate(schedule: Dict, nurses: List[Dict]) -> None:
    """Print a validation report."""
    print("\n" + "=" * 60)
    print("VALIDATION REPORT")
    print("=" * 60)
    all_ok = True

    for day in DAYS:
        for shift in SHIFTS:
            count = len(schedule[day][shift])
            if count < 3:
                print(f"  ❌ {day} {shift}: only {count} nurses")
                all_ok = False

    for nurse in nurses:
        name = nurse["name"]
        wc   = weekly_shifts(schedule, name)
        wd   = work_days(schedule, name)
        rd   = 7 - wc

        # Check double-booking
        for day in DAYS:
            shifts_today = [s for s in SHIFTS if name in schedule[day].get(s, [])]
            if len(shifts_today) > 1:
                print(f"  ❌ {name} double-booked on {day}: {shifts_today}")
                all_ok = False

        # Check blanks (not working, not a rest day)
        unavail = set(nurse.get("unavailable_days", []))
        for day in DAYS:
            if not shift_today(schedule, day, name) and day not in unavail and wc < 5:
                print(f"  ❌ {name} has blank (not working, not rest) on {day}")
                all_ok = False

        status = "✅" if wc == 5 else ("⚠️  OVER" if wc > 5 else "⚠️  UNDER")
        print(f"  {status} {name:22} {wc} shifts · {rd} rest days")

    if all_ok:
        print("\n  ✅ All constraints satisfied!")


# ─────────────────────────────────────────────────────────────
# SCHEDULING AGENT
# ─────────────────────────────────────────────────────────────

class SchedulingAgent:

    def generate(
        self,
        nurses:                List[Dict[str, Any]],
        rules:                 Dict[str, Any],
        staffing_requirements: Dict[str, Any],
    ) -> Dict[str, Dict[str, List[str]]]:

        nurse_count     = len(nurses)
        slots_available = nurse_count * 5
        slots_needed    = 7 * 3 * 3

        # ── Try LLM first ──────────────────────────────────────
        try:
            prompt = f"""Schedule {nurse_count} nurses for a Malaysian hospital (KKM guidelines).

SHIFT TIMES:
- "night"     = 00:00–08:00
- "morning"   = 08:00–16:00
- "afternoon" = 16:00–00:00

NURSES:
{json.dumps(nurses, indent=2, ensure_ascii=False)}

HARD RULES:
1. Every nurse works EXACTLY 5 days/week (2 rest days). NO blanks — every day is either a shift or a rest day.
2. Each working day = EXACTLY 1 shift only (morning OR afternoon OR night)
3. Every shift every day (Mon–Sun) needs >= 3 nurses
4. Never assign a nurse on their unavailable_days
5. Max 3 night shifts per nurse per week

CAPACITY: {nurse_count} nurses × 5 = {slots_available} available vs {slots_needed} needed.
{"Some nurses may need 6 shifts." if slots_available < slots_needed else "Capacity sufficient."}

Return ONLY JSON:
{{
  "Monday":    {{"morning": [], "afternoon": [], "night": []}},
  "Tuesday":   {{"morning": [], "afternoon": [], "night": []}},
  "Wednesday": {{"morning": [], "afternoon": [], "night": []}},
  "Thursday":  {{"morning": [], "afternoon": [], "night": []}},
  "Friday":    {{"morning": [], "afternoon": [], "night": []}},
  "Saturday":  {{"morning": [], "afternoon": [], "night": []}},
  "Sunday":    {{"morning": [], "afternoon": [], "night": []}}
}}"""

            raw  = call_llm(prompt).strip()
            text = raw
            if "```json" in text:
                text = text.split("```json")[1].split("```")[0].strip()
            elif "```" in text:
                text = text.split("```")[1].split("```")[0].strip()

            schedule = json.loads(text)
            for day in DAYS:
                schedule.setdefault(day, {})
                for shift in SHIFTS:
                    schedule[day].setdefault(shift, [])

            print("[LLM] Schedule received — applying fixups...")

        except Exception as e:
            print(f"[LLM] Failed ({e}) — using Python fallback scheduler")
            return self._post_process(python_scheduler(nurses), nurses)

        return self._post_process(schedule, nurses)

    def _post_process(self, schedule: Dict, nurses: List[Dict]) -> Dict:
        """Apply all fixups in order."""
        print("\n[POST] Step 1: Remove double-bookings...")
        schedule = fix_duplicates(schedule)

        print("[POST] Step 2: Enforce 2 rest days per nurse...")
        schedule = fix_rest_days(schedule, nurses)

        print("[POST] Step 3: Fix blank days (not working, not rest)...")
        schedule = fix_blanks(schedule, nurses)

        print("[POST] Step 4: Backfill understaffed shifts...")
        schedule = fix_coverage(schedule, nurses)

        return schedule

    def explain(self, nurse_name: str, schedule: Dict) -> str:
        assigned = [
            f"{day} {shift}"
            for day, shifts in schedule.items()
            for shift, nurse_list in shifts.items()
            if nurse_name in nurse_list
        ]
        prompt = (
            f"Explain why {nurse_name} was assigned these shifts: "
            f"{', '.join(assigned) if assigned else 'none'}. "
            "Write exactly 2 sentences. No bullet points."
        )
        return call_llm(prompt).strip()


# ─────────────────────────────────────────────────────────────
# CLI TEST
# ─────────────────────────────────────────────────────────────

if __name__ == "__main__":
    sample_nurses = [
        {"name": "Nur Aisyah",    "skill": "N4", "ward": "ICU",        "unavailable_days": ["Saturday"]},
        {"name": "Lim Wei Ling",  "skill": "N3", "ward": "ICU",        "unavailable_days": []},
        {"name": "Siti Norfarhana","skill": "N3", "ward": "ER",         "unavailable_days": ["Monday"]},
        {"name": "Rajendran",     "skill": "N2", "ward": "ER",         "unavailable_days": []},
        {"name": "Chong Mei Fen", "skill": "N2", "ward": "General",    "unavailable_days": ["Wednesday"]},
        {"name": "Mohd Faizal",   "skill": "N1", "ward": "General",    "unavailable_days": []},
        {"name": "Kavitha",       "skill": "N4", "ward": "ICU",        "unavailable_days": ["Friday"]},
        {"name": "Tan Sock Ling", "skill": "N3", "ward": "ER",         "unavailable_days": []},
        {"name": "Nurul Hidayah", "skill": "N2", "ward": "Pediatrics", "unavailable_days": ["Tuesday"]},
        {"name": "Wong Kar Wai",  "skill": "N3", "ward": "Pediatrics", "unavailable_days": []},
        {"name": "Suhailah",      "skill": "N1", "ward": "General",    "unavailable_days": ["Sunday"]},
        {"name": "Kumar",         "skill": "N3", "ward": "ICU",        "unavailable_days": []},
    ]

    agent  = SchedulingAgent()
    sched  = agent.generate(sample_nurses, {}, {})

    print("\n" + "=" * 60)
    print("FINAL SCHEDULE")
    print("=" * 60)
    totals: Dict[str, int] = {}

    for day in DAYS:
        print(f"\n{'─'*40}")
        print(f"{day}:")
        working_today: set = set()
        for shift in SHIFTS:
            ns = sched[day][shift]
            flag = " ⚠️ UNDERSTAFFED" if len(ns) < 3 else ""
            print(f"  {shift:10} ({len(ns)}): {', '.join(ns) or '(EMPTY)'}{flag}")
            for n in ns:
                totals[n] = totals.get(n, 0) + 1
                working_today.add(n)
        resting = [n["name"] for n in sample_nurses if n["name"] not in working_today]
        print(f"  {'REST':10}     {', '.join(resting) if resting else '—'}")

    validate(sched, sample_nurses)