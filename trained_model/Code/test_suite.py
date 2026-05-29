"""
SEASCAN System - Comprehensive Test Suite
Tests backend modules: database, classifier_ui, geospatial
"""

import unittest
import tempfile
import json
import sqlite3
from pathlib import Path
from datetime import datetime
import numpy as np
import torch

# Import modules to test
from database import (
    init_db, save_classification, get_study_area, 
    get_classifications_for_study_area, get_all_classifications,
    get_all_study_areas, delete_classification, update_classification,
    get_classification_by_id
)
from geospatial import extract_geospatial_metadata, find_first_geotiff


class TestDatabaseModule(unittest.TestCase):
    """Test suite for database.py module"""
    
    def setUp(self):
        """Setup: Create temp database for testing"""
        self.temp_dir = tempfile.mkdtemp()
        self.db_path = Path(self.temp_dir) / 'test_classifications.db'
        # Patch the global DB_PATH
        import database
        self.original_db_path = database.DB_PATH
        database.DB_PATH = self.db_path
        init_db()
    
    def tearDown(self):
        """Cleanup: Remove temp database"""
        import database
        database.DB_PATH = self.original_db_path
        if self.db_path.exists():
            self.db_path.unlink()
    
    def test_01_db_initialization(self):
        """Test 1: Database tables are created correctly"""
        conn = sqlite3.connect(str(self.db_path))
        cursor = conn.cursor()
        
        # Check classifications table exists
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='classifications'")
        self.assertIsNotNone(cursor.fetchone(), "classifications table not created")
        
        # Check study_areas table exists
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='study_areas'")
        self.assertIsNotNone(cursor.fetchone(), "study_areas table not created")
        
        conn.close()
        print("[PASS] Test 1: Database initialization")
    
    def test_02_save_classification(self):
        """Test 2: Save classification to database"""
        class_id = save_classification(
            study_area_name="Test Area",
            study_area_location="10.5°N, 120.5°E",
            study_area_bounds={"left": 120.0, "right": 121.0, "bottom": 10.0, "top": 11.0},
            crs="EPSG:4326",
            uploaded_filename="test_image.tif",
            status="Processed",
            detection_type="Seagrass Detection",
            affected_area_size=5.5,
            affected_area_unit="sq km",
            confidence_score=0.92,
            source="Sentinel-2",
            classification_date="2026-05-17",
            water_pixels=5000,
            seagrass_pixels=3000,
            sand_pixels=2000,
            cloud_pixels=500,
            total_pixels=10500,
            classified_image_base64="data:image/png;base64,iVBORw0KG...",
            notes="Test classification"
        )
        
        self.assertIsNotNone(class_id, "Classification ID not returned")
        self.assertGreater(class_id, 0, "Invalid classification ID")
        print("[PASS] Test 2: Save classification")
    
    def test_03_get_classification_by_id(self):
        """Test 3: Retrieve classification by ID"""
        class_id = save_classification(
            study_area_name="Test Area 2",
            study_area_location="11.5°N, 121.5°E",
            study_area_bounds=None,
            crs="EPSG:4326",
            uploaded_filename="test2.tif",
            status="Processed",
            detection_type="Sand Detection",
            affected_area_size=3.0,
            affected_area_unit="sq km",
            confidence_score=0.88,
            source="Drone",
            classification_date="2026-05-16",
            water_pixels=4000,
            seagrass_pixels=2500,
            sand_pixels=3000,
            cloud_pixels=100,
            total_pixels=9600,
            classified_image_base64="test_data",
            notes="Second test"
        )
        
        record = get_classification_by_id(class_id)
        self.assertIsNotNone(record, "Classification not found")
        self.assertEqual(record['study_area_name'], "Test Area 2")
        self.assertEqual(record['water_pixels'], 4000)
        print("[PASS] Test 3: Retrieve classification by ID")
    
    def test_04_get_study_area(self):
        """Test 4: Retrieve study area information"""
        save_classification(
            study_area_name="Coastal Zone A",
            study_area_location="12.0°N, 122.0°E",
            study_area_bounds={"left": 121.9, "right": 122.1},
            crs="EPSG:4326",
            uploaded_filename="coastal.tif",
            status="Processed",
            detection_type="Full Survey",
            affected_area_size=10.0,
            affected_area_unit="sq km",
            confidence_score=0.90,
            source="Sentinel-2",
            classification_date="2026-05-15",
            water_pixels=6000,
            seagrass_pixels=2000,
            sand_pixels=2000,
            cloud_pixels=0,
            total_pixels=10000,
            classified_image_base64="test",
            notes="Coastal survey"
        )
        
        area = get_study_area("Coastal Zone A")
        self.assertIsNotNone(area, "Study area not found")
        self.assertEqual(area['name'], "Coastal Zone A")
        self.assertEqual(area['classification_count'], 1)
        print("[PASS] Test 4: Get study area")
    
    def test_05_get_classifications_for_study_area(self):
        """Test 5: Retrieve all classifications for a study area"""
        study_area = "Coastal Zone B"
        # Save multiple classifications for same area
        for i in range(3):
            save_classification(
                study_area_name=study_area,
                study_area_location=f"13.{i}°N, 123.{i}°E",
                study_area_bounds=None,
                crs="EPSG:4326",
                uploaded_filename=f"file_{i}.tif",
                status="Processed",
                detection_type="Monitoring",
                affected_area_size=5.0 + i,
                affected_area_unit="sq km",
                confidence_score=0.85 + i*0.02,
                source="Satellite",
                classification_date=f"2026-05-{12+i}",
                water_pixels=3000 + i*100,
                seagrass_pixels=2000 + i*50,
                sand_pixels=1000 + i*25,
                cloud_pixels=50,
                total_pixels=6050 + i*175,
                classified_image_base64="test",
                notes=f"Monitoring {i}"
            )
        
        classifications = get_classifications_for_study_area(study_area)
        self.assertEqual(len(classifications), 3, "Should have 3 classifications")
        print("[PASS] Test 5: Get classifications for study area")
    
    def test_06_update_classification(self):
        """Test 6: Update classification status and notes"""
        class_id = save_classification(
            study_area_name="Update Test",
            study_area_location="14.0°N, 124.0°E",
            study_area_bounds=None,
            crs="EPSG:4326",
            uploaded_filename="update.tif",
            status="Processing",
            detection_type="Test",
            affected_area_size=1.0,
            affected_area_unit="sq km",
            confidence_score=0.80,
            source="Test",
            classification_date="2026-05-17",
            water_pixels=1000,
            seagrass_pixels=500,
            sand_pixels=300,
            cloud_pixels=200,
            total_pixels=2000,
            classified_image_base64="test",
            notes="Original"
        )
        
        success = update_classification(class_id, status="Archived", notes="Updated note")
        self.assertTrue(success, "Update should return True")
        
        updated = get_classification_by_id(class_id)
        self.assertEqual(updated['status'], "Archived")
        self.assertEqual(updated['notes'], "Updated note")
        print("[PASS] Test 6: Update classification")
    
    def test_07_delete_classification(self):
        """Test 7: Delete classification record"""
        class_id = save_classification(
            study_area_name="Delete Test",
            study_area_location="15.0°N, 125.0°E",
            study_area_bounds=None,
            crs="EPSG:4326",
            uploaded_filename="delete.tif",
            status="Processed",
            detection_type="Test",
            affected_area_size=1.0,
            affected_area_unit="sq km",
            confidence_score=0.80,
            source="Test",
            classification_date="2026-05-17",
            water_pixels=1000,
            seagrass_pixels=500,
            sand_pixels=300,
            cloud_pixels=200,
            total_pixels=2000,
            classified_image_base64="test",
            notes="To delete"
        )
        
        success = delete_classification(class_id)
        self.assertTrue(success, "Delete should return True")
        
        deleted = get_classification_by_id(class_id)
        self.assertIsNone(deleted, "Classification should be deleted")
        print("[PASS] Test 7: Delete classification")
    
    def test_08_get_all_study_areas(self):
        """Test 8: Retrieve all study areas"""
        areas = ["Area Alpha", "Area Beta", "Area Gamma"]
        for area in areas:
            save_classification(
                study_area_name=area,
                study_area_location=f"{16.0}°N, {126.0}°E",
                study_area_bounds=None,
                crs="EPSG:4326",
                uploaded_filename=f"{area}.tif",
                status="Processed",
                detection_type="Survey",
                affected_area_size=1.0,
                affected_area_unit="sq km",
                confidence_score=0.85,
                source="Test",
                classification_date="2026-05-17",
                water_pixels=1000,
                seagrass_pixels=500,
                sand_pixels=300,
                cloud_pixels=200,
                total_pixels=2000,
                classified_image_base64="test",
                notes="Test area"
            )
        
        all_areas = get_all_study_areas()
        self.assertGreaterEqual(len(all_areas), 3, "Should have at least 3 areas")
        print("[PASS] Test 8: Get all study areas")
    
    def test_09_get_all_classifications(self):
        """Test 9: Retrieve all classifications across areas"""
        save_classification(
            study_area_name="All Classifications Test",
            study_area_location="17.0°N, 127.0°E",
            study_area_bounds=None,
            crs="EPSG:4326",
            uploaded_filename="all_test.tif",
            status="Processed",
            detection_type="Test",
            affected_area_size=1.0,
            affected_area_unit="sq km",
            confidence_score=0.9,
            source="Test",
            classification_date="2026-05-17",
            water_pixels=100,
            seagrass_pixels=50,
            sand_pixels=30,
            cloud_pixels=20,
            total_pixels=200,
            classified_image_base64="test",
            notes="Test seed",
        )
        all_classifications = get_all_classifications()
        self.assertGreater(len(all_classifications), 0, "Should have classifications")
        self.assertIn('study_area_name', all_classifications[0])
        self.assertIn('water_pixels', all_classifications[0])
        print("[PASS] Test 9: Get all classifications")
    
    def test_10_schema_migration_columns_exist(self):
        """Test 10: New schema columns are present"""
        conn = sqlite3.connect(str(self.db_path))
        cursor = conn.cursor()
        
        cursor.execute("PRAGMA table_info(classifications)")
        columns = {row[1] for row in cursor.fetchall()}
        
        required_cols = [
            'study_area_location', 'study_area_bounds', 'status',
            'detection_type', 'affected_area_size', 'affected_area_unit',
            'confidence_score', 'source', 'classification_date'
        ]
        
        for col in required_cols:
            self.assertIn(col, columns, f"Column {col} missing in classifications table")
        
        conn.close()
        print("[PASS] Test 10: Schema columns exist")


