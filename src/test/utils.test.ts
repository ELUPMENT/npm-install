import { FileUtils } from '../utils/file-utils';
import { createTestPackage, cleanupTestPackage } from './setup';
import fs from 'fs';
import path from 'path';

describe('FileUtils', () => {
  const testDir = path.join(__dirname, '..', '..', 'test-temp');
  const testFile = path.join(testDir, 'test.txt');
  const testSubDir = path.join(testDir, 'subdir');
  const testSubFile = path.join(testSubDir, 'nested.txt');

  beforeAll(async () => {
    await FileUtils.ensureDirectoryExists(testDir);
    await fs.promises.writeFile(testFile, 'Hello, world!');
    await FileUtils.ensureDirectoryExists(testSubDir);
    await fs.promises.writeFile(testSubFile, 'Nested content');
  });

  afterAll(async () => {
    if (await FileUtils.directoryExists(testDir)) {
      await FileUtils.deleteDirectory(testDir);
    }
  });

  describe('getFileInfo', () => {
    it('should get file info for existing file', async () => {
      const info = await FileUtils.getFileInfo(testFile);
      
      expect(info).toBeDefined();
      expect(info.path).toBe(testFile);
      expect(info.name).toBe('test.txt');
      expect(info.type).toBe('FILE');
      expect(info.size).toBeGreaterThan(0);
      expect(info.modified).toBeInstanceOf(Date);
      expect(info.permissions).toBeDefined();
    });

    it('should throw error for non-existent file', async () => {
      const nonExistent = path.join(testDir, 'non-existent.txt');
      await expect(FileUtils.getFileInfo(nonExistent)).rejects.toThrow();
    });
  });

  describe('listFiles', () => {
    it('should list files recursively', async () => {
      const files = await FileUtils.listFiles(testDir, true);
      
      expect(files).toContain(testFile);
      expect(files).toContain(testSubDir);
      expect(files).toContain(testSubFile);
      expect(files.length).toBe(3);
    });

    it('should list files non-recursively', async () => {
      const files = await FileUtils.listFiles(testDir, false);
      
      expect(files).toContain(testFile);
      expect(files).toContain(testSubDir);
      expect(files).not.toContain(testSubFile);
      expect(files.length).toBe(2);
    });
  });

  describe('calculateFileHash', () => {
    it('should calculate SHA256 hash of a file', async () => {
      const hash = await FileUtils.calculateFileHash(testFile, 'sha256');
      
      expect(hash).toBeDefined();
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should throw error for non-existent file', async () => {
      const nonExistent = path.join(testDir, 'non-existent.txt');
      await expect(FileUtils.calculateFileHash(nonExistent)).rejects.toThrow();
    });
  });

  describe('copyFile and copyDirectory', () => {
    const destFile = path.join(testDir, 'test-copy.txt');
    const destDir = path.join(testDir, 'copy-dir');

    afterEach(async () => {
      if (await FileUtils.fileExists(destFile)) {
        await FileUtils.deleteFile(destFile);
      }
      if (await FileUtils.directoryExists(destDir)) {
        await FileUtils.deleteDirectory(destDir);
      }
    });

    it('should copy a file', async () => {
      await FileUtils.copyFile(testFile, destFile);
      expect(await FileUtils.fileExists(destFile)).toBe(true);
      
      const originalContent = await fs.promises.readFile(testFile, 'utf-8');
      const copiedContent = await fs.promises.readFile(destFile, 'utf-8');
      expect(copiedContent).toBe(originalContent);
    });

    it('should copy a directory', async () => {
      await FileUtils.copyDirectory(testDir, destDir);
      expect(await FileUtils.directoryExists(destDir)).toBe(true);
      
      const destSubFile = path.join(destDir, 'subdir', 'nested.txt');
      expect(await FileUtils.fileExists(destSubFile)).toBe(true);
    });
  });

  describe('fileExists and directoryExists', () => {
    it('should correctly identify existing files and directories', async () => {
      expect(await FileUtils.fileExists(testFile)).toBe(true);
      expect(await FileUtils.directoryExists(testDir)).toBe(true);
      expect(await FileUtils.fileExists(testDir)).toBe(false);
      expect(await FileUtils.directoryExists(testFile)).toBe(false);
    });

    it('should return false for non-existent paths', async () => {
      const nonExistent = path.join(testDir, 'non-existent.txt');
      expect(await FileUtils.fileExists(nonExistent)).toBe(false);
      expect(await FileUtils.directoryExists(nonExistent)).toBe(false);
    });
  });

  describe('readJsonFile and writeJsonFile', () => {
    const jsonFile = path.join(testDir, 'test.json');
    const testData = { name: 'test', value: 123, nested: { array: [1, 2, 3] } };

    afterEach(async () => {
      if (await FileUtils.fileExists(jsonFile)) {
        await FileUtils.deleteFile(jsonFile);
      }
    });

    it('should write and read JSON file', async () => {
      await FileUtils.writeJsonFile(jsonFile, testData);
      expect(await FileUtils.fileExists(jsonFile)).toBe(true);
      
      const readData = await FileUtils.readJsonFile<any>(jsonFile);
      expect(readData).toEqual(testData);
    });

    it('should throw error for invalid JSON file', async () => {
      await fs.promises.writeFile(jsonFile, 'invalid json');
      await expect(FileUtils.readJsonFile(jsonFile)).rejects.toThrow();
    });
  });

  describe('compareDirectories', () => {
    const dir1 = path.join(testDir, 'compare-1');
    const dir2 = path.join(testDir, 'compare-2');
    const file1 = path.join(dir1, 'same.txt');
    const file2 = path.join(dir2, 'same.txt');
    const file1Only = path.join(dir1, 'only1.txt');
    const file2Only = path.join(dir2, 'only2.txt');
    const diffFile1 = path.join(dir1, 'diff.txt');
    const diffFile2 = path.join(dir2, 'diff.txt');

    beforeAll(async () => {
      await FileUtils.ensureDirectoryExists(dir1);
      await FileUtils.ensureDirectoryExists(dir2);
      
      await fs.promises.writeFile(file1, 'same content');
      await fs.promises.writeFile(file2, 'same content');
      await fs.promises.writeFile(file1Only, 'only in dir1');
      await fs.promises.writeFile(file2Only, 'only in dir2');
      await fs.promises.writeFile(diffFile1, 'content 1');
      await fs.promises.writeFile(diffFile2, 'content 2');
    });

    afterAll(async () => {
      if (await FileUtils.directoryExists(dir1)) {
        await FileUtils.deleteDirectory(dir1);
      }
      if (await FileUtils.directoryExists(dir2)) {
        await FileUtils.deleteDirectory(dir2);
      }
    });

    it('should compare directories and find differences', async () => {
      const result = await FileUtils.compareDirectories(dir1, dir2);
      
      expect(result.onlyInDir1).toContain(file1Only);
      expect(result.onlyInDir2).toContain(file2Only);
      expect(result.different).toContain(diffFile1);
      expect(result.onlyInDir1).not.toContain(file1);
      expect(result.onlyInDir2).not.toContain(file2);
    });
  });
});