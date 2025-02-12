### Generates the locationData array used in script.js
import os
import re
from tkinter import Tk, filedialog

# Function to prompt user to select a folder
def pick_folder():
    root = Tk()
    root.withdraw()  # Hide the root window
    folder = filedialog.askdirectory(title="Select the folder containing images")
    return folder

# Prompt user to select the folder
image_folder = pick_folder()

if not image_folder:
    print("❌ No folder selected. Exiting...")
    exit()

# Regex to extract coordinates, difficulty, and file extension from filenames (e.g., 2672_2453_5.jpg)
filename_pattern = re.compile(r"(\d+)_(\d+)_(\d+)\.(jpg|png|gif|bmp)")

# List to store location data
location_data = []

# Scan folder for images
for filename in os.listdir(image_folder):
    match = filename_pattern.match(filename)
    if match:
        map_x, map_y, difficulty, file_extension = match.groups()  # Unpack all four groups
        image_path = f"images/screenshots/{filename}"
        location_data.append(f"    [{map_x}, {map_y}, '{image_path}', {difficulty}],")

# Generate JavaScript code
output_js = """// Auto-generated location data from 'genLocationData.py'
const locationData = [
""" + "\n".join(location_data) + """
];
"""

# Save to a file
with open("locationData.js", "w") as f:
    f.write(output_js)

print("✅ Location data has been generated successfully!")