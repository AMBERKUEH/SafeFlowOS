"""
SurgEye: FastAPI WebSocket Server
Real-time instrument detection streaming with WebSocket support.
"""

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
import cv2
import base64
import json
import asyncio
from typing import Optional

from detect import detect_frame, count_by_class, get_max_counts_from_frames, get_instrument_log, get_alert_screenshots
from tracker import tracker
from rostering_agent import trigger_rostering_alert, rostering_agent
from database import (
    init_database, seed_dummy_data, get_all_nurses,
    create_surgery_session, end_surgery_session, save_baseline_to_session, 
    save_postop_to_session, get_session
)

app = FastAPI(title="SurgEye API", version="1.0.0")

# Initialize database on startup
init_database()
seed_dummy_data()

# Enable CORS for React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173", "http://localhost:5174", "http://localhost:5175", "http://localhost:5176", "http://localhost:5177", "http://localhost:5178", "http://localhost:5179", "http://localhost:5180"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global state
active_connections: list[WebSocket] = []
video_source: Optional[cv2.VideoCapture] = None

# Surgery session state
active_session: Optional[Dict] = None


@app.get("/")
async def root():
    """Health check endpoint."""
    return {
        "status": "SurgEye API Running",
        "version": "1.0.0",
        "endpoints": [
            "/ws - WebSocket stream",
            "/api/session/start - Start surgery session",
            "/api/session/end - End surgery session",
            "/api/session/current - Get current session",
            "/api/baseline - Set pre-op baseline",
            "/api/postop - Post-op check",
            "/api/status - Current status"
        ]
    }


# ============ Session Management ============

@app.post("/api/session/start")
async def start_session(nurse_id: str = "nurse-001", nurse_name: str = "Sarah Chen"):
    """
    Start a new surgery session.
    """
    global active_session
    from datetime import datetime
    from uuid import uuid4
    
    session_id = create_surgery_session(nurse_id, nurse_name)
    
    active_session = {
        "session_id": session_id,
        "nurse_id": nurse_id,
        "nurse_name": nurse_name,
        "started_at": datetime.now().isoformat(),
        "status": "active"
    }
    
    # Reset tracker for new session
    tracker.reset()
    
    return {
        "session_id": session_id,
        "nurse": nurse_name,
        "started_at": active_session["started_at"],
        "status": "active"
    }


# ============ DEMO ENDPOINTS (For Presentation) ============

@app.post("/api/demo/baseline")
async def demo_set_baseline():
    """
    DEMO: Set fake baseline data without camera (for presentation).
    """
    global active_session
    from datetime import datetime
    
    if not active_session:
        return {"status": "error", "message": "No active session - start session first"}
    
    # Fake baseline data
    fake_baseline = {
        "Forceps": 2,
        "Hemostat": 1,
        "Scalpel": 1,
        "Army_navy": 3,
        "Towel_clip": 2
    }
    
    tracker.set_baseline(fake_baseline)
    tracker.baseline_timestamp = datetime.now().isoformat()
    
    # Save to database
    save_baseline_to_session(active_session["session_id"], fake_baseline, None)
    
    return {
        "status": "baseline locked",
        "baseline": fake_baseline,
        "screenshot": None,
        "session_id": active_session["session_id"],
        "timestamp": tracker.baseline_timestamp,
        "note": "DEMO MODE - Fake data for presentation"
    }


