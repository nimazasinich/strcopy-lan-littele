import express from 'express';
import { createServer as createViteServer } from 'vite';
import { WebSocketServer } from 'ws';
import http from 'http';
import path from 'path';
import os from 'os';
import fs from 'fs';
import morgan from 'morgan';
import logger from './backend/services/logger';
import { usbManager } from './backend/services/usbManager';
import { mockUsbManager } from './backend/services/mockUsbManager';
import { copyEngine } from './backend/services/copyEngine';
import { initDatabase, db } from './backend/database/schema';
import { config } from './backend/config';

async function startServer() {
  const app = express();
  const server = http.createServer(app);
  const wss = new WebSocketServer({ server });
  const PORT = config.port;

  // Use mock manager in dev mode for immediate preview
  const activeUsbManager = config.isDevelopment ? mockUsbManager : usbManager;

  // Initialize Database
  initDatabase();

  // Morgan HTTP Logging
  app.use(morgan('combined', {
    stream: { write: (message) => logger.info(message.trim()) }
  }));

  app.use(express.json());

  // WebSocket connection handling
  wss.on('connection', (ws, req) => {
    const url = new URL(req.url || '', `http://${req.headers.host}`);
    const sessionToken = url.searchParams.get('token');
    const isAdmin = url.searchParams.get('admin') === 'true';

    if (sessionToken) {
      ws.send(JSON.stringify({
        type: 'INIT_JOBS',
        jobs: copyEngine.getJobsBySession(sessionToken)
      }));
    } else if (isAdmin) {
      ws.send(JSON.stringify({
        type: 'INIT_USBS',
        usbs: activeUsbManager.getConnectedUSBs()
      }));

      ws.send(JSON.stringify({
        type: 'HEALTH_UPDATE',
        health: getSystemHealth()
      }));
    }
  });

  function getSystemHealth() {
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const memUsage = Math.round((usedMem / totalMem) * 100);
    const load = os.loadavg()[0];
    const cpuUsage = Math.round((load / os.cpus().length) * 100);

    return {
      cpu: Math.min(cpuUsage, 100),
      ram: memUsage,
      usbs: activeUsbManager.getConnectedUSBs().length,
      queue: copyEngine.getAllJobs().length
    };
  }

  setInterval(() => {
    const health = getSystemHealth();
    wss.clients.forEach(client => {
      if (client.readyState === 1) {
        client.send(JSON.stringify({ type: 'HEALTH_UPDATE', health }));
      }
    });
  }, 5000);

  // Broadcast events from copyEngine
  copyEngine.on('jobAdded', (job) => broadcast({ type: 'JOB_UPDATE', job }));
  copyEngine.on('jobStarted', (job) => broadcast({ type: 'JOB_UPDATE', job }));
  copyEngine.on('jobProgress', (job) => broadcast({ type: 'JOB_UPDATE', job }));
  copyEngine.on('jobCompleted', (job) => broadcast({ type: 'JOB_UPDATE', job }));
  copyEngine.on('jobFailed', (job) => broadcast({ type: 'JOB_UPDATE', job }));
  copyEngine.on('jobCancelled', (job) => broadcast({ type: 'JOB_UPDATE', job }));
  
  // Real-time Critical Error Alerts for Admin
  copyEngine.on('criticalError', (errorData) => {
    logger.error(`CRITICAL ALERT: ${errorData.error}`);
    broadcast({ type: 'CRITICAL_ERROR', ...errorData });
  });

  function broadcast(data: any) {
    wss.clients.forEach(client => {
      if (client.readyState === 1) {
        client.send(JSON.stringify(data));
      }
    });
  }

  // API Routes
  app.get('/api/usbs', (req, res) => {
    res.json(activeUsbManager.getConnectedUSBs());
  });

  app.get('/api/movies', (req, res) => {
    const movies = db.prepare('SELECT * FROM movies').all();
    res.json(movies);
  });

  app.post('/api/copy', (req, res) => {
    const { movieId, sessionToken } = req.body;
    const usb = activeUsbManager.getUSBByToken(sessionToken);
    if (!usb) return res.status(400).json({ error: 'Invalid session or USB disconnected' });

    const movie = db.prepare('SELECT * FROM movies WHERE id = ?').get(movieId) as any;
    if (!movie) return res.status(404).json({ error: 'Movie not found' });

    const job = copyEngine.addJob({
      sourceFilePath: movie.filepath,
      destinationDrive: usb.driveLetter,
      destinationPath: `${usb.driveLetter}\\Movies\\${path.basename(movie.filepath)}`,
      size: movie.size,
      sessionToken
    });

    res.json(job);
  });

  app.post('/api/cancel', (req, res) => {
    const { jobId } = req.body;
    const success = copyEngine.cancelJob(jobId);
    res.json({ success });
  });

  app.get('/connect/:token', (req, res) => {
    const token = req.params.token;
    const usb = activeUsbManager.getUSBByToken(token);
    if (!usb) return res.status(404).send('Invalid or expired session token.');
    res.cookie('sessionToken', token, { maxAge: 24 * 60 * 60 * 1000, httpOnly: false });
    res.redirect(`/?token=${token}`);
  });

  app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'admin.html'));
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  server.listen(PORT, '0.0.0.0', () => {
    logger.info(`SmartCopy Server running on http://localhost:${PORT}`);
  });
}

startServer();
