### Generates the locationData and charmData arrays used in script.js
import os
import re
from tkinter import Tk, filedialog

# Function to prompt user to select a folder
def pick_folder():
    root = Tk()
    root.withdraw()  # Hide the root window
    folder = filedialog.askdirectory(title="Select the folder containing images")
    return folder

# Prompt user to select the location folder
print("Select the folder containing location images:")
location_folder = pick_folder()

if not location_folder:
    print("❌ No folder selected for location images. Exiting...")
    exit()

# Prompt user to select the charms folder
print("Select the folder containing charms images:")
charms_folder = pick_folder()

if not charms_folder:
    print("❌ No folder selected for charms images. Exiting...")
    exit()

# Regex to extract coordinates, difficulty, and file extension from filenames (e.g., 2672_2453_5.jpg)
filename_pattern = re.compile(r"(\d+)_(\d+)_(\d+)\.(jpg|png|gif|bmp)")

# Lists to store location data
location_data = []
charms_data = []

# Scan location folder for images
for filename in os.listdir(location_folder):
    match = filename_pattern.match(filename)
    if match:
        map_x, map_y, difficulty, file_extension = match.groups()
        image_path = f"images/locations/{filename}"
        location_data.append(f"    [{map_x}, {map_y}, '{image_path}', {difficulty}],")

# Scan charms folder for images
for filename in os.listdir(charms_folder):
    match = filename_pattern.match(filename)
    if match:
        map_x, map_y, difficulty, file_extension = match.groups()
        image_path = f"images/charms/{filename}"
        charms_data.append(f"    [{map_x}, {map_y}, '{image_path}', {difficulty}],")

# Generate JavaScript code
output_js = """// Auto-generated location data from 'genLocationData.py'
const locationData = [
""" + "\n".join(location_data) + """
];

const charmData = [
""" + "\n".join(charms_data) + """
];
"""

# Save to a file
with open("coordinatesData.js", "w") as f:
    f.write(output_js)

print("✅ Location and charms data have been generated successfully!")
