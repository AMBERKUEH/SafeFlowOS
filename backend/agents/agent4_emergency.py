"""
Agent 4: Emergency Agent
Handles emergency disruptions using Groq API.
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
            {"role": "system", "content": "You are a hospital emergency response AI."},
            {"role": "user", "content": prompt}
        ],
        temperature=0.3,
        max_tokens=1024
    )
    
    return response.choices[0].message.content


class EmergencyAgent:
    """Handles emergency disruptions and reassignments."""

    def __init__(self):
        """Initialize EmergencyAgent."""
        pass

    def _parse_disruption_with_llm(self, disruption: str) -> Dict[str, Any]:
        """Use Groq LLM to parse disruption text."""
        try:
            prompt = f"""Extract structured information from this emergency disruption:

"{disruption}"

Return ONLY a JSON object with these fields:
- affected_nurse: string (the nurse name mentioned, or null if none)
- affected_day: string (day of week: Monday/Tuesday/Wednesday/Thursday/Friday/Saturday/Sunday, or null)
- affected_shift: string (morning/afternoon/night, or null)
- affected_ward: string (ICU/ER/General/Pediatrics, or null)

Example response:
{{"affected_nurse": "Zhang Wei", "affected_day": "Monday", "affected_shift": "morning", "affected_ward": "ICU"}}

