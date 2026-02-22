import fs from 'fs';
import path from 'path';
import { initDatabase } from './backend/database/schema';

const MOVIE_PATH = process.env.MOVIE_PATH || 'C:/SmartCopy/Archive';
const LOGS_PATH = path.join(__dirname, 'logs');

async function setup() {
  console.log('Starting SmartCopy Setup...');

  // 1. Create Folder Structure
  const folders = [
    MOVIE_PATH,
    path.join(MOVIE_PATH, 'Movies'),
    path.join(MOVIE_PATH, 'Series'),
    LOGS_PATH
  ];

  for (const folder of folders) {
    if (!fs.existsSync(folder)) {
      console.log(`Creating folder: ${folder}`);
      fs.mkdirSync(folder, { recursive: true });
    }
  }

  // 2. Initialize Database
  console.log('Initializing Database...');
  initDatabase();

  console.log('Setup Complete!');
}

setup().catch(err => {
  console.error('Setup failed:', err);
  process.exit(1);
});
