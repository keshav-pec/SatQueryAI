# filepath: scripts/download_data.py
import os
from datasets import load_dataset
import requests

# Set the base directory to our raw data folder
BASE_DIR = os.path.join(os.getcwd(), "data", "raw")
os.makedirs(BASE_DIR, exist_ok=True)

def download_huggingface_datasets():
    """
    Downloads datasets directly from the Hugging Face Hub.
    """
    print("🚀 Starting download for BigEarthNet.txt (This is a large file, please wait...)")
    # cache_dir forces the dataset to save inside our project folder instead of the hidden system cache
    ben_dataset = load_dataset(
        "BIFOLD-BigEarthNetv2-0/BigEarthNet.txt", 
        cache_dir=os.path.join(BASE_DIR, "BigEarthNet")
    )
    print("✅ BigEarthNet.txt downloaded successfully.\n")

    print("🚀 Starting download for VRSBench...")
    vrs_dataset = load_dataset(
        "xiang709/VRSBench", 
        cache_dir=os.path.join(BASE_DIR, "VRSBench")
    )
    print("✅ VRSBench downloaded successfully.\n")

def download_cdvqa():
    """
    CDVQA (Change Detection VQA) is often hosted on institutional servers or Google Drive.
    For the hackathon, ISRO/SAC usually provides a mirrored zip file link or requires you 
    to clone the academic repo. 
    """
    print("⚠️ For CDVQA and RSVQA: These are typically downloaded via direct ZIP links.")
    print("Please check the hackathon portal for the exact AWS S3 or Drive links provided by ISRO.")
    # Example wget logic if you have the direct link:
    # url = "YOUR_DIRECT_ZIP_LINK_HERE"
    # r = requests.get(url, stream=True)
    # with open(os.path.join(BASE_DIR, "CDVQA.zip"), 'wb') as f:
    #     for chunk in r.iter_content(chunk_size=8192):
    #         f.write(chunk)

if __name__ == "__main__":
    download_huggingface_datasets()
    download_cdvqa()
    print("🎉 All automated downloads complete! Check your data/raw/ folder.")