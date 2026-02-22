import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const dbPath = path.join(__dirname, 'smartcopy.db');
const db = new Database(dbPath, { verbose: console.log });

export function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS movies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      year INTEGER,
      genre TEXT,
      size INTEGER NOT NULL,
      filepath TEXT NOT NULL,
      posterUrl TEXT
    );

    CREATE TABLE IF NOT EXISTS series (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      year INTEGER,
      genre TEXT,
      posterUrl TEXT
    );

    CREATE TABLE IF NOT EXISTS episodes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      series_id INTEGER,
      season INTEGER,
      episode INTEGER,
      size INTEGER NOT NULL,
      filepath TEXT NOT NULL,
      FOREIGN KEY(series_id) REFERENCES series(id)
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_token TEXT UNIQUE NOT NULL,
      drive_letter TEXT NOT NULL,
      volume_name TEXT,
      connected_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS daily_sales_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_token TEXT,
      movie_id INTEGER,
      episode_id INTEGER,
      size_copied INTEGER,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(session_token) REFERENCES sessions(session_token),
      FOREIGN KEY(movie_id) REFERENCES movies(id),
      FOREIGN KEY(episode_id) REFERENCES episodes(id)
    );
  `);

  // Seed some dummy data if empty
  const count = db.prepare('SELECT COUNT(*) as count FROM movies').get() as { count: number };
  if (count.count === 0) {
    const insertMovie = db.prepare('INSERT INTO movies (title, year, genre, size, filepath, posterUrl) VALUES (?, ?, ?, ?, ?, ?)');
    insertMovie.run('Inception', 2010, 'Sci-Fi', 2 * 1024 * 1024 * 1024, 'D:\\Movies\\Inception.mp4', 'https://picsum.photos/seed/inception/300/450');
    insertMovie.run('The Matrix', 1999, 'Action', 1.5 * 1024 * 1024 * 1024, 'D:\\Movies\\TheMatrix.mp4', 'https://picsum.photos/seed/matrix/300/450');
    insertMovie.run('Interstellar', 2014, 'Sci-Fi', 2.5 * 1024 * 1024 * 1024, 'D:\\Movies\\Interstellar.mp4', 'https://picsum.photos/seed/interstellar/300/450');
  }
}

export { db };
