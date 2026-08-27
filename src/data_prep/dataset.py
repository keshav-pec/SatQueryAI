import os
import json
import torch
from torch.utils.data import Dataset, DataLoader

# Import the loader functions we wrote earlier
from src.data_prep.geotiff_loader import load_sentinel2_optical, load_sentinel1_sar

class SatQueryDataset(Dataset):
    """
    PyTorch Dataset for loading paired Sentinel-1, Sentinel-2, and text annotations.
    """
    def __init__(self, json_path, s1_dir, s2_dir):
        """
        Args:
            json_path (str): Path to the processed JSON (e.g., ben_sample.json).
            s1_dir (str): Path to the Sentinel-1 raw images folder.
            s2_dir (str): Path to the Sentinel-2 raw images folder.
        """
        self.s1_dir = s1_dir
        self.s2_dir = s2_dir
        
        # Load the JSON data into memory
        with open(json_path, 'r') as f:
            self.samples = json.load(f)

    def __len__(self):
        # Returns the total number of items in the dataset
        return len(self.samples)

    def __getitem__(self, idx):
        # 1. Get the text data for this specific index
        sample = self.samples[idx]
        patch_id = sample['patch_id']
        query_text = sample['query']
        answer_text = sample['answer']

        # 2. Construct the exact file paths for the images
        s1_path = os.path.join(self.s1_dir, f"{patch_id}_S1.tif")
        s2_path = os.path.join(self.s2_dir, f"{patch_id}_S2.tif")

        # 3. Load and normalize the images using our rasterio functions
        # If an image is missing, we throw an error (in production, we might skip it)
        if not os.path.exists(s1_path) or not os.path.exists(s2_path):
            raise FileNotFoundError(f"Missing images for patch_id: {patch_id}")

        s1_tensor = load_sentinel1_sar(s1_path)
        s2_tensor = load_sentinel2_optical(s2_path)

        # 4. Return the complete multimodal package
        return {
            "patch_id": patch_id,
            "s1_image": s1_tensor,     # Shape: (3, 120, 120)
            "s2_image": s2_tensor,     # Shape: (3, 120, 120)
            "query": query_text,
            "answer": answer_text
        }

# ==========================================
# SMOKE TEST (Run this file directly to test)
# ==========================================
if __name__ == "__main__":
    print("Testing the SatQueryDataset...\n")
    
    # Define our local paths
    json_path = "data/processed/ben_sample.json"
    s1_dir = "data/raw/Sentinel-1"
    s2_dir = "data/raw/Sentinel-2"
    
    # Initialize the dataset
    dataset = SatQueryDataset(json_path, s1_dir, s2_dir)
    print(f"✅ Successfully loaded dataset with {len(dataset)} samples.")
    
    # Fetch the very first item
    first_item = dataset[0]
    
    print("\n📦 Contents of Item 0:")
    print(f"Patch ID: {first_item['patch_id']}")
    print(f"Query: '{first_item['query']}'")
    print(f"Answer: '{first_item['answer']}'")
    print(f"S1 Tensor Shape: {first_item['s1_image'].shape} | Max Val: {first_item['s1_image'].max().item():.2f}")
    print(f"S2 Tensor Shape: {first_item['s2_image'].shape} | Max Val: {first_item['s2_image'].max().item():.2f}")
    
    # Test batching with a DataLoader
    print("\n🔄 Testing PyTorch DataLoader (Batch Size = 1)...")
    dataloader = DataLoader(dataset, batch_size=1, shuffle=True)
    batch = next(iter(dataloader))
    
    # Notice that the DataLoader adds an extra dimension at the front for the "batch" size.
    # So (3, 120, 120) becomes (1, 3, 120, 120)
    print(f"Batched S2 Tensor Shape: {batch['s2_image'].shape}")
    print("\n🎉 Phase 1 Data Pipeline is fully operational!")