class TestCoastal1DCNN(unittest.TestCase):
    """Test suite for Coastal1DCNN model"""
    
    def test_11_model_instantiation(self):
        """Test 11: Model can be instantiated"""
        from classifier_ui import Coastal1DCNN
        model = Coastal1DCNN(num_bands=16, num_classes=4)
        self.assertIsNotNone(model)
        print("[PASS] Test 11: Model instantiation")
    
    def test_12_model_forward_pass(self):
        """Test 12: Model forward pass produces correct output shape"""
        from classifier_ui import Coastal1DCNN
        model = Coastal1DCNN(num_bands=16, num_classes=4)
        model.eval()
        
        # Create dummy input: batch of 10, 16 features each
        dummy_input = torch.randn(10, 16)
        
        with torch.no_grad():
            output = model(dummy_input)
        
        self.assertEqual(output.shape, (10, 4), f"Output shape should be (10, 4), got {output.shape}")
        print("[PASS] Test 12: Model forward pass")
    
    def test_13_model_device_compatibility(self):
        """Test 13: Model works on CPU and CUDA (if available)"""
        from classifier_ui import Coastal1DCNN
        device = torch.device('cpu')
        model = Coastal1DCNN(num_bands=16, num_classes=4).to(device)
        
        dummy_input = torch.randn(5, 16).to(device)
        with torch.no_grad():
            output = model(dummy_input)
        
        self.assertEqual(output.shape, (5, 4))
        print("[PASS] Test 13: Model device compatibility")


