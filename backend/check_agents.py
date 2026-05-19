"""
Check all agent imports are working.
Run this before starting the backend to verify all agents load correctly.
"""

import sys
import os

# Add agents directory to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "agents"))

print("=" * 70)
print("CHECKING ALL AGENT IMPORTS")
print("=" * 70)

agents_to_check = [
    ("agent0_ocr", "OCRAgent"),
    ("agent1_scheduler", "SchedulingAgent"),
    ("agent2_forecast", "ForecastAgent"),
    ("agent3_compliance", "ComplianceAgent"),
    ("agent4_emergency", "EmergencyAgent"),
    ("agent_brightdata", "BrightDataAgent"),
    ("agent_memory", "MemoryAgent"),
    ("orchestrator", "Orchestrator"),
]

all_passed = True

for module_name, class_name in agents_to_check:
    try:
        module = __import__(module_name, fromlist=[class_name])
        agent_class = getattr(module, class_name)
        print(f"✅ {class_name} imported successfully")
    except Exception as e:
        print(f"❌ FAILED: {class_name} — {str(e)}")
        all_passed = False

print("=" * 70)
if all_passed:
    print("✅ ALL AGENTS IMPORTED SUCCESSFULLY")
else:
    print("❌ SOME AGENTS FAILED TO IMPORT — FIX BEFORE STARTING BACKEND")
print("=" * 70)

sys.exit(0 if all_passed else 1)
