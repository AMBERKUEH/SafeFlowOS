"""
Agent Memory: MemoryAgent using Acontext SDK
Stores and retrieves contextual memory for the nurse scheduling system.
"""

import os
import json
from typing import Any, Dict, List, Optional
from datetime import datetime


class MemoryAgent:
    """
    Memory Agent using Acontext SDK for storing and retrieving
    contextual information about nurses, schedules, and compliance.
    """
    
    def __init__(self, project_id: Optional[str] = None, api_key: Optional[str] = None):
        """
        Initialize MemoryAgent with Acontext SDK.
        
        Args:
            project_id: Acontext project ID (defaults to env var)
            api_key: Acontext API key (defaults to env var)
        """
        self.project_id = project_id or os.environ.get("ACONTEXT_PROJECT_ID", "nurse-scheduling")
        self.api_key = api_key or os.environ.get("ACONTEXT_API_KEY")
        self._memory = {}  # In-memory fallback if Acontext not available
        self._acontext_available = False
        
        try:
            from acontext import AContext
            # Initialize with API key if available
            if self.api_key:
                self.acontext = AContext(project_id=self.project_id, api_key=self.api_key)
                print(f"MemoryAgent initialized with Acontext (authenticated)")
            else:
                self.acontext = AContext(project_id=self.project_id)
                print(f"MemoryAgent initialized with Acontext project: {self.project_id}")
            self._acontext_available = True
        except ImportError:
            print("Warning: Acontext SDK not available. Using in-memory storage.")
            self.acontext = None
    
    def remember(self, key: str, value: Any) -> bool:
        """
        Store a key-value pair to Acontext memory.
        
        Args:
            key: Memory key (e.g., "zhang_wei_preferences", "icu_surge_pattern")
            value: Value to store (any JSON-serializable data)
        
        Returns:
            True if stored successfully
        
        Examples:
            remember("zhang_wei_preferences", "rejects Sunday shifts")
            remember("icu_surge_pattern", "spikes every Monday")
        """
        try:
            if self._acontext_available:
                # Store in Acontext with timestamp
                data = {
                    "value": value,
                    "timestamp": datetime.now().isoformat(),
                    "key": key
                }
                self.acontext.store(key, json.dumps(data))
            else:
                # Fallback to in-memory storage
                self._memory[key] = {
                    "value": value,
                    "timestamp": datetime.now().isoformat()
                }
            return True
        except Exception as e:
            print(f"Error storing memory '{key}': {e}")
            # Fallback to in-memory
            self._memory[key] = {
                "value": value,
                "timestamp": datetime.now().isoformat()
            }
            return True
    
    def recall(self, key: str) -> Optional[Any]:
        """
        Retrieve value from Acontext by key.
        
        Args:
            key: Memory key to retrieve
        
        Returns:
            Stored value or None if not found
        """
        try:
            if self._acontext_available:
                try:
                    data_str = self.acontext.retrieve(key)
                    if data_str:
                        data = json.loads(data_str)
                        return data.get("value")
                except Exception:
                    pass
            
            # Fallback to in-memory
            if key in self._memory:
                return self._memory[key]["value"]
            
            return None
        except Exception as e:
            print(f"Error recalling memory '{key}': {e}")
            return None
    
    def learn_from_schedule(
        self,
        schedule: Dict[str, Dict[str, List[str]]],
        compliance: Dict[str, Any],
        nurses: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """
        Automatically extract insights from a completed schedule and store them.
        
        Extracts and stores:
        1. Fatigue risk: Nurses with most night shifts
        2. Problem days: Days with compliance violations
        3. Compliance trend: Appends score to history
        
        Args:
            schedule: Generated schedule dict
            compliance: Compliance report with violations
            nurses: List of nurse data
        
        Returns:
            Dict with extracted insights
        """
        insights = {
            "fatigue_risks": [],
            "problem_days": [],
            "compliance_score": None,
            "timestamp": datetime.now().isoformat()
        }
        
        # 1. Calculate night shift counts for fatigue risk
        night_shift_counts = {}
        for day, shifts in schedule.items():
            night_nurses = shifts.get("night", [])
            for nurse_name in night_nurses:
                night_shift_counts[nurse_name] = night_shift_counts.get(nurse_name, 0) + 1
        
        # Identify high fatigue risk nurses (>2 night shifts per week)
        fatigue_risks = []
        for nurse_name, count in night_shift_counts.items():
            if count >= 3:
                # Find nurse details
                nurse_info = next((n for n in nurses if n["name"] == nurse_name), {})
                fatigue_risks.append({
                    "name": nurse_name,
                    "night_shifts": count,
                    "skill": nurse_info.get("skill", "Unknown"),
                    "ward": nurse_info.get("ward", "Unknown"),
                    "risk_level": "HIGH" if count >= 4 else "MEDIUM"
                })
        
        if fatigue_risks:
            self.remember("fatigue_risk_nurses", fatigue_risks)
            insights["fatigue_risks"] = fatigue_risks
            print(f"Stored fatigue risks for {len(fatigue_risks)} nurses")
        
        # 2. Identify problem days from compliance violations
        problem_days = set()
        violations = compliance.get("violations", [])
        for violation in violations:
            day = violation.get("day")
            if day:
                problem_days.add(day)
        
        if problem_days:
            problem_days_list = sorted(list(problem_days))
            self.remember("problem_days", problem_days_list)
            insights["problem_days"] = problem_days_list
            print(f"Stored problem days: {problem_days_list}")
        
        # 3. Track compliance score trend
        compliance_score = compliance.get("score", 0)
        insights["compliance_score"] = compliance_score
        
        # Retrieve existing history and append
        history = self.recall("compliance_history") or []
        if not isinstance(history, list):
            history = []
        
        history.append({
            "score": compliance_score,
            "timestamp": datetime.now().isoformat(),
            "total_violations": len(violations)
        })
        
        # Keep only last 10 entries
        history = history[-10:]
        self.remember("compliance_history", history)
        print(f"Updated compliance history (last {len(history)} entries)")
        
        # Store overall insights summary
        self.remember("last_schedule_insights", insights)
        
        return insights
    
    def get_scheduling_context(self) -> Dict[str, Any]:
        """
        Retrieve relevant context for scheduling decisions.
        
        Returns:
            Dict with problem days, fatigue risks, and compliance trend
        """
        return {
            "problem_days": self.recall("problem_days") or [],
            "fatigue_risk_nurses": self.recall("fatigue_risk_nurses") or [],
            "compliance_history": self.recall("compliance_history") or [],
            "nurse_preferences": self._get_all_nurse_preferences()
        }
    
    def _get_all_nurse_preferences(self) -> Dict[str, Any]:
        """Retrieve all stored nurse preferences."""
        preferences = {}
        # In a real implementation, this would query Acontext for keys
        # matching a pattern like "*_preferences"
        # For now, scan in-memory fallback
        for key, data in self._memory.items():
            if key.endswith("_preferences"):
                nurse_name = key.replace("_preferences", "")
                preferences[nurse_name] = data["value"]
        return preferences


if __name__ == "__main__":
    # Test MemoryAgent
    print("=" * 60)
    print("MEMORY AGENT TEST")
    print("=" * 60)
    
    agent = MemoryAgent()
    
    # Test remember/recall
    print("\n1. Testing remember/recall...")
    agent.remember("zhang_wei_preferences", "rejects Sunday shifts")
    agent.remember("icu_surge_pattern", "spikes every Monday")
    
    pref = agent.recall("zhang_wei_preferences")
    print(f"Recalled: zhang_wei_preferences = {pref}")
    
    pattern = agent.recall("icu_surge_pattern")
    print(f"Recalled: icu_surge_pattern = {pattern}")
    
    # Test learn_from_schedule
    print("\n2. Testing learn_from_schedule...")
    
    sample_schedule = {
        "Monday": {"morning": ["Zhang Wei", "Li Hua"], "afternoon": ["Wang Fang"], "night": ["Liu Ming", "Chen Jing"]},
        "Tuesday": {"morning": ["Zhang Wei"], "afternoon": ["Li Hua", "Wang Fang"], "night": ["Liu Ming"]},
        "Wednesday": {"morning": ["Li Hua"], "afternoon": ["Zhang Wei"], "night": ["Liu Ming", "Chen Jing", "Yang Li"]},
        "Thursday": {"morning": ["Wang Fang"], "afternoon": ["Li Hua"], "night": ["Chen Jing"]},
        "Friday": {"morning": ["Zhang Wei", "Li Hua"], "afternoon": ["Wang Fang"], "night": ["Liu Ming"]},
        "Saturday": {"morning": ["Li Hua"], "afternoon": ["Chen Jing"], "night": ["Yang Li"]},
        "Sunday": {"morning": ["Wang Fang"], "afternoon": ["Liu Ming"], "night": ["Chen Jing", "Yang Li"]},
    }
    
    sample_compliance = {
        "score": 85,
        "violations": [
            {"day": "Wednesday", "type": "understaffing", "shift": "night", "message": "Only 3 nurses for high ICU load"},
            {"day": "Friday", "type": "consecutive_nights", "nurse": "Liu Ming", "message": "4 consecutive night shifts"}
        ]
    }
    
    sample_nurses = [
        {"name": "Zhang Wei", "skill": "N4", "ward": "ICU"},
        {"name": "Li Hua", "skill": "N3", "ward": "ICU"},
        {"name": "Wang Fang", "skill": "N3", "ward": "ER"},
        {"name": "Liu Ming", "skill": "N2", "ward": "ER"},
        {"name": "Chen Jing", "skill": "N2", "ward": "General"},
        {"name": "Yang Li", "skill": "N1", "ward": "General"},
    ]
    
    insights = agent.learn_from_schedule(sample_schedule, sample_compliance, sample_nurses)
    
    print("\nExtracted Insights:")
    print(json.dumps(insights, indent=2, ensure_ascii=False))
    
    # Test get_scheduling_context
    print("\n3. Testing get_scheduling_context...")
    context = agent.get_scheduling_context()
    print(json.dumps(context, indent=2, ensure_ascii=False))
    
    print("\n" + "=" * 60)
    print("MEMORY AGENT TEST COMPLETE")
    print("=" * 60)
