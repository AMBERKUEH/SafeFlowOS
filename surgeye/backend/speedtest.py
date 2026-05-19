# speedtest.py — run this alone
import cv2
import time

cap = cv2.VideoCapture(0)
print("Testing camera speed...")

start = time.time()
for i in range(30):
    ret, frame = cap.read()
    if ret:
        print(f"Frame {i}: {frame.shape}")
    else:
        print(f"Frame {i}: FAILED")

end = time.time()
print(f"\nResult: {30/(end-start):.1f} FPS")
print("Camera OK" if 30/(end-start) > 10 else "Camera is the bottleneck")
cap.release()