@app.post("/api/demo/postop")
async def demo_postop_check(passed: bool = True):
    """
    DEMO: Set fake post-op result without camera (for presentation).
    """
    global active_session
    from datetime import datetime
    
    if not active_session:
        return {"status": "error", "message": "No active session"}
    
    if not tracker.is_baseline_set():
        return {"status": "error", "message": "Please set baseline first"}
    
    if passed:
        # All instruments accounted for
        final_counts = tracker.baseline.copy()
        missing = {}
        extra = {}
        summary = "All instruments accounted for"
    else:
        # Missing Hemostat
        final_counts = tracker.baseline.copy()
        final_counts["Hemostat"] = 0
        missing = {"Hemostat": 1}
        extra = {}
        summary = "MISSING: 1x Hemostat"
    
    result = {
        "passed": passed,
        "baseline": tracker.baseline.copy(),
        "final": final_counts,
        "missing": missing,
        "extra": extra,
        "summary": summary,
        "postop_image": None,
        "session_id": active_session["session_id"],
        "note": "DEMO MODE - Fake data for presentation"
    }
    
    investigation_id = None
    
    # If failed, trigger investigation
    if not passed:
        evidence = {
            "baseline_image": tracker.baseline_image,
            "postop_image": None,
            "timeline": []
        }
        
        rostering_result = await trigger_rostering_alert(
            missing_items=missing,
            nurse_id=active_session["nurse_id"],
            nurse_name=active_session["nurse_name"],
            session_id=active_session["session_id"],
            evidence=evidence
        )
        
        result["investigation"] = rostering_result
        investigation_id = rostering_result.get("investigation_id")
    
    # Save to database
    save_postop_to_session(
        active_session["session_id"], 
        final_counts, 
        None, 
        investigation_id
    )
    
    return result


@app.get("/api/demo/sessions")
async def get_demo_sessions():
    """
    Get all surgery sessions (including demo ones).
    """
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('SELECT * FROM surgery_sessions ORDER BY started_at DESC')
    rows = cursor.fetchall()
    conn.close()
    
    sessions = []
    for row in rows:
        session = dict(row)
        if session.get('baseline_counts'):
            session['baseline_counts'] = json.loads(session['baseline_counts'])
        if session.get('final_counts'):
            session['final_counts'] = json.loads(session['final_counts'])
        sessions.append(session)
    
    return {"sessions": sessions}


@app.post("/api/session/end")
async def end_session():
    """
    End the current surgery session.
    """
    global active_session
    from datetime import datetime
    
    if not active_session:
        return {"error": "No active session"}
    
    # End session in database
    end_surgery_session(active_session["session_id"])
    
    started = datetime.fromisoformat(active_session["started_at"])
    duration = datetime.now() - started
    duration_mins = int(duration.total_seconds() / 60)
    
    result = {
        "session_id": active_session["session_id"],
        "duration": f"{duration_mins} mins",
        "status": "complete"
    }
    
    active_session = None
    return result


@app.get("/api/session/current")
async def get_current_session():
    """
    Get current active session info.
    """
    if not active_session:
        return {"active": False}
    
    from datetime import datetime
    started = datetime.fromisoformat(active_session["started_at"])
    duration = datetime.now() - started
    duration_str = f"{int(duration.total_seconds() / 3600):02d}:{int((duration.total_seconds() % 3600) / 60):02d}:{int(duration.total_seconds() % 60):02d}"
    
    return {
        "active": True,
        "session_id": active_session["session_id"],
        "nurse": active_session["nurse_name"],
        "started_at": active_session["started_at"],
        "duration": duration_str
    }


