"""
SurgEye: Surgical Instrument Detection Module
Uses local YOLOv8 for fast inference - no API lag.
"""

from ultralytics import YOLO
import cv2
import numpy as np
import os
from datetime import datetime
from typing import List, Dict, Tuple, Any
from collections import Counter, deque

# Surgical instrument classes (15 classes from dataset)
CLASSES = [
    'Army_navy', 'Bulldog', 'Castroviejo', 'Forceps', 'Frazier',
    'Hemostat', 'Iris', 'Mayo_metz', 'Needle', 'Potts',
    'Richardson', 'Scalpel', 'Towel_clip', 'Weitlaner', 'Yankauer'
]

# ✅ Unique colors per instrument class (BGR format for OpenCV)
CLASS_COLORS = {
    'Army_navy':   (0, 255, 0),      # Green
    'Bulldog':     (255, 0, 0),      # Blue
    'Castroviejo': (0, 165, 255),    # Orange
    'Forceps':     (255, 255, 0),    # Yellow
    'Frazier':     (255, 0, 255),    # Pink/Magenta
    'Hemostat':    (0, 255, 255),    # Cyan
    'Iris':        (128, 0, 255),    # Purple
    'Mayo_metz':   (0, 128, 255),    # Light Blue
    'Needle':      (255, 128, 0),    # Dark Orange
    'Potts':       (0, 255, 128),    # Mint
    'Richardson':  (128, 255, 0),    # Lime
    'Scalpel':     (255, 0, 128),    # Rose
    'Towel_clip':  (0, 0, 255),      # Red
    'Weitlaner':   (128, 128, 255),  # Light Purple
    'Yankauer':    (255, 255, 128),  # Light Yellow
}

# Detection stability buffer
STABILITY_FRAMES = 3
frame_buffer = deque(maxlen=STABILITY_FRAMES)

# Instrument timeline log
instrument_log: List[Dict[str, Any]] = []

# Create alerts directory
os.makedirs('alerts', exist_ok=True)

# Load YOLOv8 model (local - no API lag!)
print("[SurgEye] Loading YOLOv8 model locally...")
try:
    # Try to load trained model first (drop best.pt in surgeye/backend/weights/)
    trained_model_path = 'weights/best.pt'
    if os.path.exists(trained_model_path):
        model = YOLO(trained_model_path)
        print(f"[SurgEye] Loaded trained model: {trained_model_path}")
    else:
        # Fall back to pretrained YOLOv8s
        model = YOLO('yolov8s.pt')
        print("[SurgEye] Loaded YOLOv8s (pretrained)")
except Exception as e:
    print(f"[SurgEye] Error loading model: {e}")
    model = None


def detect_frame(frame: np.ndarray, conf_threshold: float = 0.5) -> Tuple[np.ndarray, List[Dict[str, Any]]]:
    """
    Detect surgical instruments using local YOLOv8 (FAST - no API lag).
    
    Args:
        frame: Input image/frame (numpy array)
        conf_threshold: Confidence threshold for detections (default 50%)
        
    Returns:
        Tuple of (annotated_frame, detections_list)
    """
    detections = []
    annotated = frame.copy()
    
    if model is None:
        print("[SurgEye] Model not loaded!")
        return annotated, detections
    
    try:
        # Run inference with local YOLOv8 (FAST!)
        results = model(frame, conf=conf_threshold, verbose=False)[0]
        
        for box in results.boxes:
            confidence = float(box.conf)
            class_id = int(box.cls)
            class_name = CLASSES[class_id] if class_id < len(CLASSES) else f'class_{class_id}'
            
            # Get bounding box
            x1, y1, x2, y2 = map(int, box.xyxy[0])
            cx, cy = map(int, box.xywh[0][:2])
            
            detection = {
                'class': class_name,
                'confidence': round(confidence, 2),
                'bbox': [x1, y1, x2, y2],
                'center': [cx, cy]
            }
            detections.append(detection)
            
            # ✅ Use unique color per instrument class
            color = CLASS_COLORS.get(class_name, (255, 255, 255))
            cv2.rectangle(annotated, (x1, y1), (x2, y2), color, 2)
            
            # Draw label with confidence percentage
            label = f"{class_name} {confidence:.0%}"
            label_size = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.5, 2)[0]
            label_y = y1 - 10 if y1 - 10 > 10 else y1 + 20
            
            # Label background with instrument color
            cv2.rectangle(annotated, 
                         (x1, label_y - label_size[1] - 4),
                         (x1 + label_size[0], label_y + 4),
                         color, -1)
            
            # Label text (black for contrast)
            cv2.putText(annotated, label,
                       (x1, label_y),
                       cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 0, 0), 2)
    
    except Exception as e:
        print(f"[SurgEye] Detection error: {e}")
        import traceback
        traceback.print_exc()
    
    return annotated, detections


