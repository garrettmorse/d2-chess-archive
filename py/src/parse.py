import cv2
import numpy as np
import os

input_folder = "data"
output_folder = "outimgs"
os.makedirs(output_folder, exist_ok=True)

def find_board(img) -> np.ndarray:
  gray = cv2.cvtColor(img,cv2.COLOR_BGR2GRAY)
  blur = cv2.GaussianBlur(gray,(7,7),0)
  blur = cv2.convertScaleAbs(blur, alpha=0.85, beta=0.1)
  _, thresh = cv2.threshold(blur, 70, 255, cv2.THRESH_BINARY)
  # cv2.imwrite('thresh.jpg',thresh)
  contours, _ = cv2.findContours(thresh, cv2.RETR_LIST, cv2.CHAIN_APPROX_SIMPLE)
  largest_square = None
  max_area = 0
  for cnt in contours:
      peri = cv2.arcLength(cnt, True)
      approx = cv2.approxPolyDP(cnt, 0.02 * peri, True)
      if len(approx) == 4 and cv2.isContourConvex(approx):
          area = cv2.contourArea(approx)
          if area > max_area:
              max_area = area
              largest_square = approx
  return largest_square

def order_points(pts):
    rect = np.zeros((4, 2), dtype="float32")
    s = pts.sum(axis=1)
    rect[0] = pts[np.argmin(s)]       # top-left
    rect[2] = pts[np.argmax(s)]       # bottom-right
    diff = np.diff(pts, axis=1)
    rect[1] = pts[np.argmin(diff)]    # top-right
    rect[3] = pts[np.argmax(diff)]    # bottom-left
    return rect

def normalize_board(board):
  bounding_rect = order_points(board)
  (tl, tr, br, bl) = bounding_rect
  widthA = np.linalg.norm(br - bl)
  widthB = np.linalg.norm(tr - tl)

  maxWidth = int(max(widthA, widthB))

  heightA = np.linalg.norm(tr - br)
  heightB = np.linalg.norm(tl - bl)
  maxHeight = int(max(heightA, heightB))

  dst = np.array([
    [0, 0],
    [maxWidth - 1, 0],
    [maxWidth - 1, maxHeight - 1],
    [0, maxHeight - 1]
  ], dtype="float32")

  M = cv2.getPerspectiveTransform(bounding_rect, dst)

  dst = cv2.warpPerspective(img, M, (maxWidth,maxHeight))

  return dst

for fname in os.listdir(input_folder):
  in_path = os.path.join(input_folder, fname)
  # skip non-images
  if not fname.lower().endswith((".png", ".jpg", ".jpeg", ".bmp", ".tiff")):
      continue
  img = cv2.imread(in_path)
  filename = os.path.splitext(fname)[0]
  board_np = find_board(img)

  board = board_np.reshape(4, 2).astype("float32")

  norm_board = normalize_board(board)

  out_warp = os.path.join(output_folder, f"{filename}_warped.jpg")
  cv2.imwrite(out_warp, norm_board)

