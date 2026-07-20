from pathlib import Path
from PIL import Image
import math

INPUT_FOLDER = Path("data/icons/yields")
OUTPUT_FOLDER = Path("data/icons/yields")
OUTPUT_FOLDER.mkdir(exist_ok=True)

MAX_DISTANCE = 100  # Increase to keep more colors

for image_path in INPUT_FOLDER.iterdir():
    if image_path.suffix.lower() not in {".png", ".jpg", ".jpeg", ".bmp", ".gif", ".webp"}:
        continue

    img = Image.open(image_path).convert("RGBA")
    img.save(OUTPUT_FOLDER / (image_path.stem.replace(" icon (Civ6)","").replace("Icon ","").replace(" ","_").upper() + "_ICON.png"))

print("Done!")