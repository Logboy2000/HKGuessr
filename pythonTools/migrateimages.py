#!/usr/bin/env python3
import os
import json
import time
import hashlib
import shutil
from pathlib import Path

def calculate_file_hash(filepath):
    """Calculate SHA-256 hash of file and return first 6 characters."""
    with open(filepath, 'rb') as f:
        return hashlib.sha256(f.read()).hexdigest()[:6]

def generate_new_filename(old_path, category):
    """Generate new filename based on the defined scheme."""
    path = Path(old_path)
    parts = path.stem.split('_')
    
    # Strip any existing category or timestamp prefixes
    if parts[0] in ['charms', 'locations']:  # Has category prefix
        parts = parts[1:]
    elif parts[0].isdigit() and len(parts[0]) > 8:  # Has timestamp
        parts = parts[1:]
    
    # Extract coordinates (always first two parts after stripping prefixes)
    coords = '_'.join(parts[:2])
    
    # Calculate hash
    file_hash = calculate_file_hash(old_path)
    
    # Generate new filename with category prefix
    return f"{category}_{coords}_{file_hash}{path.suffix}"

def update_json_file(json_path, old_to_new_map, category_dir):
    """Update image paths in JSON files."""
    with open(json_path, 'r') as f:
        data = json.load(f)
    
    # Create backup
    backup_path = f"{json_path}.backup"
    shutil.copy2(json_path, backup_path)
    print(f"Created backup of {json_path} at {backup_path}")

    # Update paths in locations
    for location in data['locations']:
        old_path = location['image']
        if old_path in old_to_new_map:
            location['image'] = f"images/{category_dir}/{old_to_new_map[old_path]}"

    # Save updated JSON
    with open(json_path, 'w') as f:
        json.dump(data, f, indent=2)
    print(f"Updated {json_path} with new image paths")

def migrate_images():
    """Main migration function."""
    base_dir = Path(__file__).parent
    categories = {
        'charms': {'dir': 'charms', 'json': 'locationData/charms.json'},
        'locations': {'dir': 'locations', 'json': 'locationData/normal.json'}
    }

    for category, info in categories.items():
        image_dir = base_dir / 'images' / info['dir']
        json_file = base_dir / info['json']
        
        # Create backup directory
        backup_dir = base_dir / 'backup' / 'images' / info['dir']
        backup_dir.mkdir(parents=True, exist_ok=True)
        
        # Track old to new filename mappings
        old_to_new_map = {}
        
        # Process each image
        for img_path in image_dir.glob('*.*'):
            if img_path.suffix.lower() in ['.png', '.jpg', '.jpeg']:
                # Create backup
                shutil.copy2(img_path, backup_dir / img_path.name)
                
                # Generate new filename
                new_name = generate_new_filename(img_path, category)
                new_path = image_dir / new_name
                
                # Store mapping
                old_to_new_map[str(img_path.relative_to(base_dir))] = new_name
                
                # Rename file
                shutil.move(img_path, new_path)
                print(f"Migrated: {img_path.name} -> {new_name}")
        
        # Update JSON file
        if old_to_new_map:
            update_json_file(json_file, old_to_new_map, info['dir'])

if __name__ == '__main__':
    print("Starting image migration...")
    print("Backups will be created in the 'backup' directory.")
    try:
        migrate_images()
        print("\nMigration completed successfully!")
        print("Backups are stored in the 'backup' directory")
    except Exception as e:
        print(f"\nError during migration: {e}")
        print("Please restore from backups if needed")
