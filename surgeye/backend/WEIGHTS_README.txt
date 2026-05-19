SURGeye YOLOv8 Weights Setup
============================

The trained model weights file (best.pt) should be placed in this folder:

    surgeye/backend/weights/best.pt

Current Status:
--------------
- Folder exists: weights/
- Pre-trained weights present: yolov8n.pt, yolov8s.pt (generic COCO dataset)

To use your trained surgical instrument model:
1. Train on Google Colab using the provided notebook
2. Download best.pt from Colab
3. Place it in: surgeye/backend/weights/best.pt

The system will automatically use best.pt if present, otherwise falls back to yolov8s.pt

Dataset Information:
-------------------
The Surgical-Instruments-1/ folder contains the training dataset with:
- 1702 training images
- 209 validation images  
- 15 instrument classes:
  * Army_navy, Bulldog, Castroviejo, Forceps, Frazier
  * Hemostat, Iris, Mayo_metz, Needle, Potts
  * Richardson, Scalpel, Towel_clip, Weitlaner, Yankauer

To re-download the dataset:
    python download_dataset.py

To train locally (15-20 min on CPU):
    python train_model.py
