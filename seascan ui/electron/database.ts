import Database from 'better-sqlite3';
import path from 'path';
import { app } from 'electron';
import fs from 'fs';

interface Classification {
  id?: number;
  studyAreaName: string;
  location: string;
  latMin?: number;
  latMax?: number;
  lonMin?: number;
  lonMax?: number;
  notes?: string;
  timestamp: string;
  imageBase64: string;
  stats: {
    totalCoastalPixels?: number;
    seagrassPixels?: number;
    waterPixels?: number;
    sandPixels?: number;
    cloudPixels?: number;
    imageSize?: [number, number];
    numBands?: number;
    numClasses?: number;
  };
}

let db: Database.Database | null = null;

export function initializeDatabase() {
  const dataDir = path.join(app.getPath('userData'), 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  const dbPath = path.join(dataDir, 'classifications.db');
  db = new Database(dbPath);

  // Enable foreign keys
  db.pragma('foreign_keys = ON');

  // Create tables
  db.exec(`
    CREATE TABLE IF NOT EXISTS classifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      studyAreaName TEXT NOT NULL,
      location TEXT NOT NULL,
      latMin REAL,
      latMax REAL,
      lonMin REAL,
      lonMax REAL,
      notes TEXT,
      timestamp TEXT NOT NULL,
      imageBase64 TEXT NOT NULL,
      totalCoastalPixels INTEGER,
      seagrassPixels INTEGER,
      waterPixels INTEGER,
      sandPixels INTEGER,
      cloudPixels INTEGER,
      imageSizeWidth INTEGER,
      imageSizeHeight INTEGER,
      numBands INTEGER,
      numClasses INTEGER,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_study_area ON classifications(studyAreaName);
    CREATE INDEX IF NOT EXISTS idx_timestamp ON classifications(timestamp);
    CREATE INDEX IF NOT EXISTS idx_location ON classifications(location);
  `);

  console.log('Database initialized at:', dbPath);
}

export function saveClassification(classification: Classification): number {
  if (!db) throw new Error('Database not initialized');

  const stmt = db.prepare(`
    INSERT INTO classifications (
      studyAreaName, location, latMin, latMax, lonMin, lonMax, notes, timestamp,
      imageBase64, totalCoastalPixels, seagrassPixels, waterPixels, sandPixels,
      cloudPixels, imageSizeWidth, imageSizeHeight, numBands, numClasses
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const result = stmt.run(
    classification.studyAreaName,
    classification.location,
    classification.latMin,
    classification.latMax,
    classification.lonMin,
    classification.lonMax,
    classification.notes,
    classification.timestamp,
    classification.imageBase64,
    classification.stats.totalCoastalPixels,
    classification.stats.seagrassPixels,
    classification.stats.waterPixels,
    classification.stats.sandPixels,
    classification.stats.cloudPixels,
    classification.stats.imageSize?.[0],
    classification.stats.imageSize?.[1],
    classification.stats.numBands,
    classification.stats.numClasses
  );

  return result.lastInsertRowid as number;
}

export function getClassificationsByStudyArea(studyAreaName: string): Classification[] {
  if (!db) throw new Error('Database not initialized');

  const stmt = db.prepare(`
    SELECT * FROM classifications 
    WHERE studyAreaName = ? 
    ORDER BY timestamp DESC
  `);

  const rows = stmt.all(studyAreaName) as any[];
  return rows.map(row => ({
    id: row.id,
    studyAreaName: row.studyAreaName,
    location: row.location,
    latMin: row.latMin,
    latMax: row.latMax,
    lonMin: row.lonMin,
    lonMax: row.lonMax,
    notes: row.notes,
    timestamp: row.timestamp,
    imageBase64: row.imageBase64,
    stats: {
      totalCoastalPixels: row.totalCoastalPixels,
      seagrassPixels: row.seagrassPixels,
      waterPixels: row.waterPixels,
      sandPixels: row.sandPixels,
      cloudPixels: row.cloudPixels,
      imageSize: row.imageSizeWidth && row.imageSizeHeight ? [row.imageSizeWidth, row.imageSizeHeight] : undefined,
      numBands: row.numBands,
      numClasses: row.numClasses,
    },
  }));
}

export function getAllClassifications(): Classification[] {
  if (!db) throw new Error('Database not initialized');

  const stmt = db.prepare(`
    SELECT * FROM classifications 
    ORDER BY timestamp DESC
  `);

  const rows = stmt.all() as any[];
  return rows.map(row => ({
    id: row.id,
    studyAreaName: row.studyAreaName,
    location: row.location,
    latMin: row.latMin,
    latMax: row.latMax,
    lonMin: row.lonMin,
    lonMax: row.lonMax,
    notes: row.notes,
    timestamp: row.timestamp,
    imageBase64: row.imageBase64,
    stats: {
      totalCoastalPixels: row.totalCoastalPixels,
      seagrassPixels: row.seagrassPixels,
      waterPixels: row.waterPixels,
      sandPixels: row.sandPixels,
      cloudPixels: row.cloudPixels,
      imageSize: row.imageSizeWidth && row.imageSizeHeight ? [row.imageSizeWidth, row.imageSizeHeight] : undefined,
      numBands: row.numBands,
      numClasses: row.numClasses,
    },
  }));
}

export function getUniqueStudyAreas(): { name: string; location: string; count: number }[] {
  if (!db) throw new Error('Database not initialized');

  const stmt = db.prepare(`
    SELECT DISTINCT studyAreaName, location, COUNT(*) as count
    FROM classifications
    GROUP BY studyAreaName, location
    ORDER BY COUNT(*) DESC
  `);

  return stmt.all() as any[];
}

export function deleteClassification(id: number): boolean {
  if (!db) throw new Error('Database not initialized');

  const stmt = db.prepare('DELETE FROM classifications WHERE id = ?');
  const result = stmt.run(id);
  return result.changes > 0;
}

export function closeDatabase() {
  if (db) {
    db.close();
    db = null;
  }
}
