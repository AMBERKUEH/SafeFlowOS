"""
SurgEye: Instrument Tracker Module
Enhanced with timeline logging and screenshot capture for alerts.
"""

from typing import Dict, List, Optional
from datetime import datetime
from detect import log_event, save_alert_screenshot, get_instrument_log, clear_instrument_log, get_alert_screenshots


class InstrumentTracker:
    """
    Tracks surgical instrument state throughout the procedure.
    Detects missing instruments by comparing current counts to baseline.
    """
    
    def __init__(self):
        self.baseline: Dict[str, int] = {}  # Set at pre-op - simple counts
        self.current: Dict[str, int] = {}   # Current frame counts
        self.alerts: List[str] = []          # Active alerts
        self.alert_history: List[Dict] = []  # All alerts with timestamps
        self.procedure_started = False
        self.procedure_ended = False
        self.previous_counts: Dict[str, int] = {}  # For detecting changes
        self.alert_screenshots: List[str] = []     # Paths to alert images
        self.baseline_timestamp: Optional[str] = None  # When baseline was set
        self.baseline_image: Optional[str] = None  # Screenshot of baseline
        
    def set_baseline(self, counts: Dict[str, int]):
        """
        Set the baseline instrument count at the start of procedure.
        
        Args:
            counts: Dictionary mapping instrument class to count (e.g., {'Forceps': 2, 'Hemostat': 1})
        """
        self.baseline = counts.copy()
        self.procedure_started = True
        self.procedure_ended = False
        self.alerts = []
        self.alert_screenshots = []
        self.baseline_timestamp = datetime.now().isoformat()
        clear_instrument_log()
        
        # Log baseline instruments
        for cls, count in counts.items():
            log_event(cls, 'baseline_set', count)
        
        print(f"[SurgEye] Baseline set: {self.baseline}")
        
    def get_baseline(self) -> Dict[str, int]:
        """
        Get the current baseline counts.
        
        Returns:
            Dictionary mapping instrument class to count
        """
        return self.baseline.copy()
    
    def is_baseline_set(self) -> bool:
        """
        Check if baseline has been set.
        
        Returns:
            True if baseline is set, False otherwise
        """
        return self.procedure_started and len(self.baseline) > 0
        
    def update(self, counts: Dict[str, int], current_frame=None) -> List[str]:
        """
        Update current counts and generate alerts for missing instruments.
        
        Args:
            counts: Current instrument counts from detection (simple dict like {'Forceps': 2})
            current_frame: Optional frame for screenshot capture
            
        Returns:
            List of alert messages
        """
        if not self.procedure_started:
            return ["⚠️ No baseline set - cannot track instruments"]
        
        self.current = counts.copy()
        new_alerts = []
        
        # Check for missing instruments
        for cls, expected in self.baseline.items():
            actual = counts.get(cls, 0)
            
            if actual < expected:
                missing = expected - actual
                alert_msg = f"MISSING: {missing}x {cls}"
                
                # Check if this is a new alert
                if alert_msg not in self.alerts:
                    new_alerts.append(alert_msg)
                    self.alert_history.append({
                        'timestamp': datetime.now().isoformat(),
                        'message': alert_msg,
                        'expected': expected,
                        'actual': actual,
                        'instrument': cls
                    })
                    
                    # Log the missing event
                    log_event(cls, 'missing', actual)
                    
                    # Save screenshot if frame provided
                    if current_frame is not None:
                        screenshot_path = save_alert_screenshot(current_frame, cls)
                        self.alert_screenshots.append(screenshot_path)
        
        # Check for returned instruments (were missing, now present)
        for cls in self.baseline:
            prev_count = self.previous_counts.get(cls, 0)
            curr_count = counts.get(cls, 0)
            expected = self.baseline.get(cls, 0)
            
            if prev_count < expected and curr_count == expected:
                log_event(cls, 'returned', curr_count)
        
        # Check for unexpected instruments (possible contamination)
        for cls, actual in counts.items():
            expected = self.baseline.get(cls, 0)
            if actual > expected:
                extra = actual - expected
                alert_msg = f"EXTRA: {extra}x {cls} (not in baseline)"
                if alert_msg not in self.alerts:
                    new_alerts.append(alert_msg)
        
        # Log newly detected instruments
        for cls in counts:
            if cls not in self.previous_counts or self.previous_counts.get(cls, 0) == 0:
                if counts[cls] > 0:
                    log_event(cls, 'detected', counts[cls])
        
        self.alerts = new_alerts
        self.previous_counts = counts.copy()
        return new_alerts
    
    def check_postop(self, final_counts: Dict[str, int] = None) -> Dict:
        """
        Perform post-operative instrument count check.
        
        Args:
            final_counts: Optional final counts to compare against baseline.
                         If not provided, uses self.current
        
        Returns:
            Dictionary with detailed check results:
            {
                "passed": True/False,
                "baseline": {"Forceps": 2, "Hemostat": 1},
                "final": {"Forceps": 2, "Hemostat": 0},
                "missing": {"Hemostat": 1},
                "extra": {},
                "summary": "MISSING: 1x Hemostat"
            }
        """
        if not self.procedure_started:
            return {
                'passed': False,
                'error': 'No baseline set'
            }
        
        self.procedure_ended = True
        
        # Use provided final counts or current counts
        final = final_counts if final_counts is not None else self.current
        
        # Calculate missing and extra items
        missing = {}
        extra = {}
        all_match = True
        
        # Check for missing items (less than baseline)
        for cls, expected in self.baseline.items():
            actual = final.get(cls, 0)
            if actual < expected:
                missing[cls] = expected - actual
                all_match = False
        
        # Check for extra items (more than baseline)
        for cls, actual in final.items():
            expected = self.baseline.get(cls, 0)
            if actual > expected:
                extra[cls] = actual - expected
                all_match = False
        
        # Build summary message
        summary_parts = []
        if missing:
            for cls, count in missing.items():
                summary_parts.append(f"{count}x {cls}")
            summary = "MISSING: " + ", ".join(summary_parts)
        elif extra:
            for cls, count in extra.items():
                summary_parts.append(f"{count}x {cls}")
            summary = "EXTRA: " + ", ".join(summary_parts)
        else:
            summary = "All instruments accounted for"
        
        return {
            'passed': all_match,
            'baseline': self.baseline.copy(),
            'final': final.copy(),
            'missing': missing,
            'extra': extra,
            'summary': summary,
            'alerts': self.alerts,
            'alert_history': self.alert_history,
            'timeline_log': get_instrument_log(),
            'alert_screenshots': self.alert_screenshots
        }
    
    def get_status(self) -> Dict:
        """
        Get current tracking status.
        
        Returns:
            Status dictionary
        """
        return {
            'procedure_started': self.procedure_started,
            'procedure_ended': self.procedure_ended,
            'baseline': self.baseline.copy() if self.baseline else {},
            'current': self.current.copy() if self.current else {},
            'alerts': self.alerts,
            'alert_count': len(self.alerts),
            'timeline_log': get_instrument_log(),
            'alert_screenshots': self.alert_screenshots,
            'baseline_timestamp': self.baseline_timestamp,
            'baseline_image': self.baseline_image
        }
    
    def reset(self):
        """Reset tracker for new procedure."""
        self.baseline = {}
        self.current = {}
        self.alerts = []
        self.alert_history = []
        self.previous_counts = {}
        self.alert_screenshots = []
        self.procedure_started = False
        self.procedure_ended = False
        self.baseline_timestamp = None
        self.baseline_image = None
        clear_instrument_log()


# Global tracker instance
tracker = InstrumentTracker()
