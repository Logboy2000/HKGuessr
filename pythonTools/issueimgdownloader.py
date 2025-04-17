### Gets images and names them based on github issues
import requests
import re
import os

# Prompt user for GitHub details
username = input("Enter your GitHub username: ").strip()
repo = input("Enter the repository name: ").strip()
token = input("Enter your GitHub Personal Access Token: ").strip()
start_issue = int(input("Enter the starting issue number: ").strip())

# GitHub API URL
api_url = f"https://api.github.com/repos/{username}/{repo}/issues"

# Request headers (for authentication)
headers = {
    "Authorization": f"token {token}",
    "Accept": "application/vnd.github.v3+json"
}

# Fetch open issues
response = requests.get(api_url, headers=headers)

if response.status_code != 200:
    print("❌ Failed to fetch issues. Check your credentials and repo name.")
    exit()

issues = response.json()

# Create folder to store images
os.makedirs("downloadedImages", exist_ok=True)

# Regular expressions
github_image_pattern = re.compile(r"!\[Image\]\((https://github\.com/user-attachments/assets/[^\s)]+)\)")
coord_pattern = re.compile(r"\*What are its coordinates on the map:\*\s*(\d+)_(\d+)")
difficulty_pattern = re.compile(r"\*What would you rate its difficulty/obscurity out of 10:\*\s*(\d+)")

image_urls = []

# Loop through each issue and extract images, coordinates, and difficulty
for issue in issues:
    issue_number = issue.get("number")
    if issue_number < start_issue:
        print(f"Skipping issue #{issue_number} (before starting issue {start_issue})")
        continue  # Skip issues before the starting issue number

    issue_title = issue.get("title")
    issue_body = issue.get("body", "")

    print("\n" + "="*40)
    print(f"Issue #{issue_number}: {issue_title}")
    print("="*40)
    print(issue_body)  # Print full issue body for debugging

    # Extract coordinates
    coord_match = coord_pattern.search(issue_body)
    if coord_match:
        coord_x, coord_y = coord_match.groups()
        print(f"✅ Found coordinates: {coord_x}_{coord_y}")
    else:
        print("❌ No coordinates found in this issue. Skipping...")
        continue  # Skip issues without coordinates

    # Extract difficulty rating
    difficulty_match = difficulty_pattern.search(issue_body)
    if difficulty_match:
        difficulty = difficulty_match.group(1)
    else:
        print("❌ No difficulty rating found. Skipping...")
        continue  # Skip issues without difficulty rating

    filename_prefix = f"{coord_x}_{coord_y}_{difficulty}"

    # Extract only GitHub user-uploaded images
    found_images = github_image_pattern.findall(issue_body)

    if found_images:
        print("🖼️ Extracted Image URLs:", found_images)
    else:
        print("❌ No valid images found in this issue.")
        continue  # Skip issues without images

    # Store images along with their filenames
    for img_url in found_images:
        image_urls.append((img_url, filename_prefix))

# Stop execution if no images were found
if not image_urls:
    print("\n⚠️ No valid images found in any issue.")
    exit()

# Download images
print(f"\n📥 Found {len(image_urls)} images. Downloading...")

for i, (url, filename_prefix) in enumerate(image_urls):
    response = requests.get(url)
    if response.status_code == 200:
        # Default file extension to .jpg since GitHub attachments lack extensions
        filename = f"downloadedImages/{filename_prefix}.jpg"
        with open(filename, "wb") as file:
            file.write(response.content)
        print(f"✅ Downloaded: {filename}")
    else:
        print(f"❌ Failed to download: {url}")

print("\n🎉 All images downloaded successfully!")