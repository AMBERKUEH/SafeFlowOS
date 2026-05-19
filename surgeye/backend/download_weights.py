# download_weights.py
from roboflow import Roboflow

print("[Download] Connecting to Roboflow...")
rf = Roboflow(api_key="bX5IkiMxH6IOh59gH6Ku")
project = rf.workspace("abhinav-ytcui").project("surgical-instruments-zmagm")
version = project.version(1)

print("[Download] Downloading YOLOv8 weights...")
# download dataset + weights locally
version.download("yolov8")  # saves to your folder
print("[Download] Done! Check the folder for .pt file")
