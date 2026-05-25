import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { FileInfo, FileType } from '../types';
import { FileSystemError } from '../errors/errors';

export class FileUtils {
  static async getFileInfo(filePath: string): Promise<FileInfo> {
    try {
      const stats = await fs.promises.stat(filePath);
      const name = path.basename(filePath);
      const type: FileType = stats.isDirectory() ? 'DIRECTORY' : stats.isSymbolicLink() ? 'SYMLINK' : 'FILE';

      return {
        path: filePath,
        name,
        type,
        size: stats.size,
        modified: stats.mtime,
        permissions: stats.mode.toString(8)
      };
    } catch (error) {
      throw new FileSystemError(`Failed to get file info for ${filePath}: ${error}`);
    }
  }

  static async listFiles(dirPath: string, recursive = true): Promise<string[]> {
    try {
      const files: string[] = [];

      async function scanDirectory(currentPath: string) {
        const items = await fs.promises.readdir(currentPath);

        for (const item of items) {
          const fullPath = path.join(currentPath, item);
          const stats = await fs.promises.stat(fullPath);

          if (stats.isDirectory()) {
            files.push(fullPath);
            if (recursive) {
              await scanDirectory(fullPath);
            }
          } else {
            files.push(fullPath);
          }
        }
      }

      await scanDirectory(dirPath);
      return files;
    } catch (error) {
      throw new FileSystemError(`Failed to list files in ${dirPath}: ${error}`);
    }
  }

  static async calculateFileHash(filePath: string, algorithm: string = 'sha256'): Promise<string> {
    try {
      const hash = crypto.createHash(algorithm);
      const stream = fs.createReadStream(filePath);

      return new Promise((resolve, reject) => {
        stream.on('data', (chunk) => hash.update(chunk));
        stream.on('end', () => resolve(hash.digest('hex')));
        stream.on('error', (error) => reject(new FileSystemError(`Failed to calculate hash for ${filePath}: ${error}`)));
      });
    } catch (error) {
      throw new FileSystemError(`Failed to calculate hash for ${filePath}: ${error}`);
    }
  }

  static async ensureDirectoryExists(dirPath: string): Promise<void> {
    try {
      await fs.promises.mkdir(dirPath, { recursive: true });
    } catch (error) {
      throw new FileSystemError(`Failed to create directory ${dirPath}: ${error}`);
    }
  }

  static async copyFile(source: string, destination: string): Promise<void> {
    try {
      await fs.promises.copyFile(source, destination);
    } catch (error) {
      throw new FileSystemError(`Failed to copy file from ${source} to ${destination}: ${error}`);
    }
  }

  static async copyDirectory(source: string, destination: string): Promise<void> {
    try {
      await this.ensureDirectoryExists(destination);
      const files = await this.listFiles(source, true);

      for (const file of files) {
        const relativePath = path.relative(source, file);
        const destPath = path.join(destination, relativePath);

        if ((await fs.promises.stat(file)).isDirectory()) {
          await this.ensureDirectoryExists(destPath);
        } else {
          await this.ensureDirectoryExists(path.dirname(destPath));
          await this.copyFile(file, destPath);
        }
      }
    } catch (error) {
      throw new FileSystemError(`Failed to copy directory from ${source} to ${destination}: ${error}`);
    }
  }

  static async deleteFile(filePath: string): Promise<void> {
    try {
      await fs.promises.unlink(filePath);
    } catch (error) {
      throw new FileSystemError(`Failed to delete file ${filePath}: ${error}`);
    }
  }

  static async deleteDirectory(dirPath: string): Promise<void> {
    try {
      const files = await this.listFiles(dirPath, true);

      for (const file of files.reverse()) {
        const stats = await fs.promises.stat(file);
        if (stats.isDirectory()) {
          await fs.promises.rmdir(file);
        } else {
          await fs.promises.unlink(file);
        }
      }

      await fs.promises.rmdir(dirPath);
    } catch (error) {
      throw new FileSystemError(`Failed to delete directory ${dirPath}: ${error}`);
    }
  }

  static async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.promises.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  static async directoryExists(dirPath: string): Promise<boolean> {
    try {
      const stats = await fs.promises.stat(dirPath);
      return stats.isDirectory();
    } catch {
      return false;
    }
  }

  static async readJsonFile<T>(filePath: string): Promise<T> {
    try {
      const content = await fs.promises.readFile(filePath, 'utf-8');
      return JSON.parse(content) as T;
    } catch (error) {
      throw new FileSystemError(`Failed to read JSON file ${filePath}: ${error}`);
    }
  }

  static async writeJsonFile<T>(filePath: string, data: T): Promise<void> {
    try {
      await this.ensureDirectoryExists(path.dirname(filePath));
      await fs.promises.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
    } catch (error) {
      throw new FileSystemError(`Failed to write JSON file ${filePath}: ${error}`);
    }
  }

  static async readFileLines(filePath: string, maxLines: number = 100): Promise<string[]> {
    try {
      const content = await fs.promises.readFile(filePath, 'utf-8');
      return content.split('\n').slice(0, maxLines);
    } catch (error) {
      throw new FileSystemError(`Failed to read file ${filePath}: ${error}`);
    }
  }

  static async getFileSize(filePath: string): Promise<number> {
    try {
      const stats = await fs.promises.stat(filePath);
      return stats.size;
    } catch (error) {
      throw new FileSystemError(`Failed to get file size for ${filePath}: ${error}`);
    }
  }

  static async isSymbolicLink(filePath: string): Promise<boolean> {
    try {
      const stats = await fs.promises.lstat(filePath);
      return stats.isSymbolicLink();
    } catch {
      return false;
    }
  }

  static normalizePath(filePath: string): string {
    return path.normalize(filePath).replace(/\\/g, '/');
  }

  static getRelativePath(basePath: string, targetPath: string): string {
    return path.relative(basePath, targetPath);
  }

  static async compareDirectories(dir1: string, dir2: string): Promise<{ onlyInDir1: string[], onlyInDir2: string[], different: string[] }> {
    try {
      const files1 = await this.listFiles(dir1, true);
      const files2 = await this.listFiles(dir2, true);

      const normalized1 = files1.map(f => this.normalizePath(path.relative(dir1, f)));
      const normalized2 = files2.map(f => this.normalizePath(path.relative(dir2, f)));

      const onlyInDir1 = normalized1.filter(f => !normalized2.includes(f));
      const onlyInDir2 = normalized2.filter(f => !normalized1.includes(f));

      const commonFiles = normalized1.filter(f => normalized2.includes(f));
      const different: string[] = [];

      for (const file of commonFiles) {
        const file1 = path.join(dir1, file);
        const file2 = path.join(dir2, file);

        try {
          const stats1 = await fs.promises.stat(file1);
          const stats2 = await fs.promises.stat(file2);

          if (stats1.isDirectory() !== stats2.isDirectory()) {
            different.push(file);
            continue;
          }

          if (!stats1.isDirectory()) {
            const hash1 = await this.calculateFileHash(file1);
            const hash2 = await this.calculateFileHash(file2);

            if (hash1 !== hash2) {
              different.push(file);
            }
          }
        } catch {
          different.push(file);
        }
      }

      return {
        onlyInDir1: onlyInDir1.map(f => path.join(dir1, f)),
        onlyInDir2: onlyInDir2.map(f => path.join(dir2, f)),
        different: different.map(f => path.join(dir1, f))
      };
    } catch (error) {
      throw new FileSystemError(`Failed to compare directories ${dir1} and ${dir2}: ${error}`);
    }
  }
}