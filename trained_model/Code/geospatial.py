import rasterio
from pathlib import Path
from typing import Optional
import math


def extract_geospatial_metadata(tiff_path: str) -> Optional[dict]:
    """
    Extract geospatial metadata from a GeoTIFF file.
    
    Returns dict with:
    - crs: Coordinate Reference System (e.g., "EPSG:4326")
    - bounds: (left, bottom, right, top) in CRS units
    - transform: Affine transform for georeferencing
    - description: human-readable location description
    """
    try:
        with rasterio.open(tiff_path) as src:
            crs = str(src.crs)
            bounds = src.bounds
            width = src.width
            height = src.height
            transform = src.transform
            
            left, bottom, right, top = bounds
            
            description = f"({top:.4f}°N, {left:.4f}°E) to ({bottom:.4f}°N, {right:.4f}°E)"
            
            return {
                "crs": crs,
                "bounds": {
                    "left": float(left),
                    "bottom": float(bottom),
                    "right": float(right),
                    "top": float(top),
                },
                "width": width,
                "height": height,
                "description": description,
                "transform": {
                    "a": float(transform.a),
                    "b": float(transform.b),
                    "c": float(transform.c),
                    "d": float(transform.d),
                    "e": float(transform.e),
                    "f": float(transform.f),
                },
                # estimate pixel area in square meters where possible
                "pixel_area_sqm": _estimate_pixel_area_sqm(src)
            }
    except Exception as e:
        print(f"Error extracting geospatial metadata: {e}")
        return None


def find_first_geotiff(directory: str) -> Optional[str]:
    """Find the first GeoTIFF file in a directory (for metadata extraction)."""
    path = Path(directory)
    for tiff_file in path.glob("*.tif"):
        return str(tiff_file)
    for tiff_file in path.glob("*.tiff"):
        return str(tiff_file)
    return None


def _estimate_pixel_area_sqm(src) -> Optional[float]:
    """Estimate the area of one pixel in square meters.

    For projected CRS (units in meters) this is simply abs(xres * yres).
    For geographic CRS (degrees), approximate conversion at center latitude
    using meters-per-degree approximations.
    """
    try:
        res = src.res  # (xres, yres)
        xres, yres = float(res[0]), float(res[1])
        # If CRS is geographic (degrees)
        crs = src.crs
        if crs is None:
            return None
        crs_str = str(crs)
        # bounds
        bounds = src.bounds
        left, bottom, right, top = bounds
        center_lat = (top + bottom) / 2.0

        if '4326' in crs_str or 'EPSG:4326' in crs_str or crs.is_geographic:
            # approximate meters per degree at center latitude
            lat_rad = math.radians(center_lat)
            meters_per_deg_lat = 111132.0
            meters_per_deg_lon = 111320.0 * math.cos(lat_rad)
            # pixel area in deg^2 * (m/deg)^2
            pixel_area = abs(xres * yres) * meters_per_deg_lat * meters_per_deg_lon
            return float(pixel_area)
        else:
            # assume units are meters
            return abs(xres * yres)
    except Exception:
        return None
