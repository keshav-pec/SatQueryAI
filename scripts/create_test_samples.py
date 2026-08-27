import os
import requests
import numpy as np
import rasterio
from rasterio.transform import from_origin
from PIL import Image
import io

def create_real_sample(url, output_path, s1_path=None):
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    
    print(f"Downloading sample image from {url}...")
    response = requests.get(url)
    img = Image.open(io.BytesIO(response.content)).convert('RGB')
    
    # Resize to 256x256 for faster processing
    img = img.resize((256, 256))
    data = np.array(img).transpose(2, 0, 1) # (C, H, W)
    
    # Scale to 0-4000 to mimic our Sentinel-2 loader expectations
    data = (data / 255.0 * 4000).astype(np.float32)
    
    transform = from_origin(10.0, 50.0, 10, 10)
    
    # Write Sentinel-2 (Optical)
    with rasterio.open(
        output_path, 'w', driver='GTiff', height=256, width=256, count=3,
        dtype=str(data.dtype), crs='+proj=latlong', transform=transform,
    ) as dst:
        dst.write(data)
    print(f"Saved Optical image to {output_path}")

    # Write fake Sentinel-1 (Radar) if requested
    if s1_path:
        os.makedirs(os.path.dirname(s1_path), exist_ok=True)
        # S1 is 2 bands (VV, VH)
        s1_data = np.random.randint(-30, 0, size=(2, 256, 256)).astype(np.float32)
        with rasterio.open(
            s1_path, 'w', driver='GTiff', height=256, width=256, count=2,
            dtype=str(s1_data.dtype), crs='+proj=latlong', transform=transform,
        ) as dst:
            dst.write(s1_data)
        print(f"Saved Radar image to {s1_path}")

if __name__ == "__main__":
    # Sample 1: A clear view of a city/urban area
    create_real_sample(
        url="https://images.unsplash.com/photo-1480714378408-67cf0d13bc1b?w=500&q=80", # NY cityscape
        output_path="test_samples/urban_area_S2.tif",
        s1_path="test_samples/urban_area_S1.tif"
    )
    
    # Sample 2: A clear view of a forest/nature
    create_real_sample(
        url="https://images.unsplash.com/photo-1511497584788-876760111969?w=500&q=80", # Forest aerial
        output_path="test_samples/forest_area_S2.tif",
    )
    
    print("\n✅ Meaningful test samples created in the 'test_samples/' directory!")
