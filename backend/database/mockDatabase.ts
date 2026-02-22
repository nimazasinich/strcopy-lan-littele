import { normalizePersian } from './schema';

export const mockMovies = [
  {
    id: 1,
    title: 'Inception',
    persian_title: 'تلقین',
    genre: 'اکشن / علمی تخیلی',
    year: 2010,
    rating: 4.8,
    filepath: 'C:/SmartCopy/Archive/Movies/Inception.mp4',
    size: 2.5 * 1024**3,
    poster_url: 'https://picsum.photos/seed/inception/300/450',
    description: 'یک دزد که با استفاده از تکنولوژی اشتراک‌گذاری رویا، اسرار شرکت‌ها را می‌دزدد، وظیفه معکوس را بر عهده می‌گیرد.',
    download_count: 150
  },
  {
    id: 2,
    title: 'Interstellar',
    persian_title: 'میان‌ستاره‌ای',
    genre: 'درام / علمی تخیلی',
    year: 2014,
    rating: 4.9,
    filepath: 'C:/SmartCopy/Archive/Movies/Interstellar.mkv',
    size: 3.2 * 1024**3,
    poster_url: 'https://picsum.photos/seed/interstellar/300/450',
    description: 'تیمی از فضانوردان از طریق یک کرم‌چاله در فضا سفر می‌کنند تا بقای بشریت را تضمین کنند.',
    download_count: 230
  },
  {
    id: 3,
    title: 'The Dark Knight',
    persian_title: 'شوالیه تاریکی',
    genre: 'اکشن / جنایی',
    year: 2008,
    rating: 4.9,
    filepath: 'C:/SmartCopy/Archive/Movies/DarkKnight.mp4',
    size: 2.8 * 1024**3,
    poster_url: 'https://picsum.photos/seed/darkknight/300/450',
    description: 'بتمن باید با یکی از بزرگترین دشمنان خود، جوکر، روبرو شود.',
    download_count: 310
  }
];

export const mockQueries = {
  getTopMovies: () => mockMovies.sort((a, b) => b.download_count - a.download_count).slice(0, 5),
  getDailyStats: () => ({ total_bytes: 45 * 1024**3, count: 12 }),
  getMonthStats: () => ({ total_bytes: 1200 * 1024**3, count: 340 }),
  searchMovies: (query: string) => {
    const normalized = normalizePersian(query).toLowerCase();
    return mockMovies.filter(m => 
      m.persian_title.includes(normalized) || 
      m.title.toLowerCase().includes(normalized) || 
      m.genre.includes(normalized)
    );
  },
  logInteraction: (fingerprint: string, movieId: number | null, genre: string | null, type: string, weight: number) => {
    console.log(`[MOCK] Logged interaction for ${fingerprint}: ${type} on ${movieId} (${genre}) weight ${weight}`);
  },
  getRecommendations: (fingerprint: string) => {
    return mockMovies.slice(0, 2); // Return first two as mock recommendations
  },
  getUserHistory: (fingerprint: string) => {
    return [mockMovies[2]]; // Return the third movie as mock history
  },
  getLoyaltyReport: () => {
    return [
      { user_fingerprint: 'mock-user-1', total_copies: 15, total_data_bytes: 45 * 1024**3, last_active: new Date().toISOString() },
      { user_fingerprint: 'mock-user-2', total_copies: 8, total_data_bytes: 20 * 1024**3, last_active: new Date().toISOString() }
    ];
  }
};
