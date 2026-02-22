import { EventEmitter } from 'events';
import fs from 'fs';
import path from 'path';
import { usbManager } from './usbManager';
import logger from './logger';
import { config } from '../config';

export interface CopyJob {
  id: string;
  sourceFilePath: string;
  destinationDrive: string;
  destinationPath: string;
  size: number;
  copied: number;
  status: 'pending' | 'copying' | 'completed' | 'failed' | 'cancelled';
  error?: string;
  sessionToken: string;
}

class CopyEngine extends EventEmitter {
  private queue: CopyJob[] = [];
  private activeJobs: Map<string, CopyJob> = new Map();
  private maxConcurrentJobs = config.maxConcurrentCopies;
  private simulatedSpeedBps = 15 * 1024 * 1024; // 15 MB/s

  constructor() {
    super();
  }

  public addJob(job: Omit<CopyJob, 'id' | 'copied' | 'status'>): CopyJob {
    const newJob: CopyJob = {
      ...job,
      id: Math.random().toString(36).substring(2, 15),
      copied: 0,
      status: 'pending'
    };

    // 1. File Extension Filtering
    const ext = path.extname(job.sourceFilePath).toLowerCase();
    if (!config.allowedExtensions.includes(ext)) {
      newJob.status = 'failed';
      newJob.error = `File type ${ext} not allowed. Only ${config.allowedExtensions.join(', ')} are supported.`;
      logger.warn(`Job Rejected: Illegal file type ${ext} for ${job.sourceFilePath}`);
      this.emit('jobFailed', newJob);
      return newJob;
    }

    // 2. Disk Space Check
    const usb = usbManager.getUSBByDriveLetter(job.destinationDrive);
    if (!usb) {
      newJob.status = 'failed';
      newJob.error = 'USB drive not found';
      logger.error(`Job Failed: USB ${job.destinationDrive} not found for job ${newJob.id}`);
      this.emit('jobFailed', newJob);
      return newJob;
    }

    if (usb.freeSpace < job.size) {
      newJob.status = 'failed';
      newJob.error = 'Not enough free space on USB drive';
      logger.error(`Job Failed: Insufficient space on ${job.destinationDrive}. Required: ${job.size}, Available: ${usb.freeSpace}`);
      this.emit('jobFailed', newJob);
      return newJob;
    }

    this.queue.push(newJob);
    logger.info(`Job Queued: ${newJob.id} - ${path.basename(job.sourceFilePath)} to ${job.destinationDrive}`);
    this.emit('jobAdded', newJob);
    this.processQueue();
    return newJob;
  }

  private processQueue() {
    if (this.activeJobs.size >= this.maxConcurrentJobs || this.queue.length === 0) {
      return;
    }

    const job = this.queue.shift();
    if (job) {
      this.startJob(job);
    }
  }

  private async startJob(job: CopyJob) {
    job.status = 'copying';
    this.activeJobs.set(job.id, job);
    this.emit('jobStarted', job);
    logger.info(`Job Started: ${job.id} - ${path.basename(job.sourceFilePath)}`);

    try {
      const chunkSize = 1024 * 1024; // 1MB chunks
      const delayMs = (chunkSize / this.simulatedSpeedBps) * 1000;

      while (job.copied < job.size) {
        if (job.status !== 'copying') {
          break;
        }

        // 3. USB Removal Check
        const usb = usbManager.getUSBByDriveLetter(job.destinationDrive);
        if (!usb) {
          throw new Error('CRITICAL: USB drive disconnected during copy');
        }

        // 4. Disk Full Simulation/Check
        if (usb.freeSpace < chunkSize && job.copied < job.size) {
          throw new Error('CRITICAL: Disk full during copy process');
        }

        const bytesToCopy = Math.min(chunkSize, job.size - job.copied);
        job.copied += bytesToCopy;
        
        // Update USB free space locally (simulation)
        usb.freeSpace -= bytesToCopy;

        this.emit('jobProgress', job);
        
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }

      if (job.status === 'copying') {
        job.status = 'completed';
        this.activeJobs.delete(job.id);
        logger.info(`Job Completed: ${job.id}`);
        this.emit('jobCompleted', job);
      }
    } catch (error: any) {
      job.status = 'failed';
      job.error = error.message;
      this.activeJobs.delete(job.id);
      logger.error(`Job Failed: ${job.id} - Error: ${error.message}`);
      this.emit('jobFailed', job);
      this.emit('criticalError', { jobId: job.id, error: error.message });
    }

    this.processQueue();
  }

  public cancelJob(jobId: string) {
    const activeJob = this.activeJobs.get(jobId);
    if (activeJob) {
      activeJob.status = 'cancelled';
      this.activeJobs.delete(jobId);
      logger.info(`Job Cancelled (Active): ${jobId}`);
      this.emit('jobCancelled', activeJob);
      this.processQueue();
      return true;
    }

    const queueIndex = this.queue.findIndex(j => j.id === jobId);
    if (queueIndex !== -1) {
      const job = this.queue[queueIndex];
      job.status = 'cancelled';
      this.queue.splice(queueIndex, 1);
      logger.info(`Job Cancelled (Queued): ${jobId}`);
      this.emit('jobCancelled', job);
      return true;
    }

    return false;
  }

  public getJobsBySession(sessionToken: string): CopyJob[] {
    const active = Array.from(this.activeJobs.values()).filter(j => j.sessionToken === sessionToken);
    const queued = this.queue.filter(j => j.sessionToken === sessionToken);
    return [...active, ...queued];
  }
  
  public getAllJobs(): CopyJob[] {
    return [...Array.from(this.activeJobs.values()), ...this.queue];
  }
}

export const copyEngine = new CopyEngine();