If information is missing, use null. Return ONLY the JSON, no explanation."""

            response = call_llm(prompt)
            
            # Extract JSON from response
            import re
            json_match = re.search(r'\{[^}]+\}', response)
            if json_match:
                return json.loads(json_match.group())
            
            # Fallback to manual parsing if LLM fails
            return self._parse_disruption_fallback(disruption)
            
        except Exception as e:
            print(f"[EmergencyAgent] LLM parsing failed: {e}")
            return self._parse_disruption_fallback(disruption)

    def _parse_disruption_fallback(self, disruption: str) -> Dict[str, Any]:
        """Fallback: Parse disruption text using keyword matching."""
        import re
        
        disruption_lower = disruption.lower()
        
        # Extract nurse name (look for capitalized words)
        nurse_match = re.search(r'([A-Z][a-z]+\s+[A-Z][a-z]+)', disruption)
        affected_nurse = nurse_match.group(1) if nurse_match else None
        
        # Extract day
        days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
        affected_day = None
        for day in days:
            if day in disruption_lower:
                affected_day = day.capitalize()
                break
        
        # Extract shift
        shifts = {
            'morning': 'morning',
            'afternoon': 'afternoon',
            'night': 'night',
            'evening': 'afternoon'
        }
        affected_shift = None
        for shift_key, shift_val in shifts.items():
            if shift_key in disruption_lower:
                affected_shift = shift_val
                break
        
        # Extract ward
        wards = ['icu', 'er', 'emergency', 'general', 'pediatrics', 'surgery']
        affected_ward = None
        for ward in wards:
            if ward in disruption_lower:
                affected_ward = ward.upper() if ward in ['icu', 'er'] else ward.capitalize()
                break
        
        return {
            "affected_nurse": affected_nurse,
            "affected_day": affected_day,
            "affected_shift": affected_shift,
            "affected_ward": affected_ward
        }

    def _get_severity(self, ward):
        """Determine severity based on ward."""
        if ward is None:
            return "LOW"
        severity_mapping = {
            "ICU": "HIGH",
            "ER": "HIGH",
            "Emergency": "HIGH",
            "Operating Room": "HIGH",
            "CCU": "HIGH",
            "Surgery": "HIGH",
            "Ward 1": "MEDIUM",
            "Ward 2": "MEDIUM",
            "General": "LOW",
        }
        return severity_mapping.get(ward.strip().upper(), "LOW")

    def _find_replacement(self, affected_nurse, day, shift, ward, current_schedule, nurses):
        """Find a replacement nurse."""
        critical_wards = set(["ICU", "CCU", "ER", "Emergency", "Operating Room", "Surgery"])
        nurse_skill_rank = {"N1": 1, "N2": 2, "N3": 3, "N4": 4}

        required_skill = None
        if ward and ward.strip().upper() in critical_wards:
            required_skill = "N3"

        # Build assigned nurses lookup
        assigned_nurses = {
            (entry.get("day"), entry.get("shift", "").lower(), entry.get("ward", "").lower()): entry.get("nurse") 
            for entry in current_schedule
        }
        
        replacement = None
        for nurse in nurses:
            n_name = nurse["name"]
            n_skill = nurse.get("skill", "N1")
            
            if n_name == affected_nurse:
                continue
            
            if required_skill is not None:
                if nurse_skill_rank.get(n_skill, 0) < nurse_skill_rank[required_skill]:
                    continue
            
            shift_key = shift.lower() if shift else ""
            ward_key = ward.lower() if ward else ""
            if (day, shift_key, ward_key) in assigned_nurses and \
               assigned_nurses[(day, shift_key, ward_key)] == n_name:
                continue
            
            replacement = nurse
            break

        # Build updated schedule
        shift_lower = shift.lower() if shift else ""
        updated_schedule = [entry for entry in current_schedule 
                          if not (entry.get("nurse") == affected_nurse and 
                                 entry.get("day") == day and 
                                 entry.get("shift", "").lower() == shift_lower)]
        
        if replacement:
            new_assignment = {
                "nurse": replacement["name"],
                "day": day,
                "shift": shift,
                "ward": ward
            }
            updated_schedule.append(new_assignment)
            action = f"Reassigned {replacement['name']} to cover {ward} on {day} ({shift}) due to {affected_nurse}'s disruption."
        else:
            action = f"No suitable replacement nurse found for {ward} on {day} ({shift})."

        return updated_schedule, action

    def handle(self, disruption, current_schedule, nurses):
        """Handle an emergency disruption."""
        print(f"[EmergencyAgent] Handling disruption: {disruption}")
        
        # Parse disruption
        res = self._parse_disruption_with_llm(disruption)
        affected_nurse = res.get("affected_nurse")
        affected_day = res.get("affected_day")
        affected_shift = res.get("affected_shift")
        affected_ward = res.get("affected_ward")

        print(f"[EmergencyAgent] Parsed: nurse={affected_nurse}, day={affected_day}, shift={affected_shift}, ward={affected_ward}")

        # If no specific day/shift provided, find all scheduled shifts for this nurse
        if affected_nurse and (not affected_day or not affected_shift):
            nurse_shifts = [
                entry for entry in current_schedule 
                if entry.get("nurse") == affected_nurse
            ]
            if nurse_shifts:
                # Use the first scheduled shift found
                first_shift = nurse_shifts[0]
                affected_day = affected_day or first_shift.get("day")
                affected_shift = affected_shift or first_shift.get("shift")
                affected_ward = affected_ward or first_shift.get("ward")
                print(f"[EmergencyAgent] Found scheduled shift: day={affected_day}, shift={affected_shift}, ward={affected_ward}")
            else:
                return {
                    "updated_schedule": current_schedule,
                    "action_taken": f"Could not find any scheduled shifts for {affected_nurse}.",
                    "severity": "LOW",
                    "parsed_info": res
                }

        # Determine severity
        severity = self._get_severity(affected_ward)

        # Find replacement
        updated_schedule, action_taken = self._find_replacement(
            affected_nurse, affected_day, affected_shift, affected_ward, 
            current_schedule, nurses
        )

        return {
            "updated_schedule": updated_schedule,
            "action_taken": action_taken,
            "severity": severity,
            "parsed_info": res
        }


# Test
if __name__ == "__main__":
    agent = EmergencyAgent()
    
    nurses = [
        {"name": "Zhang Wei", "skill": "N3", "ward": "ICU"},
        {"name": "Li Na", "skill": "N2", "ward": "General"},
        {"name": "Wang Fang", "skill": "N4", "ward": "ER"},
    ]
    
    schedule = [
        {"nurse": "Zhang Wei", "day": "Monday", "shift": "morning", "ward": "ICU"},
        {"nurse": "Li Na", "day": "Monday", "shift": "afternoon", "ward": "General"},
    ]
    
    result = agent.handle("Zhang Wei is sick on Monday morning ICU shift", schedule, nurses)
    print(json.dumps(result, indent=2))
