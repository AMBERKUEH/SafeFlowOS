"""
SurgEye Rostering Agent
Integrates with NurseAI to remove nurses from roster when instruments go missing.
Uses SQLite database for persistence.
"""

import sys
import os
from datetime import datetime
from typing import Dict, List, Any, Optional

# Import database module
from database import (
    get_nurse,
    get_nurse_upcoming_shifts,
    remove_nurse_from_shifts,
    find_replacement_nurse,
    reassign_shift,
    create_violation,
    create_investigation,
    get_all_investigations,
    get_investigation,
    get_all_violations,
    get_surgery_assignment,
    get_nurse_status
)

class RosteringAgent:
    """
    AI Agent that handles nurse rostering when equipment violations occur.
    
    Perceive: Missing instruments detected
    Reason: Nurse violated protocol → must be investigated
    Act: Remove from roster, find replacement, log evidence
    """
    
    def __init__(self):
        self.investigations = []
        
    async def handle_missing_instruments(
        self, 
        missing_items: Dict[str, int],
        nurse_id: str,
        nurse_name: str,
        session_id: str,
        evidence: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Handle missing instrument violation.
        
        Args:
            missing_items: Dict of instrument class -> count missing
            nurse_id: Nurse ID
            nurse_name: Nurse name
            session_id: Surgery session ID
            evidence: Dict with baseline_image, postop_image, timeline
            
        Returns:
            Action summary
        """
        print(f"\n[🚨 ROSTERING AGENT] Missing instruments detected!")
        print(f"   Nurse: {nurse_name} (ID: {nurse_id})")
        print(f"   Missing: {missing_items}")
        
        actions_taken = []
        
        # 1. FLAG NURSE - Create violation records
        violation_ids = []
        for instrument, count in missing_items.items():
            vid = create_violation(
                nurse_id=nurse_id,
                surgery_id=session_id,
                instrument_name=instrument,
                instrument_count=count
            )
            violation_ids.append(vid)
        actions_taken.append(f"Flagged nurse {nurse_name} for investigation ({len(violation_ids)} violations)")
        
        # 2. REMOVE FROM UPCOMING SHIFTS
        removed_shifts = remove_nurse_from_shifts(nurse_id)
        actions_taken.append(f"Removed from {len(removed_shifts)} upcoming shifts")
        
        # 3. FIND REPLACEMENTS FOR EACH SHIFT
        replacements = []
        excluded_nurses = [nurse_id]  # Don't reassign to same nurse
        
        for shift in removed_shifts:
            replacement_id = find_replacement_nurse(shift, excluded_nurses)
            if replacement_id:
                reassign_shift(shift['id'], replacement_id)
                replacement_nurse = get_nurse(replacement_id)
                replacements.append({
                    'shift_id': shift['id'],
                    'shift_date': shift['date'],
                    'shift_time': f"{shift['time_start']}-{shift['time_end']}",
                    'replacement_id': replacement_id,
                    'replacement_name': replacement_nurse['name'] if replacement_nurse else 'Unknown'
                })
                excluded_nurses.append(replacement_id)  # Don't assign same nurse twice
        actions_taken.append(f"Found {len(replacements)} replacement nurses")
        
        # 4. CREATE INVESTIGATION RECORD WITH EVIDENCE
        investigation_id = create_investigation(
            nurse_id=nurse_id,
            surgery_id=session_id,
            violation_id=violation_ids[0] if violation_ids else None,
            missing_items=missing_items,
            baseline_image=evidence.get('baseline_image'),
            postop_image=evidence.get('postop_image'),
            timeline=evidence.get('timeline', [])
        )
        actions_taken.append(f"Created investigation #{investigation_id}")
        
        result = {
            "status": "NURSE_REMOVED_FROM_ROSTER",
            "investigation_id": investigation_id,
            "flagged_nurse": nurse_name,
            "nurse_id": nurse_id,
            "missing_items": missing_items,
            "actions_taken": actions_taken,
            "removed_shifts": [
                {"id": s['id'], "date": s['date'], "time": f"{s['time_start']}-{s['time_end']}"}
                for s in removed_shifts
            ],
            "replacements": replacements,
            "timestamp": datetime.now().isoformat()
        }
        
        print(f"\n[✅ ROSTERING AGENT] Actions completed:")
        for action in actions_taken:
            print(f"   • {action}")
        
        return result
    
    def get_investigations(self) -> List[Dict]:
        """Get all investigations from database."""
        return get_all_investigations()
    
    def get_investigation(self, investigation_id: str) -> Optional[Dict]:
        """Get investigation by ID."""
        return get_investigation(investigation_id)
    
    def get_violations(self) -> List[Dict]:
        """Get all violations."""
        return get_all_violations()
    
    def get_nurse_status(self, nurse_id: str) -> Dict:
        """Get nurse status with violations."""
        return get_nurse_status(nurse_id)


# Global instance
rostering_agent = RosteringAgent()


async def trigger_rostering_alert(
    missing_items: Dict[str, int], 
    nurse_id: str = 'nurse-001',
    nurse_name: str = 'Sarah Chen',
    session_id: str = None,
    evidence: Dict = None
) -> Dict[str, Any]:
    """
    Convenience function to trigger rostering agent.
    Called from scan-postop endpoint when instruments are missing.
    """
    if session_id is None:
        session_id = f"surgery-session-{datetime.now().strftime('%Y%m%d-%H%M%S')}"
    
    if evidence is None:
        evidence = {
            "baseline_image": None,
            "postop_image": None,
            "timeline": []
        }
    
    return await rostering_agent.handle_missing_instruments(
        missing_items=missing_items,
        nurse_id=nurse_id,
        nurse_name=nurse_name,
        session_id=session_id,
        evidence=evidence
    )


if __name__ == "__main__":
    # Test the agent
    import asyncio
    
    async def test():
        result = await trigger_rostering_alert(
            missing_items={"Forceps": 1, "Scalpel": 1},
            nurse_id="nurse-001",
            nurse_name="Sarah Chen"
        )
        print("\n" + "="*60)
        print("TEST RESULT:")
        print("="*60)
        print(result)
    
    asyncio.run(test())