@app.post("/api/baseline")
async def set_baseline():
    """
    Set the baseline instrument count at the start of procedure.
    Captures 30 frames and takes maximum count seen for each instrument.
    """
    global active_session
    from datetime import datetime
    import base64
    
    if not active_session:
        return {"status": "error", "message": "No active session - start session first"}
    
    cap = cv2.VideoCapture(0)
    if not cap.isOpened():
        return {"status": "error", "message": "Cannot open camera"}
    
    try:
        # Warm up camera
        for _ in range(5):
            cap.read()
        
        # Capture 30 frames
        all_counts = []
        last_annotated_frame = None
        
        for i in range(30):
            ret, frame = cap.read()
            if not ret:
                continue
            
            # Resize for speed
            frame = cv2.resize(frame, (640, 480))
            
            # Run detection
            annotated, detections = detect_frame(frame, conf_threshold=0.5)
            last_annotated_frame = annotated
            
            # Count instruments in this frame
            counts = count_by_class(detections)
            all_counts.append(counts)
            
            await asyncio.sleep(0.033)  # ~30 FPS
        
        # Get maximum count for each instrument across all frames
        baseline_counts = get_max_counts_from_frames(all_counts)
        
        # Set baseline in tracker
        tracker.set_baseline(baseline_counts)
        tracker.baseline_timestamp = datetime.now().isoformat()
        
        # Save baseline screenshot
        screenshot_b64 = None
        if last_annotated_frame is not None:
            _, buf = cv2.imencode('.jpg', last_annotated_frame, [cv2.IMWRITE_JPEG_QUALITY, 85])
            screenshot_b64 = base64.b64encode(buf).decode()
            tracker.baseline_image = screenshot_b64
        
        # Save to database
        save_baseline_to_session(active_session["session_id"], baseline_counts, screenshot_b64)
        
        return {
            "status": "baseline locked",
            "baseline": baseline_counts,
            "screenshot": screenshot_b64,
            "session_id": active_session["session_id"],
            "timestamp": tracker.baseline_timestamp
        }
        
    finally:
        cap.release()


@app.post("/api/postop")
async def postop_check():
    """
    Perform post-operative instrument count check.
    Captures 30 frames and compares against baseline.
    """
    global active_session
    from datetime import datetime
    import base64
    
    if not active_session:
        return {"status": "error", "message": "No active session"}
    
    if not tracker.is_baseline_set():
        return {"status": "error", "message": "Please set baseline first"}
    
    cap = cv2.VideoCapture(0)
    if not cap.isOpened():
        return {"status": "error", "message": "Cannot open camera"}
    
    try:
        # Warm up camera
        for _ in range(5):
            cap.read()
        
        # Capture 30 frames
        all_counts = []
        last_annotated_frame = None
        
        for i in range(30):
            ret, frame = cap.read()
            if not ret:
                continue
            
            frame = cv2.resize(frame, (640, 480))
            annotated, detections = detect_frame(frame, conf_threshold=0.5)
            last_annotated_frame = annotated
            
            counts = count_by_class(detections)
            all_counts.append(counts)
            
            await asyncio.sleep(0.033)
        
        # Get maximum count for each instrument
        final_counts = get_max_counts_from_frames(all_counts)
        
        # Compare against baseline
        result = tracker.check_postop(final_counts)
        
        # Save post-op screenshot
        postop_image_b64 = None
        if last_annotated_frame is not None:
            _, buf = cv2.imencode('.jpg', last_annotated_frame, [cv2.IMWRITE_JPEG_QUALITY, 85])
            postop_image_b64 = base64.b64encode(buf).decode()
        
        result["postop_image"] = postop_image_b64
        result["session_id"] = active_session["session_id"]
        
        investigation_id = None
        
        # If failed, trigger investigation
        if not result["passed"]:
            evidence = {
                "baseline_image": tracker.baseline_image,
                "postop_image": postop_image_b64,
                "timeline": result.get("timeline_log", [])
            }
            
            rostering_result = await trigger_rostering_alert(
                missing_items=result["missing"],
                nurse_id=active_session["nurse_id"],
                nurse_name=active_session["nurse_name"],
                session_id=active_session["session_id"],
                evidence=evidence
            )
            
            result["investigation"] = rostering_result
            investigation_id = rostering_result.get("investigation_id")
        
        # Save to database
        save_postop_to_session(
            active_session["session_id"], 
            final_counts, 
            postop_image_b64, 
            investigation_id
        )
        
        return result
        
    finally:
        cap.release()


@app.get("/status")
async def get_status():
    """Get current tracking status."""
    return tracker.get_status()


@app.get("/timeline")
async def get_timeline():
    """Get instrument timeline log."""
    return {
        "timeline": get_instrument_log(),
        "event_count": len(get_instrument_log())
    }


