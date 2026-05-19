import requests

class SurgEyeAgent:
    def __init__(self):
        self.surgeye_url = "http://localhost:8005"

    def baseline_scan(self, surgery_id):
        try:
            resp = requests.post(f"{self.surgeye_url}/api/demo/baseline")
            data = resp.json()
            return {
                "surgery_id": surgery_id,
                "scan_type": "baseline",
                "detected_items": list(data.get("baseline", {}).keys()),
                "status": "Baseline scan completed"
            }
        except Exception:
            # fallback if 8005 is down
            return {
                "surgery_id": surgery_id,
                "scan_type": "baseline",
                "detected_items": ["scalpel", "forceps", "clamp"],
                "status": "Baseline scan completed (demo fallback)"
            }

    def postop_scan(self, surgery_id, baseline_items):
        try:
            resp = requests.post(
                f"{self.surgeye_url}/api/demo/postop",
                params={"passed": "false"}  # always trigger alert for demo
            )
            data = resp.json()
            postop_items = list(data.get("current", {}).keys())
        except Exception:
            postop_items = ["scalpel", "forceps"]  # fallback

        missing_items = [i for i in baseline_items if i not in postop_items]
        return {
            "surgery_id": surgery_id,
            "scan_type": "postop",
            "detected_items": postop_items,
            "missing_items": missing_items,
            "alert": len(missing_items) > 0,
            "status": "Alert" if missing_items else "Clear"
        }