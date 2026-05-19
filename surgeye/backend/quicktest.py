# quicktest.py - Test the trained model
from ultralytics import YOLO
import os

# Try to load trained model
trained_model_path = 'weights/best.pt'
if os.path.exists(trained_model_path):
    model = YOLO(trained_model_path)
    print(f"✅ Loaded trained model: {trained_model_path}")
else:
    print("❌ Trained model not found. Run training first!")
    exit(1)

print("\nClasses:", model.names)
print(f"Total classes: {len(model.names)}")

# Test on a sample image from dataset
sample_image = 'Surgical-Instruments-1/test/images/File00877_jpg.rf.0c4b7a8a1e5f3d2b1c9e8f7a6b5c4d3e.jpg'
if os.path.exists(sample_image):
    print(f"\n🧪 Testing on: {sample_image}")
    results = model(sample_image, conf=0.3)
    print(f"Found {len(results[0].boxes)} instruments")
    for box in results[0].boxes:
        class_id = int(box.cls)
        conf = float(box.conf)
        print(f"  → {model.names[class_id]} ({conf:.0%})")
    results[0].show()
else:
    print("\n⚠️ Sample image not found. Training is still in progress or check the test folder.")
