"""
SafeFlow OS Orchestrator Agent.

This agent is the central workflow controller. It does not make medical
diagnoses or official staffing changes; it coordinates other agents, applies
safety rules, and marks where human approval is required.
"""

from datetime import datetime
from typing import Any, Dict, List, Optional


DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
SHIFT_NAMES = ["morning", "afternoon", "night"]
SKILL_RANK = {"N1": 1, "N2": 2, "N3": 3, "N4": 4}
LOW_LOAD_WARDS = {"General", "Pediatrics"}
CRITICAL_WARDS = {"ER", "Emergency", "ICU", "Surgery", "Operating Room"}


class SafeFlowOrchestrator:
    """Coordinates SafeFlow OS event routing and safety approvals."""

    def assess_overflow(
        self,
        nurses: List[Dict[str, Any]],
        current_schedule: Optional[Dict[str, Dict[str, List[str]]]] = None,
        incoming_patients: Optional[List[Dict[str, Any]]] = None,
        department: str = "ER",
        current_day: Optional[str] = None,
        current_shift: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Assess a patient surge and recommend temporary nurse reallocation.

        The output is intentionally approval-gated: it recommends available or
        on-call nurses, but it does not mutate the official schedule.
        """
        now = datetime.utcnow().isoformat(timespec="seconds") + "Z"
        current_day = current_day or self._default_day()
        current_shift = current_shift or self._default_shift()
        incoming_patients = incoming_patients or self._default_surge_patients()

        high_risk_count = sum(1 for patient in incoming_patients if self._is_high_risk(patient))
        total_incoming = len(incoming_patients)
        load_level = self._load_level(total_incoming, high_risk_count)
        required_support = self._required_support(load_level, high_risk_count)

        recommendations = self._recommend_nurses(
            nurses=nurses,
            current_schedule=current_schedule or {},
            department=department,
            current_day=current_day,
            current_shift=current_shift,
            required_support=required_support,
        )
        department_staffing = self._department_staffing(
            nurses=nurses,
            current_schedule=current_schedule or {},
            recommendations=recommendations,
            department=department,
            current_day=current_day,
            current_shift=current_shift,
        )

        approval_required = load_level in {"HIGH", "CRITICAL"} or bool(recommendations)
        notification_preview = [
            {
                "channel": "demo",
                "message": (
                    f"Emergency support requested at {department}. "
                    "Please confirm availability before any official roster change."
                ),
                "recipient": item["nurse"],
            }
            for item in recommendations
        ]

        audit_event = {
            "who": "SafeFlow OS Orchestrator",
            "what": "patient_overflow_assessment",
            "when": now,
            "why": f"{total_incoming} incoming patients, {high_risk_count} high-risk cases",
            "which_agent": "Orchestrator -> Nurse Rostering Agent",
            "confidence": self._confidence(load_level, recommendations),
            "human_approval_status": "PENDING_HEAD_NURSE_APPROVAL" if approval_required else "NOT_REQUIRED",
        }

        return {
            "event": "PATIENT_OVERFLOW",
            "department": department,
            "current_day": current_day,
            "current_shift": current_shift,
            "load_level": load_level,
            "incoming_patients": total_incoming,
            "high_risk_patients": high_risk_count,
            "risk_queue_status": "INCREASING" if high_risk_count >= 2 else "STABLE",
            "orchestrator_decision": self._decision_text(load_level, required_support),
            "triggered_agents": ["Nurse Rostering Agent"] if required_support > 0 else [],
            "recommended_reallocations": recommendations,
            "department_staffing": department_staffing,
            "transfers": [
                {
                    "nurse": item["nurse"],
                    "from": item["current_ward"],
                    "to": item["recommended_to"],
                    "status": "pending_head_nurse_approval",
                }
                for item in recommendations
            ],
            "head_nurse_approval_required": approval_required,
            "official_schedule_changed": False,
            "notification_preview": notification_preview,
            "fallbacks": [
                "If notification delivery fails, keep dashboard alert active.",
                "If Rostering Agent is unavailable, switch to manual head-nurse review.",
            ],
            "audit_log": audit_event,
            "safety_note": (
                "The system recommends available or on-call nurses for temporary "
                "reallocation, but the head nurse must approve before any official "
                "schedule change."
            ),
        }

    def _default_day(self) -> str:
        return DAY_NAMES[datetime.utcnow().weekday()]

    def _default_shift(self) -> str:
        hour = datetime.utcnow().hour
        if 0 <= hour < 8:
            return "night"
        if 8 <= hour < 16:
            return "morning"
        return "afternoon"

    def _default_surge_patients(self) -> List[Dict[str, Any]]:
        return [
            {"triage_level": "High Risk", "symptoms": ["chest pain", "shortness of breath"]},
            {"triage_level": "High Risk", "symptoms": ["severe bleeding"]},
            {"triage_level": "Yellow", "symptoms": ["fever", "dehydration"]},
            {"triage_level": "Green", "symptoms": ["minor injury"]},
            {"triage_level": "Yellow", "symptoms": ["abdominal pain"]},
        ]

    def _is_high_risk(self, patient: Dict[str, Any]) -> bool:
        level = str(patient.get("triage_level", patient.get("risk_level", ""))).lower()
        symptoms = " ".join(str(item).lower() for item in patient.get("symptoms", []))
        high_risk_terms = ["red", "critical", "high", "chest pain", "shortness of breath", "severe bleeding"]
        return any(term in level or term in symptoms for term in high_risk_terms)

    def _load_level(self, total_incoming: int, high_risk_count: int) -> str:
        if high_risk_count >= 4 or total_incoming >= 12:
            return "CRITICAL"
        if high_risk_count >= 2 or total_incoming >= 6:
            return "HIGH"
        if high_risk_count == 1 or total_incoming >= 4:
            return "ELEVATED"
        return "NORMAL"

    def _required_support(self, load_level: str, high_risk_count: int) -> int:
        if load_level == "CRITICAL":
            return min(4, max(3, high_risk_count))
        if load_level == "HIGH":
            return min(3, max(2, high_risk_count))
        if load_level == "ELEVATED":
            return 1
        return 0

    def _recommend_nurses(
        self,
        nurses: List[Dict[str, Any]],
        current_schedule: Dict[str, Dict[str, List[str]]],
        department: str,
        current_day: str,
        current_shift: str,
        required_support: int,
    ) -> List[Dict[str, Any]]:
        if required_support <= 0:
            return []

        scheduled_now = set(
            current_schedule.get(current_day, {}).get(current_shift, [])
            if isinstance(current_schedule, dict)
            else []
        )

        candidates = []
        for nurse in nurses:
            name = nurse.get("name")
            if not name:
                continue

            fatigue = int(nurse.get("fatigue_score", nurse.get("fatigue", 40)) or 40)
            skill = nurse.get("skill", "N1")
            ward = nurse.get("ward", "General")
            unavailable = set(nurse.get("unavailable_days", []))
            is_on_call = bool(nurse.get("on_call") or nurse.get("standby"))
            is_working_now = name in scheduled_now

            if current_day in unavailable and not is_on_call:
                continue
            if fatigue >= 85 and not is_on_call:
                continue

            skill_score = SKILL_RANK.get(skill, 1) * 10
            ward_score = 18 if ward == department else 10 if ward in CRITICAL_WARDS else 4
            availability_score = 15 if is_on_call else 8 if not is_working_now else 2
            fatigue_score = max(0, 20 - fatigue // 5)
            low_load_bonus = 8 if ward in LOW_LOAD_WARDS and not is_working_now else 0
            score = skill_score + ward_score + availability_score + fatigue_score + low_load_bonus

            if SKILL_RANK.get(skill, 1) < 2 and not is_on_call:
                continue

            candidates.append(
                {
                    "nurse": name,
                    "skill": skill,
                    "current_ward": ward,
                    "recommended_to": department,
                    "status": "on-call" if is_on_call else "available" if not is_working_now else "currently_assigned",
                    "reason": self._reason(ward, skill, is_on_call, is_working_now),
                    "requires_head_nurse_approval": True,
                    "score": score,
                }
            )

        candidates.sort(key=lambda item: item["score"], reverse=True)
        return candidates[:required_support]

    def _reason(self, ward: str, skill: str, is_on_call: bool, is_working_now: bool) -> str:
        if is_on_call:
            return f"{skill} nurse marked as on-call for temporary emergency support."
        if ward in LOW_LOAD_WARDS and not is_working_now:
            return f"{skill} nurse from lower-load ward can be reviewed for temporary ER support."
        if ward in CRITICAL_WARDS:
            return f"{skill} nurse has critical-care experience relevant to ER overflow."
        if is_working_now:
            return f"{skill} nurse is currently assigned; reallocation needs careful head-nurse review."
        return f"{skill} nurse appears available for review."

    def _department_staffing(
        self,
        nurses: List[Dict[str, Any]],
        current_schedule: Dict[str, Dict[str, List[str]]],
        recommendations: List[Dict[str, Any]],
        department: str,
        current_day: str,
        current_shift: str,
    ) -> Dict[str, Any]:
        roster_counts: Dict[str, int] = {}
        for nurse in nurses:
            ward = nurse.get("ward", "General")
            roster_counts[ward] = roster_counts.get(ward, 0) + 1

        nurse_wards = {nurse.get("name"): nurse.get("ward", "General") for nurse in nurses}
        active_counts = {ward: 0 for ward in roster_counts}
        active_names = current_schedule.get(current_day, {}).get(current_shift, [])
        for name in active_names:
            ward = nurse_wards.get(name, "General")
            active_counts[ward] = active_counts.get(ward, 0) + 1

        after_reallocation = dict(active_counts)
        after_reallocation.setdefault(department, 0)
        for item in recommendations:
            source = item["current_ward"]
            target = item["recommended_to"]
            after_reallocation[source] = max(0, after_reallocation.get(source, 0) - 1)
            after_reallocation[target] = after_reallocation.get(target, 0) + 1

        return {
            "roster_total_by_department": roster_counts,
            "active_now_by_department": active_counts,
            "after_recommended_transfer": after_reallocation,
        }

    def _decision_text(self, load_level: str, required_support: int) -> str:
        if required_support <= 0:
            return "Monitor patient queue; no emergency reallocation needed."
        return (
            f"{load_level} overload detected. Trigger Nurse Rostering Agent to recommend "
            f"{required_support} temporary support nurse(s), pending head nurse approval."
        )

    def _confidence(self, load_level: str, recommendations: List[Dict[str, Any]]) -> float:
        base = {"NORMAL": 0.72, "ELEVATED": 0.78, "HIGH": 0.84, "CRITICAL": 0.88}.get(load_level, 0.75)
        if not recommendations and load_level in {"HIGH", "CRITICAL"}:
            return max(0.55, base - 0.2)
        return base
