# train_model.py
from ultralytics import YOLO

print("[Train] Loading YOLOv8n model...")
model = YOLO('yolov8n.pt')

print("[Train] Starting training...")
print("[Train] Dataset: Surgical-Instruments-1/data.yaml")
print("[Train] Epochs: 30, Image size: 640, Batch: 16")
print("[Train] This will take 15-20 minutes...")
print()

results = model.train(
    data='Surgical-Instruments-1/data.yaml',
    epochs=30,
    imgsz=640,
    batch=16,
    verbose=True
)

print("\n[Train] Training complete!")
print("[Train] Best weights saved to: runs/detect/train/weights/best.pt")
