# save as download_dataset.py and run it
from roboflow import Roboflow

rf = Roboflow(api_key="bX5IkiMxH6IOh59gH6Ku")
project = rf.workspace("abhinav-ytcui").project("surgical-instruments-zmagm")
version = project.version(1)
dataset = version.download("yolov8")

print("Done! Dataset folder:", dataset.location)
