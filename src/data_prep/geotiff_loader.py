import rasterio
import numpy as np
import torch

def load_sentinel2_optical(filepath):
    """Reads Sentinel-2 GeoTIFF and extracts RGB bands."""
    with rasterio.open(filepath) as src:
        # Assumes standard ordering: Blue, Green, Red
        r, g, b = src.read(3), src.read(2), src.read(1)
        rgb = np.stack((r, g, b), axis=0)
        
    # Normalize from 0-4000 (reflectance) to 0.0-1.0
    normalized = np.clip(rgb, 0, 4000) / 4000.0
    return torch.tensor(normalized, dtype=torch.float32)

def load_sentinel1_sar(filepath):
    """Reads Sentinel-1 SAR (VV, VH) and creates a 3-channel pseudo-RGB."""
    with rasterio.open(filepath) as src:
        vv, vh = src.read(1), src.read(2)
        
        # Create a 3rd channel (ratio) for ViT compatibility
        ratio = vv / (vh + 1e-5)
        sar = np.stack((vv, vh, ratio), axis=0)
        
    # Normalize SAR dB values (typically -30 to 0) to 0.0-1.0
    normalized = (np.clip(sar, -30.0, 0.0) + 30.0) / 30.0
    return torch.tensor(normalized, dtype=torch.float32)