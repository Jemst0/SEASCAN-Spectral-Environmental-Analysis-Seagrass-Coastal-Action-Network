import io
import tempfile
import unittest
import zipfile
from pathlib import Path

import upload_utils


class UploadUtilsTests(unittest.TestCase):
    def _make_tiff_bytes(self) -> bytes:
        return b"fake-tiff-bytes"

    def test_zip_uploads_are_extracted_from_file_list(self):
        tiff_bytes = self._make_tiff_bytes()
        zip_buffer = io.BytesIO()
        with zipfile.ZipFile(zip_buffer, "w") as archive:
            archive.writestr("B01.tif", tiff_bytes)

        with tempfile.TemporaryDirectory() as tmpdir:
            extract_dir = Path(tmpdir)
            saved = upload_utils.extract_uploaded_files(
                [("sample.zip", zip_buffer.getvalue())],
                extract_dir,
            )

            self.assertEqual(len(saved), 1)
            self.assertEqual(saved[0].name, "B01.tif")
            self.assertTrue(saved[0].exists())


if __name__ == "__main__":
    unittest.main()
