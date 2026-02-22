import { v4 as uuidv4 } from 'uuid';
import QRCode from 'qrcode';
import logger from './logger';

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

class MockUSBManager {
  private connectedUSBs: Map<string, USBDevice> = new Map();
  private localIp: string = 'localhost';

  constructor() {
    this.initMock();
  }

  private async initMock() {
    const driveLetter = 'E:';
    const sessionToken = 'mock-session-12345';
    const connectUrl = `http://${this.localIp}:3000/connect/${sessionToken}`;
    
    try {
      const qrCodeUrl = await QRCode.toDataURL(connectUrl);

      this.connectedUSBs.set(driveLetter, {
        deviceId: driveLetter,
        driveLetter,
        volumeName: 'فلش مموری ۳۲ گیگ',
        freeSpace: 12.5 * 1024 * 1024 * 1024,
        totalSpace: 32 * 1024 * 1024 * 1024,
        sessionToken,
        qrCodeUrl,
        connectedAt: Date.now()
      });
      
      logger.info('Mock USB Manager initialized with dummy data');
    } catch (err) {
      logger.error('Failed to generate mock QR code');
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

export const mockUsbManager = new MockUSBManager();
