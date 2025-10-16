import json
import re
import ast

def extract_data_from_js(file_path):
    with open(file_path, 'r') as file:
        content = file.read()
        
    # Extract location data
    location_match = re.search(r'const locationData = \[(.*?)\];', content, re.DOTALL)
    charm_match = re.search(r'const charmData = \[(.*?)\];', content, re.DOTALL)
    
    if not location_match or not charm_match:
        raise ValueError("Could not find location or charm data in the file")
    
    # Safely parse the string content of the arrays into Python lists
    # ast.literal_eval is a safe alternative to eval() for literal structures
    location_data_str = f"[{location_match.group(1)}]"
    charm_data_str = f"[{charm_match.group(1)}]"

    location_data = ast.literal_eval(location_data_str)
    charm_data = ast.literal_eval(charm_data_str)
    
    return location_data, charm_data

def convert_to_json_format(data, name):
    return {
        "name": name,
        "locations": [
            {
                "x": item[0],
                "y": item[1],
                "image": item[2],
                "difficulty": item[3]
            }
            for item in data
        ]
    }

def main():
    # Get names from user
    normal_name = input("Enter a name for the normal locations dataset: ").strip()
    charm_name = input("Enter a name for the charm locations dataset: ").strip()
    
    # Extract data from JS file
    location_data, charm_data = extract_data_from_js("coordinatesData.js")
    
    # Convert to JSON format
    normal_json = convert_to_json_format(location_data, normal_name)
    charm_json = convert_to_json_format(charm_data, charm_name)
    
    # Save to files
    with open("normal.json", "w") as f:
        json.dump(normal_json, f, indent=2)
    
    with open("charms.json", "w") as f:
        json.dump(charm_json, f, indent=2)
    
    print("Successfully created normal.json and charms.json!")

if __name__ == "__main__":
    main() 