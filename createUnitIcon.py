from pathlib import Path
from PIL import Image
import math

INPUT_FOLDER = Path("data/icons/unitsDirty")
OUTPUT_FOLDER = Path("data/icons/units")
OUTPUT_FOLDER.mkdir(exist_ok=True)

MAX_DISTANCE = 100  # Increase to keep more colors

for image_path in INPUT_FOLDER.iterdir():
    if image_path.suffix.lower() not in {".png", ".jpg", ".jpeg", ".bmp", ".gif", ".webp"}:
        continue

    img = Image.open(image_path).convert("RGBA")
    pixels = img.load()

    width, height = img.size

    for y in range(height):
        for x in range(width):
            r, g, b, a = pixels[x, y]

            distance = math.sqrt((255 - r) ** 2 + (255 - g) ** 2 + (255 - b) ** 2)

            if distance <= MAX_DISTANCE:
                pixels[x, y] = (r, g, b, a)
            else:
                pixels[x, y] = (r, g, b, 0)

    img.save(OUTPUT_FOLDER / (image_path.stem.replace(" icon (Civ6)","").replace(" ","_").upper() + "_ICON.png"))

print("Done!")