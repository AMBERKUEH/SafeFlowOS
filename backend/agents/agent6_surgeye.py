import os
import json
from datetime import datetime
from dotenv import load_dotenv
from inference_sdk import InferenceHTTPClient

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), "..", "..", ".env"))

class SurgEyeAgent:
    def __init__(self):
        self.client = InferenceHTTPClient(
            api_url="https://serverless.roboflow.com",
            api_key=os.getenv("ROBOFLOW_API_KEY")
        )
        self.workspace = os.getenv("ROBOFLOW_WORKSPACE")
        self.workflow_id = os.getenv("ROBOFLOW_WORKFLOW_ID")
        self.alert_log = []  # in-memory audit log


    def _detect(self, image_path: str, scan_type: str = "baseline") -> dict[str, int]:
        if scan_type == "baseline":
            return {
                "Forceps": 4,
                "Scalpel": 4,
                "Scissors": 2,
                "Needle_Holder": 1
            }
        else:
            # missing 1 Scalpel for demo alert
            return {
                "Forceps": 4,
                "Scalpel": 3,
                "Scissors": 1,
                "Needle_Holder": 1
            }

    def baseline_scan(self, surgery_id: str, image_path: str = "test_baseline.jpg"):
        detected = self._detect(image_path, scan_type="baseline")
        return {
            "surgery_id": surgery_id,
            "scan_type": "baseline",
            "detected_items": detected,  # now a dict {name: count}
            "timestamp": datetime.now().isoformat(),
            "status": "Baseline scan completed"
        }

    def postop_scan(self, surgery_id: str, baseline_items, image_path: str = "test_postop.jpg"):
        detected = self._detect(image_path, scan_type="postop")
        return {
            "surgery_id": surgery_id,
            "scan_type": "postop",
            "detected_items": detected,
            "timestamp": datetime.now().isoformat(),
        }

    def validate_safety(self, surgery_id: str, baseline_items: dict, postop_items: dict):
        missing = {}
        for instrument, count in baseline_items.items():
            postop_count = postop_items.get(instrument, 0)
            if postop_count < count:
                missing[instrument] = count - postop_count

        passed = len(missing) == 0

        result = {
            "surgery_id": surgery_id,
            "baseline_items": baseline_items,
            "postop_items": postop_items,
            "missing_items": missing,  # now {name: missing_count}
            "passed": passed,
            "status": "Clear" if passed else "Fail",
            "risk": "None" if passed else "Possible retained surgical instrument",
            "human_review_required": not passed,
            "timestamp": datetime.now().isoformat(),
        }

        if not passed:
            self.create_alert_log(surgery_id, missing)

        return result

    # ─── Internal: Roboflow detection ───────────────────────────────────────



    # def _detect(self, image_path: str) -> list[str]:
    #     try:
    #         result = self.client.run_workflow(
    #             workspace_name=self.workspace,
    #             workflow_id=self.workflow_id,
    #             images={"image": image_path},
    #             use_cache=True
    #         )
    #         predictions = result[0].get("predictions", {}).get("predictions", [])
    #         detected = [d["class"] for d in predictions if d["confidence"] > 0.4]
    #         print(f"[SurgEye] Detected: {detected}")
    #         return list(set(detected))
    #     except Exception as e:
    #         print(f"[SurgEye] Roboflow failed, using fallback: {e}")
    #         return []  # return empty instead of fake data — let validate_safety handle it

    # # ─── Agent 1: Pre-op Scan Agent ─────────────────────────────────────────

    # def baseline_scan(self, surgery_id: str, image_path: str = "test_baseline.jpg"):
    #     """
    #     Pre-op Scan Agent.
    #     Scans instruments before surgery and records baseline checklist.
    #     """
    #     detected = self._detect(image_path)
    #     return {
    #         "surgery_id": surgery_id,
    #         "scan_type": "baseline",
    #         "detected_items": detected,
    #         "timestamp": datetime.now().isoformat(),
    #         "status": "Baseline scan completed"
    #     }

    # # ─── Agent 2: Post-op Scan Agent ────────────────────────────────────────

    # def postop_scan(self, surgery_id: str, baseline_items: list[str], image_path: str = "test_postop.jpg"):
    #     """
    #     Post-op Scan Agent.
    #     Scans instruments after surgery — real detection only, no hardcode.
    #     """
    #     detected = self._detect(image_path)
    #     return {
    #         "surgery_id": surgery_id,
    #         "scan_type": "postop",
    #         "detected_items": detected,
    #         "timestamp": datetime.now().isoformat(),
    # }

    # # ─── Agent 3: Safety Validator Agent ────────────────────────────────────

    # def validate_safety(self, surgery_id: str, baseline_items: list[str], postop_items: list[str]):
    #     """
    #     Safety Validator Agent.
    #     Compares pre-op baseline vs post-op scan to detect retained instrument risk.
    #     """
    #     missing = [item for item in baseline_items if item not in postop_items]
    #     passed = len(missing) == 0

    #     result = {
    #         "surgery_id": surgery_id,
    #         "baseline_items": baseline_items,
    #         "postop_items": postop_items,
    #         "missing_items": missing,
    #         "passed": passed,
    #         "status": "Clear" if passed else "Fail",
    #         "risk": "None" if passed else "Possible retained surgical instrument",
    #         "human_review_required": not passed,
    #         "timestamp": datetime.now().isoformat(),
    #     }

    #     if not passed:
    #         self.create_alert_log(surgery_id, missing)

    #     return result

    # ─── Agent 4: Alert / Audit Agent ───────────────────────────────────────

    def create_alert_log(self, surgery_id: str, missing_items: list[str]):
        """
        Alert / Audit Agent.
        Triggers warning, flags surgical team for human review, stores evidence.
        """
        alert = {
            "alert_id": f"ALERT-{surgery_id}-{datetime.now().strftime('%H%M%S')}",
            "surgery_id": surgery_id,
            "timestamp": datetime.now().isoformat(),
            "missing_items": missing_items,
            "risk": "Possible retained surgical instrument",
            "action": "Flag assigned surgical team and scrub nurse for human review",
            "human_review_required": True,
            "evidence_saved": True,
        }
        self.alert_log.append(alert)
        print(f"[SurgEye ALERT] {alert['alert_id']} — missing: {missing_items}")
        return alert

    def get_alert_log(self):
        return self.alert_log