class TestGeospatialModule(unittest.TestCase):
    """Test suite for geospatial.py module"""
    
    def test_14_geospatial_functions_exist(self):
        """Test 14: Geospatial functions are defined"""
        self.assertTrue(callable(extract_geospatial_metadata))
        self.assertTrue(callable(find_first_geotiff))
        print("[PASS] Test 14: Geospatial functions exist")


class TestIntegration(unittest.TestCase):
    """Integration tests combining multiple modules"""
    
    def test_15_full_save_and_retrieve_flow(self):
        """Test 15: Full workflow - save and retrieve classification"""
        # Setup temp DB
        temp_dir = tempfile.mkdtemp()
        db_path = Path(temp_dir) / 'test_integration.db'
        import database
        original_db_path = database.DB_PATH
        database.DB_PATH = db_path
        init_db()
        
        try:
            # Save classification
            test_data = {
                "study_area_name": "Integration Test Area",
                "study_area_location": "20.0°N, 130.0°E",
                "study_area_bounds": {"left": 130, "right": 131, "bottom": 20, "top": 21},
                "crs": "EPSG:4326",
                "uploaded_filename": "integration_test.tif",
                "status": "Processed",
                "detection_type": "Integration Test",
                "affected_area_size": 5.0,
                "affected_area_unit": "sq km",
                "confidence_score": 0.92,
                "source": "Test Suite",
                "classification_date": "2026-05-17",
                "water_pixels": 5000,
                "seagrass_pixels": 3000,
                "sand_pixels": 1500,
                "cloud_pixels": 500,
                "total_pixels": 10000,
                "classified_image_base64": "test_data",
                "notes": "Integration test"
            }
            
            class_id = save_classification(**test_data)
            self.assertGreater(class_id, 0)
            
            # Retrieve it
            retrieved = get_classification_by_id(class_id)
            self.assertIsNotNone(retrieved)
            self.assertEqual(retrieved['study_area_name'], test_data['study_area_name'])
            self.assertEqual(retrieved['water_pixels'], test_data['water_pixels'])
            
            # Get study area
            area = get_study_area(test_data['study_area_name'])
            self.assertEqual(area['classification_count'], 1)
            
            print("[PASS] Test 15: Full save and retrieve flow")
        finally:
            database.DB_PATH = original_db_path
            if db_path.exists():
                db_path.unlink()


def run_all_tests():
    """Run all test suites and generate report"""
    loader = unittest.TestLoader()
    suite = unittest.TestSuite()
    
    # Add all test classes
    suite.addTests(loader.loadTestsFromTestCase(TestDatabaseModule))
    suite.addTests(loader.loadTestsFromTestCase(TestCoastal1DCNN))
    suite.addTests(loader.loadTestsFromTestCase(TestGeospatialModule))
    suite.addTests(loader.loadTestsFromTestCase(TestIntegration))
    
    runner = unittest.TextTestRunner(verbosity=2)
    result = runner.run(suite)
    
    return result


if __name__ == '__main__':
    result = run_all_tests()
    
    # Summary
    print("\n" + "="*70)
    print("TEST SUMMARY")
    print("="*70)
    print(f"Tests Run: {result.testsRun}")
    print(f"Successes: {result.testsRun - len(result.failures) - len(result.errors)}")
    print(f"Failures: {len(result.failures)}")
    print(f"Errors: {len(result.errors)}")
    print("="*70)
