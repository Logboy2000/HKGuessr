import os
from tkinter import Tk, filedialog
from PIL import Image

def pick_folder():
    root = Tk()
    root.withdraw()  # Hide the root window
    folder = filedialog.askdirectory(title="Select the folder containing images to rename")
    return folder

def get_valid_input(prompt, min_val=None, max_val=None):
    while True:
        try:
            value = int(input(prompt))
            if min_val is not None and value < min_val:
                print(f"Value must be at least {min_val}")
                continue
            if max_val is not None and value > max_val:
                print(f"Value must be at most {max_val}")
                continue
            return value
        except ValueError:
            print("Please enter a valid number")

def main():
    print("Select the folder containing images to rename:")
    folder = pick_folder()
    
    if not folder:
        print("❌ No folder selected. Exiting...")
        return

    # Get all image files in the folder
    image_extensions = ('.png', '.jpg', '.jpeg', '.gif', '.bmp')
    files = [f for f in os.listdir(folder) if f.lower().endswith(image_extensions)]
    
    if not files:
        print("❌ No image files found in the selected folder.")
        return

    print(f"\nFound {len(files)} image files.")
    print("For each image, you'll be prompted for:")
    print("- X coordinate (0-5000)")
    print("- Y coordinate (0-5000)")
    print("- Difficulty rating (1-10)")
    print("\nPress Ctrl+C to stop at any time.\n")

    for i, filename in enumerate(files, 1):
        print(f"\nImage {i}/{len(files)}: {filename}")
        
        # Get coordinates and difficulty
        x = get_valid_input("Enter X coordinate (0-5000): ", 0, 5000)
        y = get_valid_input("Enter Y coordinate (0-5000): ", 0, 5000)
        difficulty = get_valid_input("Enter difficulty (1-10): ", 1, 10)
        
        # Get file extension
        _, ext = os.path.splitext(filename)
        ext = ext.lower()
        
        # Create new filename
        new_filename = f"{x}_{y}_{difficulty}{ext}"
        
        # Check if file already exists
        if os.path.exists(os.path.join(folder, new_filename)):
            print(f"⚠️ Warning: {new_filename} already exists. Skipping...")
            continue
        
        # Rename the file
        try:
            old_path = os.path.join(folder, filename)
            new_path = os.path.join(folder, new_filename)
            os.rename(old_path, new_path)
            print(f"✅ Renamed: {filename} -> {new_filename}")
        except Exception as e:
            print(f"❌ Error renaming {filename}: {str(e)}")

    print("\nRenaming complete!")

if __name__ == "__main__":
    main() 