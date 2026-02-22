import Database from 'better-sqlite3';
import path from 'path';
import logger from '../services/logger';

const dbPath = path.join(__dirname, 'smartcopy.db');
const db = new Database(dbPath);

export function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS movies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      persian_title TEXT NOT NULL,
      genre TEXT,
      year INTEGER,
      rating REAL DEFAULT 4.5,
      filepath TEXT NOT NULL,
      size INTEGER NOT NULL,
      poster_url TEXT,
      description TEXT,
      download_count INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      usb_id TEXT NOT NULL,
      user_fingerprint TEXT,
      movie_id INTEGER,
      total_size INTEGER NOT NULL,
      status TEXT CHECK(status IN ('success', 'failed')) NOT NULL,
      error_message TEXT,
      FOREIGN KEY(movie_id) REFERENCES movies(id)
    );

    CREATE TABLE IF NOT EXISTS user_interactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_fingerprint TEXT NOT NULL,
      movie_id INTEGER,
      genre TEXT,
      interaction_type TEXT NOT NULL,
      weight INTEGER NOT NULL,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(movie_id) REFERENCES movies(id)
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  // Seed default settings if not exists
  const seedSettings = db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)');
  seedSettings.run('allowed_extensions', JSON.stringify(['.mp4', '.mkv', '.avi']));
  seedSettings.run('max_concurrent_jobs', '5');
  seedSettings.run('admin_password', 'admin123');

  // Seed some dummy movies if empty
  const count = db.prepare('SELECT COUNT(*) as count FROM movies').get() as { count: number };
  if (count.count === 0) {
    const insertMovie = db.prepare(`
      INSERT INTO movies (title, persian_title, genre, year, rating, filepath, size, poster_url, description)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    insertMovie.run('Inception', 'تلقین', 'اکشن / علمی تخیلی', 2010, 4.8, 'C:/SmartCopy/Archive/Movies/Inception.mp4', 2.5 * 1024**3, 'https://picsum.photos/seed/inception/300/450', 'یک دزد که با استفاده از تکنولوژی اشتراک‌گذاری رویا، اسرار شرکت‌ها را می‌دزدد، وظیفه معکوس را بر عهده می‌گیرد.');
    insertMovie.run('Interstellar', 'میان‌ستاره‌ای', 'درام / علمی تخیلی', 2014, 4.9, 'C:/SmartCopy/Archive/Movies/Interstellar.mkv', 3.2 * 1024**3, 'https://picsum.photos/seed/interstellar/300/450', 'تیمی از فضانوردان از طریق یک کرم‌چاله در فضا سفر می‌کنند تا بقای بشریت را تضمین کنند.');
    insertMovie.run('The Dark Knight', 'شوالیه تاریکی', 'اکشن / جنایی', 2008, 4.9, 'C:/SmartCopy/Archive/Movies/DarkKnight.mp4', 2.8 * 1024**3, 'https://picsum.photos/seed/darkknight/300/450', 'بتمن باید با یکی از بزرگترین دشمنان خود، جوکر، روبرو شود.');
  }

  logger.info('Database initialized with advanced schema');
}

// Persian Normalization Helper
export function normalizePersian(text: string): string {
  return text
    .replace(/ی/g, 'ی')
    .replace(/ي/g, 'ی')
    .replace(/ک/g, 'ک')
    .replace(/ك/g, 'ک');
}

export const queries = {
  getTopMovies: () => {
    return db.prepare('SELECT * FROM movies ORDER BY download_count DESC LIMIT 5').all();
  },
  getDailyStats: () => {
    return db.prepare(`
      SELECT SUM(total_size) as total_bytes, COUNT(*) as count 
      FROM transactions 
      WHERE status = 'success' AND date(timestamp) = date('now')
    `).get();
  },
  getMonthStats: () => {
    return db.prepare(`
      SELECT SUM(total_size) as total_bytes, COUNT(*) as count 
      FROM transactions 
      WHERE status = 'success' AND strftime('%m', timestamp) = strftime('%m', 'now')
    `).get();
  },
  searchMovies: (query: string) => {
    const normalized = `%${normalizePersian(query)}%`;
    return db.prepare(`
      SELECT * FROM movies 
      WHERE persian_title LIKE ? OR title LIKE ? OR genre LIKE ?
    `).all(normalized, normalized, normalized);
  },
  logInteraction: (fingerprint: string, movieId: number | null, genre: string | null, type: string, weight: number) => {
    db.prepare(`
      INSERT INTO user_interactions (user_fingerprint, movie_id, genre, interaction_type, weight)
      VALUES (?, ?, ?, ?, ?)
    `).run(fingerprint, movieId, genre, type, weight);
  },
  getRecommendations: (fingerprint: string) => {
    // Find top genres for the user based on interaction weight
    const topGenres = db.prepare(`
      SELECT genre, SUM(weight) as total_weight
      FROM user_interactions
      WHERE user_fingerprint = ? AND genre IS NOT NULL
      GROUP BY genre
      ORDER BY total_weight DESC
      LIMIT 2
    `).all(fingerprint) as any[];

    if (topGenres.length === 0) {
      // Fallback: return top downloaded movies
      return db.prepare('SELECT * FROM movies ORDER BY download_count DESC LIMIT 6').all();
    }

    // Get movies matching top genres, excluding already copied ones
    const genresList = topGenres.map(g => `%${g.genre}%`);
    const placeholders = genresList.map(() => 'genre LIKE ?').join(' OR ');
    
    return db.prepare(`
      SELECT * FROM movies 
      WHERE (${placeholders})
      AND id NOT IN (
        SELECT movie_id FROM transactions 
        WHERE user_fingerprint = ? AND status = 'success' AND movie_id IS NOT NULL
      )
      ORDER BY rating DESC, download_count DESC
      LIMIT 6
    `).all(...genresList, fingerprint);
  },
  getUserHistory: (fingerprint: string) => {
    return db.prepare(`
      SELECT m.*, t.timestamp as copy_date
      FROM transactions t
      JOIN movies m ON t.movie_id = m.id
      WHERE t.user_fingerprint = ? AND t.status = 'success'
      ORDER BY t.timestamp DESC
      LIMIT 10
    `).all(fingerprint);
  },
  getLoyaltyReport: () => {
    return db.prepare(`
      SELECT 
        user_fingerprint,
        COUNT(DISTINCT id) as total_copies,
        SUM(total_size) as total_data_bytes,
        MAX(timestamp) as last_active
      FROM transactions
      WHERE status = 'success' AND user_fingerprint IS NOT NULL
      GROUP BY user_fingerprint
      ORDER BY total_copies DESC
      LIMIT 20
    `).all();
  }
};

export { db };
