import requests, json, sys, os
BASE='http://127.0.0.1:8000'
print('Checking API:', BASE)
try:
    r = requests.get(BASE + '/classifications', timeout=5)
    print('GET /classifications', r.status_code)
    data = r.json()
    print('Found classifications:', len(data.get('classifications', [])))
except Exception as e:
    print('Failed to contact server:', e)
    sys.exit(1)
payload = {
    'study_area_name': 'SMOKE_TEST_AREA',
    'study_area_location': 'Test Location',
    'uploaded_filename': 'test.tiff',
    'status': 'Processed',
    'detection_type': 'Test',
    'confidence_score': None,
    'avg_confidence_percent': 75.5,
    'classification_date': '2026-05-18T00:00:00Z',
    'water_pixels': 10,
    'seagrass_pixels': 2,
    'sand_pixels': 3,
    'cloud_pixels': 0,
    'total_pixels': 15,
    'pixel_area_sqm': 1.23,
    'classified_image_base64': '',
    'notes': 'smoke test'
}
try:
    r = requests.post(BASE + '/save-classification', json=payload, timeout=10)
    print('POST /save-classification', r.status_code)
    res = r.json()
    print('Save response:', res)
    cid = res.get('classification_id')
    if not cid:
        print('No classification id returned')
        sys.exit(1)
except Exception as e:
    print('Save failed:', e)
    sys.exit(1)
try:
    pdf_resp = requests.post(BASE + '/export-analytics-pdf', json={'ids':[cid], 'metric':'total'}, timeout=30)
    print('POST /export-analytics-pdf', pdf_resp.status_code)
    if pdf_resp.status_code == 200 and pdf_resp.headers.get('content-type','').startswith('application/pdf'):
        out_path = os.path.join(os.getcwd(), 'smoke_trend_report.pdf')
        with open(out_path, 'wb') as f:
            f.write(pdf_resp.content)
        print('Saved PDF to', out_path, 'size', os.path.getsize(out_path))
    else:
        print('PDF generation failed, status', pdf_resp.status_code, 'body:', pdf_resp.text[:400])
except Exception as e:
    print('PDF request failed:', e)
    sys.exit(1)
