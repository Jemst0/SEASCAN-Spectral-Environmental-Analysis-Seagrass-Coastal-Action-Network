from __future__ import annotations

import io
import zipfile
from pathlib import Path
from typing import Iterable, List, Tuple

from fastapi import HTTPException


def _safe_filename(filename: str) -> str:
    return Path(filename or "upload").name


def extract_uploaded_files(
    uploads: Iterable[Tuple[str, bytes]],
    destination_dir: Path,
) -> List[Path]:
    """Save uploaded TIFF files and extract ZIP uploads into a destination directory.

    Returns the list of TIFFs present in the destination directory after processing.
    """
    destination_dir.mkdir(parents=True, exist_ok=True)

    for filename, content in uploads:
        normalized_name = _safe_filename(filename)
        lower_name = normalized_name.lower()

        if lower_name.endswith(".zip"):
            with zipfile.ZipFile(io.BytesIO(content)) as archive:
                archive.extractall(destination_dir)
            continue

        if lower_name.endswith((".tif", ".tiff")):
            target = destination_dir / normalized_name
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(content)
            continue

        raise HTTPException(
            status_code=400,
            detail="Upload a .zip, .tif, or .tiff file",
        )

    return sorted(
        [
            path
            for path in destination_dir.rglob("*")
            if path.is_file() and path.suffix.lower() in (".tif", ".tiff")
        ]
    )
