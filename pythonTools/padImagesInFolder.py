## Pads a folder of images with transparent pixels (Used on charm images)
from PIL import Image, ImageOps
import os
import tkinter as tk
from tkinter import filedialog

# --- CONFIGURATION ---
padding = 50  # Number of pixels to pad on each side
output_folder = os.path.join(folder_path, "padded_images")
os.makedirs(output_folder, exist_ok=True)
# ---------------------


# GUI 
root = tk.Tk()
root.withdraw()
folder_path = filedialog.askdirectory(title="Select Folder Containing Images")

if not folder_path:
    print("No folder selected. Exiting.")
    exit()

valid_extensions = ('.png', '.jpg', '.jpeg', '.bmp', '.gif', '.tiff', '.webp')

for filename in os.listdir(folder_path):
    if filename.lower().endswith(valid_extensions):
        input_path = os.path.join(folder_path, filename)
        output_path = os.path.join(output_folder, filename)

        with Image.open(input_path) as img:
            # Ensure image supports alpha channel
            img = img.convert("RGBA")
            # do padding
            padded_img = ImageOps.expand(img, border=padding, fill=(0, 0, 0, 0))

            padded_img.save(output_path)

print(f"Padded (transparent) images saved to: {output_folder}")