def get_confidence_color(confidence: float) -> Tuple[int, int, int]:
    """Get color based on confidence level."""
    if confidence >= 0.8:
        return (0, 255, 0)  # Green - High confidence
    elif confidence >= 0.6:
        return (0, 255, 200)  # Teal - Medium confidence
    else:
        return (0, 165, 255)  # Orange - Low confidence


def get_stable_detections(detections: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Get stable detections that appear in consecutive frames.
    Reduces flickering by requiring 3-frame confirmation.
    """
    frame_buffer.append(detections)
    
    if len(frame_buffer) < STABILITY_FRAMES:
        return detections  # Not enough frames yet
    
    # Count occurrences of each instrument class across frames
    all_detections = []
    for frame_dets in frame_buffer:
        all_detections.extend(frame_dets)
    
    # Group by class and find stable detections
    class_groups = {}
    for det in all_detections:
        cls = det['class']
        if cls not in class_groups:
            class_groups[cls] = []
        class_groups[cls].append(det)
    
    stable_detections = []
    for cls, dets in class_groups.items():
        if len(dets) >= STABILITY_FRAMES:
            # Use the detection with highest confidence
            best_det = max(dets, key=lambda x: x['confidence'])
            stable_detections.append(best_det)
    
    return stable_detections


def log_event(cls: str, action: str, confidence: float = None):
    """
    Log instrument event to timeline.
    
    Args:
        cls: Instrument class name
        action: 'detected', 'removed', 'missing', or 'returned'
        confidence: Detection confidence (optional)
    """
    event = {
        'instrument': cls,
        'action': action,
        'time': datetime.now().strftime('%H:%M:%S'),
        'timestamp': datetime.now().isoformat(),
        'confidence': confidence
    }
    instrument_log.append(event)
    print(f"[SurgEye Log] {event['time']} - {cls} {action}")


def get_instrument_log() -> List[Dict[str, Any]]:
    """Get the full instrument timeline log."""
    return instrument_log.copy()


def clear_instrument_log():
    """Clear the instrument log (for new procedure)."""
    global instrument_log
    instrument_log = []
    frame_buffer.clear()


def save_alert_screenshot(frame: np.ndarray, missing_instrument: str):
    """
    Save screenshot when instrument goes missing.
    
    Args:
        frame: Current video frame
        missing_instrument: Name of missing instrument
    """
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    filename = f"alert_{missing_instrument}_{timestamp}.jpg"
    filepath = os.path.join('alerts', filename)
    
    # Add alert text to screenshot
    alert_frame = frame.copy()
    alert_text = f"ALERT: {missing_instrument} MISSING"
    cv2.putText(alert_frame, alert_text, (50, 50),
               cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 0, 255), 3)
    cv2.putText(alert_frame, datetime.now().strftime('%Y-%m-%d %H:%M:%S'), 
               (50, 100), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 2)
    
    cv2.imwrite(filepath, alert_frame)
    print(f"[SurgEye] Alert screenshot saved: {filepath}")
    return filepath


def get_alert_screenshots() -> List[str]:
    """Get list of all alert screenshot files."""
    if not os.path.exists('alerts'):
        return []
    return sorted([f for f in os.listdir('alerts') if f.endswith('.jpg')], reverse=True)


def count_by_class(detections: List[Dict[str, Any]]) -> Dict[str, int]:
    """
    Count instruments by class.
    
    Args:
        detections: List of detection dictionaries
        
    Returns:
        Dictionary mapping class names to counts
    """
    counts = {}
    for d in detections:
        cls = d['class']
        counts[cls] = counts.get(cls, 0) + 1
    return counts


def get_max_counts_from_frames(frames_detections: List[Dict[str, int]]) -> Dict[str, int]:
    """
    Get maximum count seen for each instrument class across multiple frames.
    
    Args:
        frames_detections: List of count dictionaries from multiple frames
        
    Returns:
        Dictionary with maximum count for each class
    """
    max_counts = {}
    for frame_counts in frames_detections:
        for cls, count in frame_counts.items():
            if count > max_counts.get(cls, 0):
                max_counts[cls] = count
    return max_counts


def export_to_onnx():
    """
    Export YOLO model to ONNX format for faster CPU inference.
    Run this once to generate yolov8s.onnx
    """
    model.export(format='onnx')
    print("Model exported to ONNX format: yolov8s.onnx")


if __name__ == "__main__":
    # Test with webcam
    cap = cv2.VideoCapture(0)
    
    print("SurgEye Detection Test - Press 'q' to quit")
    
    while True:
        ret, frame = cap.read()
        if not ret:
            break
        
        annotated, detections = detect_frame(frame)
        counts = count_by_class(detections)
        
        # Display counts on frame
        y_offset = 30
        for cls, count in counts.items():
            text = f"{cls}: {count}"
            cv2.putText(annotated, text, (10, y_offset), 
                       cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 0), 2)
            y_offset += 30
        
        cv2.imshow('SurgEye - Instrument Detection', annotated)
        
        if cv2.waitKey(1) & 0xFF == ord('q'):
            break
    
    cap.release()
    cv2.destroyAllWindows()
