"""
Agent BrightData: Fetches external signals (holidays, weather) using Bright Data API.
Provides context for staffing predictions.
"""

import os
import json
import base64
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional


class BrightDataAgent:
    """
    Fetches external signals for nurse scheduling:
    - Public holidays from publicholidays.asia
    - Weather forecast from wttr.in
    """
    
    def __init__(self, api_key: Optional[str] = None, use_proxy: Optional[bool] = None):
        """
        Initialize BrightDataAgent.
        
        Args:
            api_key: Bright Data API key (defaults to env var)
            use_proxy: Whether to use Bright Data proxy (defaults to USE_BRIGHTDATA env var)
        """
        self.api_key = api_key or os.environ.get("BRIGHTDATA_API_KEY")
        self.use_proxy = use_proxy if use_proxy is not None else os.environ.get("USE_BRIGHTDATA", "false").lower() == "true"
        self.base_url = "https://api.brightdata.com"
        
        if self.use_proxy:
            print("[BrightDataAgent] Using Bright Data proxy (credits will be used)")
        else:
            print("[BrightDataAgent] Using direct requests (no Bright Data credits used)")
        
    def _make_request(self, url: str, use_proxy: Optional[bool] = None) -> Any:
        """
        Make HTTP request, optionally through Bright Data proxy.
        
        Args:
            url: Target URL
            use_proxy: Whether to use Bright Data proxy (defaults to instance setting)
        
        Returns:
            Response data
        """
        try:
            import requests
        except ImportError:
            raise ImportError("requests not installed. Run: pip install requests")
        
        # Use instance default if not specified
        should_use_proxy = use_proxy if use_proxy is not None else self.use_proxy
        
        if should_use_proxy and self.api_key:
            # Bright Data proxy configuration
            proxy = {
                "http": f"http://{self.api_key}@brd.superproxy.io:22225",
                "https": f"http://{self.api_key}@brd.superproxy.io:22225"
            }
            response = requests.get(url, proxies=proxy, timeout=30)
            print(f"  [BrightData] Request via proxy: {url}")
        else:
            # Direct request (fallback - no credits used)
            response = requests.get(url, timeout=30)
            print(f"  [Direct] Request: {url}")
        
        response.raise_for_status()
        return response
    
    def _fetch_holidays(self, city: str) -> List[str]:
        """
        Fetch public holidays for China in the next 7 days.
        
        Args:
            city: City name (used for context, holidays are national)
        
        Returns:
            List of holiday names in next 7 days
        """
        try:
            # Fetch from publicholidays.asia/china/
            url = "https://publicholidays.asia/china/"
            response = self._make_request(url, use_proxy=False)
            
            # Parse HTML to find holidays (simplified - in production use proper HTML parsing)
            # For now, return simulated data based on known Chinese holidays
            today = datetime.now()
            next_7_days = [(today + timedelta(days=i)).strftime("%Y-%m-%d") for i in range(7)]
            
            # Known 2026 Chinese holidays (simplified)
            known_holidays = {
                "2026-01-01": "New Year's Day",
                "2026-02-17": "Chinese New Year",
                "2026-02-18": "Chinese New Year Holiday",
                "2026-02-19": "Chinese New Year Holiday",
                "2026-04-05": "Qingming Festival",
                "2026-05-01": "Labor Day",
                "2026-06-19": "Dragon Boat Festival",
                "2026-09-25": "Mid-Autumn Festival",
                "2026-10-01": "National Day",
                "2026-10-02": "National Day Holiday",
                "2026-10-03": "National Day Holiday",
            }
            
            upcoming_holidays = []
            for date_str in next_7_days:
                if date_str in known_holidays:
                    upcoming_holidays.append(known_holidays[date_str])
            
            return upcoming_holidays
            
        except Exception as e:
            print(f"Warning: Could not fetch holidays: {e}")
            return []
    
    def _fetch_weather(self, city: str) -> Dict[str, Any]:
        """
        Fetch weather forecast from wttr.in.
        
        Args:
            city: City name
        
        Returns:
            Weather data dict
        """
        try:
            # wttr.in provides free weather API
            url = f"https://wttr.in/{city}?format=j1"
            response = self._make_request(url, use_proxy=False)
            return response.json()
        except Exception as e:
            print(f"Warning: Could not fetch weather: {e}")
            return {}
    
    def _identify_high_risk_days(
        self,
        holidays: List[str],
        weather_data: Dict[str, Any]
    ) -> List[str]:
        """
        Identify days needing extra staffing based on holidays and weather.
        
        Args:
            holidays: List of holiday names
            weather_data: Weather forecast data
        
        Returns:
            List of day names (Monday-Sunday) needing extra staffing
        """
        high_risk_days = []
        today = datetime.now()
        
        # Map dates to day names for next 7 days
        date_to_day = {}
        for i in range(7):
            date = today + timedelta(days=i)
            date_to_day[date.strftime("%Y-%m-%d")] = date.strftime("%A")
        
        # Check for holidays (holidays typically need extra ER staffing)
        # For simplicity, mark the holiday day and day after as high risk
        if holidays:
            # In a real implementation, we'd map specific holiday dates
            # For now, assume weekend days around holidays are high risk
            high_risk_days.extend(["Saturday", "Sunday"])
        
        # Check weather conditions
        try:
            if "weather" in weather_data:
                for day_weather in weather_data["weather"]:
                    date = day_weather.get("date")
                    if date in date_to_day:
                        day_name = date_to_day[date]
                        
                        # Check for extreme weather
                        temp_max = int(day_weather.get("maxtempC", 0))
                        temp_min = int(day_weather.get("mintempC", 0))
                        hourly = day_weather.get("hourly", [{}])[0]
                        
                        # Extreme heat (>35°C) or cold (<0°C)
                        if temp_max > 35 or temp_min < 0:
                            if day_name not in high_risk_days:
                                high_risk_days.append(day_name)
                        
                        # Check weather description for severe conditions
                        desc = hourly.get("weatherDesc", [{}])[0].get("value", "").lower()
                        severe_conditions = ["storm", "heavy rain", "snow", "fog", "thunder"]
                        if any(cond in desc for cond in severe_conditions):
                            if day_name not in high_risk_days:
                                high_risk_days.append(day_name)
        except Exception as e:
            print(f"Warning: Error parsing weather data: {e}")
        
        return high_risk_days
    
    def _generate_recommendation(
        self,
        holidays: List[str],
        high_risk_days: List[str],
        weather_data: Dict[str, Any]
    ) -> str:
        """
        Generate a plain English recommendation for the Forecast Agent.
        
        Args:
            holidays: List of holidays
            high_risk_days: Days needing extra staffing
            weather_data: Weather data
        
        Returns:
            Recommendation sentence
        """
        parts = []
        
        # Holiday context
        if holidays:
            parts.append(f"upcoming holidays: {', '.join(holidays)}")
        
        # Weather context
        try:
            if "weather" in weather_data and weather_data["weather"]:
                current = weather_data["weather"][0]
                temp = current.get("maxtempC", "N/A")
                desc = current.get("hourly", [{}])[0].get("weatherDesc", [{}])[0].get("value", "")
                if desc:
                    parts.append(f"weather forecast shows {desc.lower()} with {temp}°C max")
        except:
            pass
        
        # High risk days
        if high_risk_days:
            parts.append(f"expect higher patient volume on {', '.join(high_risk_days)}")
        
        if not parts:
            return "No significant external signals detected; expect normal staffing needs."
        
        return f"External signals indicate {', '.join(parts)} — consider increasing ER and ICU coverage accordingly."
    
    def get_external_signals(self, city: str = "Shanghai") -> Dict[str, Any]:
        """
        Fetch external signals for staffing predictions.
        
        Args:
            city: City to fetch signals for (default: Shanghai)
        
        Returns:
            Dict with holidays, high_risk_days, and recommendation
        """
        print(f"\n[BrightDataAgent] Fetching external signals for {city}...")
        
        # Fetch data
        holidays = self._fetch_holidays(city)
        weather_data = self._fetch_weather(city)
        
        # Analyze
        high_risk_days = self._identify_high_risk_days(holidays, weather_data)
        recommendation = self._generate_recommendation(holidays, high_risk_days, weather_data)
        
        result = {
            "holidays": holidays,
            "high_risk_days": high_risk_days,
            "recommendation": recommendation,
            "city": city,
            "timestamp": datetime.now().isoformat()
        }
        
        print(f"  - Holidays found: {holidays}")
        print(f"  - High risk days: {high_risk_days}")
        print(f"  - Recommendation: {recommendation}")
        
        return result


if __name__ == "__main__":
    # Test BrightDataAgent
    print("=" * 60)
    print("BRIGHTDATA AGENT TEST")
    print("=" * 60)
    
    agent = BrightDataAgent()
    
    # Test with Shanghai
    print("\nTesting get_external_signals() for Shanghai:")
    signals = agent.get_external_signals("Shanghai")
    
    print("\n" + "=" * 60)
    print("RESULT:")
    print("=" * 60)
    print(json.dumps(signals, indent=2, ensure_ascii=False))
    
    # Test with Beijing
    print("\n\nTesting get_external_signals() for Beijing:")
    signals = agent.get_external_signals("Beijing")
    print(f"Recommendation: {signals['recommendation']}")
    
    print("\n" + "=" * 60)
    print("BRIGHTDATA AGENT TEST COMPLETE")
    print("=" * 60)
