# 🔬 SurgEye - Surgical Instrument Vision System

Real-time AI vision system for surgical instrument detection and tracking in the operating room.

## Features

- **Real-time Detection**: YOLOv8-powered instrument detection at 20+ FPS
- **Instrument Tracking**: Automatic counting and classification
- **Missing Item Alerts**: Audio + visual alerts when instruments go missing
- **Pre/Post-op Checks**: Baseline setting and final count verification
- **WebSocket Streaming**: Low-latency video feed to React dashboard

## Architecture

```
┌─────────────────┐      WebSocket       ┌──────────────────┐
│  React Frontend │ ◄──────────────────► │  FastAPI Backend │
│   (Port 5173)   │                      │   (Port 8000)    │
└─────────────────┘                      └──────────────────┘
                                                │
                                                ▼
                                        ┌──────────────────┐
                                        │   YOLOv8 Model   │
                                        │  (Instrument     │
                                        │   Detection)     │
                                        └──────────────────┘
```

## Quick Start

### Backend Setup

```bash
cd surgeye/backend

# Install dependencies
pip install -r requirements.txt

# Download YOLOv8 weights (auto-downloads on first run)
python -c "from ultralytics import YOLO; YOLO('yolov8s.pt')"

# Start server
python server.py
# Or: uvicorn server:app --reload
```

### Frontend Setup

```bash
cd surgeye/frontend

# Install dependencies
npm install

# Start dev server
npm run dev
```

### Access the App

- Frontend: http://localhost:5173
- Backend API: http://localhost:8000
- WebSocket: ws://localhost:8000/ws

## Usage

1. **Pre-operative**: Position camera to view all instruments, click "Set Baseline"
2. **During Surgery**: SurgEye automatically tracks instruments in real-time
3. **Alerts**: System alerts if any instrument goes missing
4. **Post-operative**: Click "End Procedure & Check" for final verification

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/` | GET | Health check |
| `/ws` | WebSocket | Real-time video stream |
| `/baseline` | POST | Set pre-op instrument baseline |
| `/check` | POST | Post-op instrument check |
| `/status` | GET | Current tracking status |
| `/reset` | POST | Reset for new procedure |

## Instrument Classes

Default classes (customize in `detect.py`):
- Forceps
- Scissors
- Retractor
- Clamp
- Needle holder
- Scalpel
- Surgical sponge
- Gauze
- Towel clip
- Hemostat

## Training Custom Model

1. Collect dataset (Roboflow Universe or custom)
2. Annotate with LabelImg or Roboflow
3. Train YOLOv8:

```python
from ultralytics import YOLO

model = YOLO('yolov8s.pt')
model.train(data='your_dataset.yaml', epochs=100, imgsz=640)
```

4. Update `CLASSES` in `detect.py`

## Performance Optimization

### For CPU-only systems:
```python
# Export to ONNX for faster inference
model.export(format='onnx')

# Use ONNX model
model = YOLO('yolov8s.onnx')
```

### Reduce resolution:
```python
# In detect.py, resize frame before detection
frame = cv2.resize(frame, (640, 480))
```

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Camera not opening | Check webcam index (0, 1, 2...) |
| Low FPS | Reduce resolution or use ONNX |
| False detections | Adjust `conf_threshold` |
| CORS errors | Ensure ports match in server.py |

## License

MIT License - Healthcare Innovation Project
