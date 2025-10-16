### Generates the locationData and charmData arrays used in script.js
import os
import re
import json
from tkinter import Tk, filedialog

# Function to prompt user to select a folder
def pick_folder():
    root = Tk()
    root.withdraw()  # Hide the root window
    folder = filedialog.askdirectory(title="Select the folder containing images")
    return folder

def get_valid_game_mode_id(prompt):
    while True:
        game_mode_id = input(prompt).strip().lower()
        if not game_mode_id:
            print("Game mode ID cannot be empty")
            continue
        if not game_mode_id.replace('_', '').isalnum():
            print("Game mode ID can only contain letters, numbers, and underscores")
            continue
        return game_mode_id

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

# Get dataset names and IDs from user
normal_name = input("Enter a name for the normal locations dataset: ").strip()
normal_id = get_valid_game_mode_id("Enter a game mode ID for normal locations (letters, numbers, underscores only): ")

charm_name = input("Enter a name for the charm locations dataset: ").strip()
charm_id = get_valid_game_mode_id("Enter a game mode ID for charm locations (letters, numbers, underscores only): ")

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
        location_data.append({
            "x": int(map_x),
            "y": int(map_y),
            "image": image_path,
            "difficulty": int(difficulty)
        })

# Scan charms folder for images
for filename in os.listdir(charms_folder):
    match = filename_pattern.match(filename)
    if match:
        map_x, map_y, difficulty, file_extension = match.groups()
        image_path = f"images/charms/{filename}"
        charms_data.append({
            "x": int(map_x),
            "y": int(map_y),
            "image": image_path,
            "difficulty": int(difficulty)
        })

# Create locationData directory if it doesn't exist
os.makedirs("locationData", exist_ok=True)

# Generate JSON data
normal_json = {
    "name": normal_name,
    "gameModeId": normal_id,
    "locations": location_data
}

charms_json = {
    "name": charm_name,
    "gameModeId": charm_id,
    "locations": charms_data
}

# Save to JSON files
with open("locationData/normal.json", "w") as f:
    json.dump(normal_json, f, indent=2)

with open("locationData/charms.json", "w") as f:
    json.dump(charms_json, f, indent=2)

print("✅ Location and charms data have been generated successfully!")
print("Files saved in locationData/normal.json and locationData/charms.json")
