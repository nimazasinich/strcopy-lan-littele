export const config = {
  allowedExtensions: ['.mp4', '.mkv', '.avi'],
  moviePath: process.env.MOVIE_PATH || 'C:/SmartCopy/Archive',
  maxConcurrentCopies: parseInt(process.env.MAX_CONCURRENT_COPIES || '5', 10),
  port: parseInt(process.env.PORT || '3000', 10),
  isDevelopment: process.env.NODE_ENV === 'development' || !process.env.NODE_ENV,
};