@app.get("/alerts/screenshots")
async def get_screenshots():
    """Get list of alert screenshots."""
    return {
        "screenshots": get_alert_screenshots(),
        "count": len(get_alert_screenshots())
    }


# ============ Investigation API Endpoints ============

@app.get("/api/investigations")
async def api_get_investigations():
    """Get all investigations."""
    investigations = rostering_agent.get_investigations()
    return {"investigations": investigations}


@app.get("/api/investigations/{investigation_id}")
async def api_get_investigation(investigation_id: str):
    """Get investigation by ID with full evidence."""
    investigation = rostering_agent.get_investigation(investigation_id)
    if not investigation:
        return {"error": "Investigation not found"}
    return investigation


@app.get("/api/violations")
async def api_get_violations():
    """Get all violations."""
    violations = rostering_agent.get_violations()
    return {"violations": violations}


@app.get("/api/nurse/{nurse_id}/status")
async def api_get_nurse_status(nurse_id: str):
    """Get nurse status with any active violations."""
    status = rostering_agent.get_nurse_status(nurse_id)
    return status


@app.post("/api/trigger-investigation")
async def api_trigger_investigation(
    missing_items: dict,
    nurse_id: str = "nurse-001",
    nurse_name: str = "Sarah Chen",
    surgery_id: str = None,
    baseline_image: str = None,
    postop_image: str = None
):
    """Manually trigger an investigation (for testing)."""
    from datetime import datetime
    
    if surgery_id is None:
        surgery_id = f"surgery-{datetime.now().strftime('%Y%m%d-%H%M%S')}"
    
    evidence = {
        "baseline_image": baseline_image,
        "postop_image": postop_image,
        "timeline": []
    }
    
    result = await trigger_rostering_alert(
        missing_items=missing_items,
        nurse_id=nurse_id,
        nurse_name=nurse_name,
        session_id=surgery_id,
        evidence=evidence
    )
    
    return result


@app.get("/api/nurses")
async def api_get_nurses():
    """Get all nurses."""
    return {"nurses": get_all_nurses()}


