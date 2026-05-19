"""
ForecastAgent - Predicts staffing requirements based on historical patient data.

This agent analyzes 30 days of historical patient volume to predict
minimum nurse requirements for each day of the week.
"""

import random
from datetime import datetime, timedelta
from typing import List, Dict, Any


class ForecastAgent:
    """
    ForecastAgent analyzes historical patient data to predict staffing needs.
    
    Methods:
        get_historical_data(): Returns 30 days of patient volume data
        predict(historical_data): Calculates staffing requirements per day
    """
    
    def __init__(self):
        """Initialize the ForecastAgent."""
        random.seed(42)  # For reproducible results
    
    def get_historical_data(self) -> List[Dict[str, Any]]:
        """
        Generate 30 days of historical patient volume data.
        
        Returns:
            List of 30 dicts, each with:
                - date: ISO format date string
                - patient_count: int (80-120 weekdays, 40-60 weekends, 
                                     3 random spikes above 150)
        """
        data = []
        base_date = datetime(2024, 1, 1)  # Starting date
        
        # Pick 3 random days for spikes
        spike_days = random.sample(range(30), 3)
        
        for i in range(30):
            current_date = base_date + timedelta(days=i)
            day_of_week = current_date.weekday()  # 0=Monday, 6=Sunday
            
            # Determine if weekend (Saturday=5, Sunday=6)
            is_weekend = day_of_week >= 5
            
            # Generate patient count
            if i in spike_days:
                # Spike day - above 150
                patient_count = random.randint(151, 180)
            elif is_weekend:
                # Weekend - lower volume (40-60)
                patient_count = random.randint(40, 60)
            else:
                # Weekday - normal volume (80-120)
                patient_count = random.randint(80, 120)
            
            data.append({
                "date": current_date.strftime("%Y-%m-%d"),
                "patient_count": patient_count,
                "day_of_week": current_date.strftime("%A")
            })
        
        return data
    
    def predict(self, historical_data: List[Dict[str, Any]], external_signals=None) -> Dict[str, int]:
        """
        Calculate staffing requirements based on historical patient averages
        and real external signals from BrightData.
        
        Args:
            historical_data: List of dicts with 'day_of_week' and 'patient_count'
            external_signals: Optional dict from BrightDataAgent with high_risk_days
        
        Returns:
            Dict mapping Monday-Sunday to minimum nurse counts:
                - Above 100 average: 4 nurses
                - 70-100 average: 3 nurses
                - Below 70: 2 nurses
                - Boosted by 1 on high-risk days from external signals
        """
        # Group patient counts by day of week
        day_totals = {
            "Monday": [],
            "Tuesday": [],
            "Wednesday": [],
            "Thursday": [],
            "Friday": [],
            "Saturday": [],
            "Sunday": []
        }
        
        for record in historical_data:
            day = record["day_of_week"]
            count = record["patient_count"]
            if day in day_totals:
                day_totals[day].append(count)
        
        # Get high risk days from BrightData if available
        high_risk_days = []
        if external_signals:
            high_risk_days = external_signals.get("high_risk_days", [])
            print(f"  [ForecastAgent] BrightData signals: {external_signals.get('recommendation', 'No specific recommendation')}")
        
        # Calculate averages and staffing requirements
        staffing_requirements = {}
        
        for day in ["Monday", "Tuesday", "Wednesday", "Thursday", 
                    "Friday", "Saturday", "Sunday"]:
            counts = day_totals[day]
            if counts:
                avg_count = sum(counts) / len(counts)
                
                # Determine minimum nurses needed
                if avg_count > 100:
                    min_nurses = 4
                elif avg_count >= 70:
                    min_nurses = 3
                else:
                    min_nurses = 2
                
                # Boost staffing on BrightData high risk days
                if day in high_risk_days:
                    min_nurses = min(min_nurses + 1, 5)
                    print(f"  [ForecastAgent] Boosted {day} staffing due to external signal")
                
                staffing_requirements[day] = min_nurses
            else:
                # Default if no data
                staffing_requirements[day] = 2
        
        return staffing_requirements


# Test the agent when run directly
if __name__ == "__main__":
    agent = ForecastAgent()
    
    print("=" * 60)
    print("ForecastAgent - Staffing Prediction Demo")
    print("=" * 60)
    
    # Get historical data
    print("\n📊 Generating 30 days of historical patient data...")
    historical_data = agent.get_historical_data()
    
    # Show sample of data
    print("\nSample data (first 7 days):")
    for record in historical_data[:7]:
        spike_indicator = " 🔥 SPIKE!" if record["patient_count"] > 150 else ""
        print(f"  {record['date']} ({record['day_of_week'][:3]}): "
              f"{record['patient_count']} patients{spike_indicator}")
    
    # Count spikes
    spikes = [r for r in historical_data if r["patient_count"] > 150]
    print(f"\n📈 Total spike days (>150 patients): {len(spikes)}")
    for spike in spikes:
        print(f"   {spike['date']}: {spike['patient_count']} patients")
    
    # Calculate predictions
    print("\n🎯 Predicting staffing requirements...")
    requirements = agent.predict(historical_data)
    
    print("\n" + "=" * 60)
    print("STAFFING REQUIREMENTS (Minimum Nurses Per Day):")
    print("=" * 60)
    for day, nurses in requirements.items():
        # Get the average for this day
        day_records = [r for r in historical_data if r["day_of_week"] == day]
        avg = sum(r["patient_count"] for r in day_records) / len(day_records)
        print(f"  {day:10s}: {nurses} nurses (avg {avg:.1f} patients)")
    
    print("\n" + "=" * 60)
    print("Final Output (for Scheduling Agent):")
    print("=" * 60)
    print(requirements)
    print()
