import sqlite3
from pathlib import Path
DB=Path(__file__).parent.parent / 'classifications.db'
if not DB.exists():
    print('DB not found, skipping migration')
    exit(0)
conn=sqlite3.connect(str(DB))
cur=conn.cursor()
cur.execute("PRAGMA table_info(study_areas)")
cols=[r[1] for r in cur.fetchall()]
print('study_areas columns:',cols)

if 'location_description' in cols and 'study_area_location' not in cols:
    print('Adding study_area_location column')
    cur.execute("ALTER TABLE study_areas ADD COLUMN study_area_location TEXT")
    conn.commit()
    cols.append('study_area_location')

if 'location_description' in cols and 'study_area_location' in cols:
    print('Copying location_description -> study_area_location where NULL or empty')
    cur.execute("UPDATE study_areas SET study_area_location = location_description WHERE study_area_location IS NULL OR study_area_location = ''")
    conn.commit()
    print('Rows updated:', cur.rowcount)
else:
    print('No legacy column present or target column missing; nothing to copy')

conn.close()