@app.post("/scan-baseline")
async def scan_baseline():
    """
    Phase 1: Pre-op scan - nurse points camera at instrument tray.
    Captures 30 frames and takes most common detection as baseline.
    """
    cap = cv2.VideoCapture(0)
    if not cap.isOpened():
        return {"error": "Cannot open camera"}
    
    try:
        # Warm up camera
        for _ in range(5):
            cap.read()
        
        # Capture 30 frames
        all_detections = []
        for i in range(30):
            ret, frame = cap.read()
            if not ret:
                continue
            
            # Resize for speed
            frame = cv2.resize(frame, (640, 480))
            
            # Run detection
            _, detections = detect_frame(frame, conf_threshold=0.5)
            all_detections.extend(detections)
            
            await asyncio.sleep(0.033)  # ~30 FPS
        
        # Count occurrences per class
        class_counts = {}
        for d in all_detections:
            cls = d['class']
            class_counts[cls] = class_counts.get(cls, 0) + 1
        
        # Normalize: divide by 10 to get actual count (30 frames / 3 = ~10 samples)
        baseline = {cls: max(1, count // 10) for cls, count in class_counts.items()}
        
        # Set baseline in tracker
        tracker.set_baseline(baseline)
        
        # Save baseline image
        ret, frame = cap.read()
        if ret:
            cv2.imwrite(f"baseline_{datetime.now().strftime('%H%M%S')}.jpg", frame)
        
        return {
            "status": "baseline_locked",
            "baseline": baseline,
            "frames_captured": 30,
            "total_detections": len(all_detections)
        }
        
    finally:
        cap.release()


@app.post("/scan-postop")
async def scan_postop():
    """
    Phase 2: Post-op scan - verify all instruments present.
    Returns PASS/FAIL and triggers rostering agent if needed.
    """
    cap = cv2.VideoCapture(0)
    if not cap.isOpened():
        return {"error": "Cannot open camera"}
    
    try:
        # Warm up camera
        for _ in range(5):
            cap.read()
        
        # Capture 30 frames
        all_detections = []
        for i in range(30):
            ret, frame = cap.read()
            if not ret:
                continue
            
            frame = cv2.resize(frame, (640, 480))
            _, detections = detect_frame(frame, conf_threshold=0.5)
            all_detections.extend(detections)
            
            await asyncio.sleep(0.033)
        
        # Count final instruments
        final_counts = {}
        for d in all_detections:
            cls = d['class']
            final_counts[cls] = final_counts.get(cls, 0) + 1
        
        # Normalize
        final_counts = {cls: max(1, count // 10) for cls, count in final_counts.items()}
        
        # Compare to baseline
        baseline_simple = {cls: info['count'] for cls, info in tracker.baseline.items()} if tracker.baseline else {}
        
        passed = final_counts == baseline_simple
        
        # Find missing items
        missing = {}
        for cls, expected in baseline_simple.items():
            actual = final_counts.get(cls, 0)
            if actual < expected:
                missing[cls] = expected - actual
        
        # Save post-op image
        ret, frame = cap.read()
        if ret:
            cv2.imwrite(f"postop_{datetime.now().strftime('%H%M%S')}.jpg", frame)
        
        result = {
            "passed": passed,
            "baseline": baseline_simple,
            "final": final_counts,
            "missing": missing,
            "timestamp": datetime.now().isoformat()
        }
        
        # If failed, trigger rostering agent
        if not passed:
            result["alert"] = "INSTRUMENTS MISSING - ROSTERING AGENT TRIGGERED"
            
            # Trigger AI Agent: Perceive → Reason → Act
            rostering_result = await trigger_rostering_alert(
                missing_items=missing,
                nurse_id="NURSE_001",  # TODO: Get from session
                nurse_name="Unknown"   # TODO: Get from session
            )
            result["rostering_action"] = rostering_result
        
        return result
        
    finally:
        cap.release()


@app.post("/reset")
async def reset_tracker():
    """Reset tracker for new procedure."""
    tracker.reset()
    return {"status": "reset complete"}


cap = None  # Global camera instance

def get_camera():
    """Get or initialize camera with optimized settings."""
    global cap
    if cap is None or not cap.isOpened():
        cap = cv2.VideoCapture(0)
        cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
        cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
        cap.set(cv2.CAP_PROP_FPS, 30)
        print("[Camera] Initialized")
    return cap

@app.websocket("/ws")
async def websocket_stream(websocket: WebSocket):
    """
    WebSocket endpoint with proper error handling and auto-reconnect support.
    Includes investigation_id and flagged_nurse when missing instruments detected.
    """
    await websocket.accept()
    active_connections.append(websocket)
    print("[WS] Client connected")
    
    frame_count = 0
    last_detections = []
    last_counts = {}
    pending_investigation = None  # Store investigation result for WebSocket
    
    try:
        while True:
            # Get camera with auto-reinit if needed
            camera = get_camera()
            ret, frame = camera.read()
            
            if not ret:
                print("[WS] Camera read failed, retrying...")
                await asyncio.sleep(0.1)
                continue
            
            frame_count += 1
            
            # Only run detection every 5th frame — BIG speed improvement
            if frame_count % 5 == 0:
                try:
                    annotated, last_detections = detect_frame(frame, conf_threshold=0.5)
                    last_counts = count_by_class(last_detections)
                except Exception as e:
                    print(f"[WS] Detection error: {e}")
                    annotated = frame  # use raw frame if detection fails
            else:
                annotated = frame  # send raw frame for smooth video
            
            # Update tracker if baseline is set
            alerts = []
            if tracker.procedure_started:
                try:
                    alerts = tracker.update(last_counts, current_frame=frame)
                    
                    # If missing instrument alert, trigger rostering agent
                    if alerts and any('MISSING' in str(a) for a in alerts):
                        # Get missing items from tracker
                        missing = {}
                        if tracker.baseline:
                            for cls, expected in tracker.baseline.items():
                                current_count = last_counts.get(cls, 0)
                                if current_count < expected:
                                    missing[cls] = expected - current_count
                        
                        if missing and not pending_investigation and active_session:
                            # Trigger rostering agent
                            result = await trigger_rostering_alert(
                                missing_items=missing,
                                nurse_id=active_session["nurse_id"],
                                nurse_name=active_session["nurse_name"]
                            )
                            pending_investigation = result
                except Exception as e:
                    print(f"[WS] Tracker error: {e}")
            else:
                tracker.current = last_counts
            
            # Resize + compress aggressively
            annotated = cv2.resize(annotated, (640, 480))
            _, buf = cv2.imencode('.jpg', annotated, 
                                  [cv2.IMWRITE_JPEG_QUALITY, 50])
            img_b64 = base64.b64encode(buf).decode()
            
            # Build payload with investigation info if available
            payload_data = {
                'frame': img_b64,
                'counts': last_counts,
                'detections': last_detections,
                'alerts': alerts,
                'procedure_started': tracker.procedure_started,
                'procedure_ended': tracker.procedure_ended,
                'baseline': tracker.baseline if tracker.procedure_started else None,
                'baseline_timestamp': tracker.baseline_timestamp,
                'session': active_session
            }
            
            # Add investigation info if triggered
            if pending_investigation:
                payload_data['investigation_id'] = pending_investigation.get('investigation_id')
                payload_data['flagged_nurse'] = pending_investigation.get('flagged_nurse')
            
            payload = json.dumps(payload_data)
            
            await websocket.send_text(payload)
            await asyncio.sleep(0.033)  # cap at ~30fps
            
    except WebSocketDisconnect:
        print("[WS] Client disconnected — waiting for reconnect")
    except Exception as e:
        print(f"[WS] Unexpected error: {e}")
        import traceback
        traceback.print_exc()
    finally:
        print("[WS] Connection closed cleanly")
        if websocket in active_connections:
            active_connections.remove(websocket)


@app.websocket("/ws/video/{video_path:path}")
async def websocket_video_stream(websocket: WebSocket, video_path: str):
    """
    WebSocket endpoint for streaming from video file.
    Usage: ws://localhost:8000/ws/video/path/to/video.mp4
    """
    await websocket.accept()
    
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        await websocket.send_text(json.dumps({
            "error": f"Cannot open video: {video_path}"
        }))
        await websocket.close()
        return
    
    try:
        while True:
            ret, frame = cap.read()
            if not ret:
                # Loop video
                cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
                continue
            
            annotated, detections = detect_frame(frame)
            counts = count_by_class(detections)
            
            if tracker.procedure_started:
                alerts = tracker.update(counts)
            else:
                alerts = []
                tracker.current = counts
            
            _, buffer = cv2.imencode('.jpg', annotated)
            img_b64 = base64.b64encode(buffer).decode('utf-8')
            
            await websocket.send_text(json.dumps({
                "frame": img_b64,
                "counts": counts,
                "detections": detections,
                "alerts": alerts
            }))
            
            await asyncio.sleep(0.05)
            
    except WebSocketDisconnect:
        print("[SurgEye] Video client disconnected")
    finally:
        cap.release()


if __name__ == "__main__":
    import uvicorn
    PORT = 8005  # Use different port to avoid conflict
    print("=" * 60)
    print("SURGEYE SURGICAL INSTRUMENT VISION SYSTEM")
    print("=" * 60)
    print(f"Starting server on http://localhost:{PORT}")
    print(f"WebSocket: ws://localhost:{PORT}/ws")
    print("=" * 60)
    uvicorn.run(app, host="0.0.0.0", port=PORT)
