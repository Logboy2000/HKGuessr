### Downloads images from hollowknight.wiki automatically
import os
import requests
import tkinter as tk
from tkinter import filedialog, messagebox
from bs4 import BeautifulSoup
from urllib.parse import urljoin

# Function to fetch image links
def get_image_links(category_url):
    """Fetches image links from the given category page."""
    response = requests.get(category_url)
    soup = BeautifulSoup(response.text, "html.parser")
    
    image_links = []
    for img in soup.select(".gallerybox img"):  # Finds all images in the category
        img_url = img["src"].replace("/thumb", "").rsplit("/", 1)[0]  # Get full image URL
        image_links.append(urljoin(category_url, img_url))
    
    return image_links

# Function to download images
def download_images():
    category_url = url_entry.get()
    
    if not category_url.startswith("https://hollowknight.wiki/w/Category:"):
        messagebox.showerror("Error", "Please enter a valid Hollow Knight Wiki category URL.")
        return
    
    save_folder = filedialog.askdirectory(title="Select Download Folder")
    if not save_folder:
        return  # User canceled folder selection

    image_links = get_image_links(category_url)
    if not image_links:
        messagebox.showinfo("No Images", "No images found on this page.")
        return

    for img_url in image_links:
        filename = os.path.join(save_folder, img_url.split("/")[-1])
        status_label.config(text=f"Downloading {filename}...")
        root.update()  # Update UI
        
        response = requests.get(img_url, stream=True)
        if response.status_code == 200:
            with open(filename, "wb") as file:
                for chunk in response.iter_content(1024):
                    file.write(chunk)

    messagebox.showinfo("Download Complete", f"Downloaded {len(image_links)} images!")

# GUI Setup
root = tk.Tk()
root.title("Hollow Knight Wiki Image Downloader")
root.geometry("500x200")

tk.Label(root, text="Enter Wiki Category URL:").pack(pady=5)
url_entry = tk.Entry(root, width=50)
url_entry.pack(pady=5)
download_btn = tk.Button(root, text="Download Images", command=download_images)
download_btn.pack(pady=10)

status_label = tk.Label(root, text="")
status_label.pack()

root.mainloop()
