import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly uploadDir: string;

  constructor(private config: ConfigService) {
    this.uploadDir = this.config.get<string>('UPLOAD_DIR') ?? path.join(process.cwd(), 'uploads');
    this.ensureDir(this.uploadDir);
  }

  private ensureDir(dir: string) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      this.logger.log(`Created upload directory: ${dir}`);
    }
  }

  /**
   * Save a file buffer to disk. Returns the relative file path for storage in the DB.
   * @param buffer - file contents
   * @param originalName - original filename (used for extension)
   * @param subfolder - e.g. 'receipts', 'contracts'
   */
  async save(buffer: Buffer, originalName: string, subfolder: string): Promise<string> {
    const ext = path.extname(originalName).toLowerCase();
    const filename = `${randomUUID()}${ext}`;
    const subDir = path.join(this.uploadDir, subfolder);
    this.ensureDir(subDir);
    const fullPath = path.join(subDir, filename);
    fs.writeFileSync(fullPath, buffer);
    return path.join(subfolder, filename); // relative path stored in DB
  }

  /**
   * Returns the absolute path for a stored relative path.
   */
  resolve(relativePath: string): string {
    return path.join(this.uploadDir, relativePath);
  }

  /**
   * Delete a stored file. Silent if file doesn't exist.
   */
  delete(relativePath: string): void {
    const fullPath = this.resolve(relativePath);
    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
    }
  }

  exists(relativePath: string): boolean {
    return fs.existsSync(this.resolve(relativePath));
  }
}
