import { exec } from 'child_process';
import { v4 as uuidv4 } from 'uuid';
import QRCode from 'qrcode';
import logger from './logger';
import { config } from '../config';

export interface USBDevice {
  deviceId: string;
  driveLetter: string;
  volumeName: string;
  freeSpace: number;
  totalSpace: number;
  sessionToken: string;
  qrCodeUrl: string;
  connectedAt: number;
}

class USBManager {
  private connectedUSBs: Map<string, USBDevice> = new Map();
  private localIp: string = 'localhost';

  constructor() {
    this.setLocalIp();
    this.startPolling();
  }

  private setLocalIp() {
    const { networkInterfaces } = require('os');
    const nets = networkInterfaces();
    for (const name of Object.keys(nets)) {
      for (const net of nets[name]) {
        if (net.family === 'IPv4' && !net.internal) {
          this.localIp = net.address;
          logger.info(`Server Local IP detected: ${this.localIp}`);
          return;
        }
      }
    }
  }

  private startPolling() {
    setInterval(() => {
      this.detectUSBs();
    }, 5000);
    this.detectUSBs();
  }

  private detectUSBs() {
    if (config.isDevelopment && process.platform !== 'win32') {
      this.simulateUSB();
      return;
    }

    const cmd = 'wmic logicaldisk where drivetype=2 get deviceid,volumename,freespace,size /format:csv';
    
    exec(cmd, async (error, stdout, stderr) => {
      if (error) {
        logger.error(`WMIC Failure: ${error.message}`);
        if (config.isDevelopment) this.simulateUSB();
        return;
      }

      if (stderr) {
        logger.warn(`WMIC Stderr: ${stderr}`);
      }

      const lines = stdout.split('\n').map(line => line.trim()).filter(line => line.length > 0);
      if (lines.length <= 1) {
        if (this.connectedUSBs.size > 0) {
          logger.info('All USBs disconnected');
          this.connectedUSBs.clear();
        }
        return;
      }

      const currentDriveLetters = new Set<string>();

      for (let i = 1; i < lines.length; i++) {
        const parts = lines[i].split(',');
        if (parts.length >= 5) {
          const driveLetter = parts[1];
          const freeSpace = parseInt(parts[2], 10) || 0;
          const totalSpace = parseInt(parts[3], 10) || 0;
          const volumeName = parts[4] || 'USB Drive';

          currentDriveLetters.add(driveLetter);

          if (!this.connectedUSBs.has(driveLetter)) {
            try {
              const sessionToken = uuidv4();
              const connectUrl = `http://${this.localIp}:3000/connect/${sessionToken}`;
              const qrCodeUrl = await QRCode.toDataURL(connectUrl);

              this.connectedUSBs.set(driveLetter, {
                deviceId: driveLetter,
                driveLetter,
                volumeName,
                freeSpace,
                totalSpace,
                sessionToken,
                qrCodeUrl,
                connectedAt: Date.now()
              });
              logger.info(`New USB bound: ${driveLetter} (${volumeName}) - Session: ${sessionToken}`);
            } catch (qrErr: any) {
              logger.error(`QR Generation Failed for ${driveLetter}: ${qrErr.message}`);
            }
          } else {
            const usb = this.connectedUSBs.get(driveLetter)!;
            usb.freeSpace = freeSpace;
            usb.totalSpace = totalSpace;
          }
        }
      }

      for (const [driveLetter, usb] of this.connectedUSBs.entries()) {
        if (!currentDriveLetters.has(driveLetter)) {
          logger.info(`USB Unplugged: ${driveLetter} (Session: ${usb.sessionToken})`);
          this.connectedUSBs.delete(driveLetter);
        }
      }
    });
  }

  private async simulateUSB() {
    const driveLetter = 'E:';
    if (!this.connectedUSBs.has(driveLetter)) {
      const sessionToken = uuidv4();
      const connectUrl = `http://${this.localIp}:3000/connect/${sessionToken}`;
      const qrCodeUrl = await QRCode.toDataURL(connectUrl);

      this.connectedUSBs.set(driveLetter, {
        deviceId: driveLetter,
        driveLetter,
        volumeName: 'Simulated USB',
        freeSpace: 32 * 1024 * 1024 * 1024,
        totalSpace: 64 * 1024 * 1024 * 1024,
        sessionToken,
        qrCodeUrl,
        connectedAt: Date.now()
      });
      logger.info(`Simulated USB detected (Dev Mode): ${driveLetter}`);
    }
  }

  public getConnectedUSBs(): USBDevice[] {
    return Array.from(this.connectedUSBs.values());
  }

  public getUSBByToken(token: string): USBDevice | undefined {
    for (const usb of this.connectedUSBs.values()) {
      if (usb.sessionToken === token) return usb;
    }
    return undefined;
  }
  
  public getUSBByDriveLetter(driveLetter: string): USBDevice | undefined {
    return this.connectedUSBs.get(driveLetter);
  }
}

export const usbManager = new USBManager();
