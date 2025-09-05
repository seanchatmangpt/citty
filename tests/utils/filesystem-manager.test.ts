/**
 * Tests for FileSystem Manager
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { fileSystemManager } from '../../src/utils/filesystem-manager.js';
import { join } from 'node:path';
import { existsSync } from 'node:fs';

const TEST_DIR = join(process.cwd(), 'tests', 'tmp');
const TEST_FILE = join(TEST_DIR, 'test.txt');
const TEST_FILE_2 = join(TEST_DIR, 'test2.txt');

describe('FileSystemManager', () => {
  beforeEach(async () => {
    // Ensure test directory exists
    await fileSystemManager.ensureDirectory(TEST_DIR);
  });

  afterEach(async () => {
    // Cleanup test files
    try {
      if (existsSync(TEST_DIR)) {
        await fileSystemManager.remove(TEST_DIR, true);
      }
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('readFile', () => {
    it('should read file content', async () => {
      const content = 'Hello, World!';
      await fileSystemManager.writeFile(TEST_FILE, content);
      
      const result = await fileSystemManager.readFile(TEST_FILE);
      expect(result).toBe(content);
    });

    it('should handle non-existent file', async () => {
      await expect(
        fileSystemManager.readFile('/nonexistent/file.txt')
      ).rejects.toThrow(/File not found/);
    });

    it('should handle different encodings', async () => {
      const content = 'Test content';
      await fileSystemManager.writeFile(TEST_FILE, content);
      
      const result = await fileSystemManager.readFile(TEST_FILE, {
        encoding: 'utf8'
      });
      expect(result).toBe(content);
    });
  });

  describe('writeFile', () => {
    it('should write file content', async () => {
      const content = 'Test content';
      await fileSystemManager.writeFile(TEST_FILE, content);
      
      const result = await fileSystemManager.readFile(TEST_FILE);
      expect(result).toBe(content);
    });

    it('should create directories automatically', async () => {
      const deepFile = join(TEST_DIR, 'deep', 'nested', 'file.txt');
      const content = 'Deep content';
      
      await fileSystemManager.writeFile(deepFile, content, {
        createDir: true
      });
      
      const result = await fileSystemManager.readFile(deepFile);
      expect(result).toBe(content);
    });

    it('should create backup when requested', async () => {
      const content1 = 'Original content';
      const content2 = 'Updated content';
      
      // Write original file
      await fileSystemManager.writeFile(TEST_FILE, content1);
      
      // Update with backup
      await fileSystemManager.writeFile(TEST_FILE, content2, {
        backup: true
      });
      
      // Check updated content
      const result = await fileSystemManager.readFile(TEST_FILE);
      expect(result).toBe(content2);
      
      // Check backup exists
      const backupFiles = await fileSystemManager.glob(`${TEST_FILE}.backup.*`);
      expect(backupFiles.length).toBe(1);
    });

    it('should write atomically when requested', async () => {
      const content = 'Atomic content';
      
      await fileSystemManager.writeFile(TEST_FILE, content, {
        atomic: true
      });
      
      const result = await fileSystemManager.readFile(TEST_FILE);
      expect(result).toBe(content);
    });
  });

  describe('ensureDirectory', () => {
    it('should create directory recursively', async () => {
      const deepDir = join(TEST_DIR, 'very', 'deep', 'directory');
      
      await fileSystemManager.ensureDirectory(deepDir);
      
      expect(existsSync(deepDir)).toBe(true);
    });

    it('should not fail if directory exists', async () => {
      await fileSystemManager.ensureDirectory(TEST_DIR);
      
      // Should not throw
      await fileSystemManager.ensureDirectory(TEST_DIR);
      
      expect(existsSync(TEST_DIR)).toBe(true);
    });

    it('should throw if path is a file', async () => {
      await fileSystemManager.writeFile(TEST_FILE, 'content');
      
      await expect(
        fileSystemManager.ensureDirectory(TEST_FILE)
      ).rejects.toThrow(/Path exists but is not a directory/);
    });
  });

  describe('getFileInfo', () => {
    it('should return file information', async () => {
      const content = 'Test content';
      await fileSystemManager.writeFile(TEST_FILE, content);
      
      const info = await fileSystemManager.getFileInfo(TEST_FILE);
      
      expect(info.name).toBe('test.txt');
      expect(info.extension).toBe('.txt');
      expect(info.isFile).toBe(true);
      expect(info.isDirectory).toBe(false);
      expect(info.size).toBe(content.length);
    });

    it('should return directory information', async () => {
      const info = await fileSystemManager.getFileInfo(TEST_DIR);
      
      expect(info.isFile).toBe(false);
      expect(info.isDirectory).toBe(true);
    });

    it('should include hash when requested', async () => {
      const content = 'Test content';
      await fileSystemManager.writeFile(TEST_FILE, content);
      
      const info = await fileSystemManager.getFileInfo(TEST_FILE, true);
      
      expect(info.hash).toBeDefined();
      expect(info.hash).toHaveLength(64); // SHA256 hex
    });
  });

  describe('copy', () => {
    it('should copy single file', async () => {
      const content = 'Original content';
      await fileSystemManager.writeFile(TEST_FILE, content);
      
      await fileSystemManager.copy(TEST_FILE, TEST_FILE_2);
      
      const result = await fileSystemManager.readFile(TEST_FILE_2);
      expect(result).toBe(content);
    });

    it('should copy directory recursively', async () => {
      const sourceDir = join(TEST_DIR, 'source');
      const targetDir = join(TEST_DIR, 'target');
      const sourceFile = join(sourceDir, 'file.txt');
      const content = 'Directory content';
      
      await fileSystemManager.ensureDirectory(sourceDir);
      await fileSystemManager.writeFile(sourceFile, content);
      
      await fileSystemManager.copy(sourceDir, targetDir, {
        recursive: true
      });
      
      const targetFile = join(targetDir, 'file.txt');
      const result = await fileSystemManager.readFile(targetFile);
      expect(result).toBe(content);
    });

    it('should respect overwrite option', async () => {
      const content1 = 'Original';
      const content2 = 'Updated';
      
      await fileSystemManager.writeFile(TEST_FILE, content1);
      await fileSystemManager.writeFile(TEST_FILE_2, content2);
      
      await expect(
        fileSystemManager.copy(TEST_FILE, TEST_FILE_2, {
          overwrite: false
        })
      ).rejects.toThrow(/already exists/);
    });

    it('should apply filter when provided', async () => {
      const sourceDir = join(TEST_DIR, 'filtered_source');
      const targetDir = join(TEST_DIR, 'filtered_target');
      
      await fileSystemManager.ensureDirectory(sourceDir);
      await fileSystemManager.writeFile(join(sourceDir, 'include.txt'), 'include');
      await fileSystemManager.writeFile(join(sourceDir, 'exclude.log'), 'exclude');
      
      await fileSystemManager.copy(sourceDir, targetDir, {
        recursive: true,
        filter: (src) => !src.endsWith('.log')
      });
      
      expect(existsSync(join(targetDir, 'include.txt'))).toBe(true);
      expect(existsSync(join(targetDir, 'exclude.log'))).toBe(false);
    });
  });

  describe('remove', () => {
    it('should remove single file', async () => {
      await fileSystemManager.writeFile(TEST_FILE, 'content');
      expect(existsSync(TEST_FILE)).toBe(true);
      
      await fileSystemManager.remove(TEST_FILE);
      expect(existsSync(TEST_FILE)).toBe(false);
    });

    it('should remove directory recursively', async () => {
      const dirToRemove = join(TEST_DIR, 'to_remove');
      const fileInDir = join(dirToRemove, 'file.txt');
      
      await fileSystemManager.ensureDirectory(dirToRemove);
      await fileSystemManager.writeFile(fileInDir, 'content');
      
      await fileSystemManager.remove(dirToRemove, true);
      
      expect(existsSync(dirToRemove)).toBe(false);
    });

    it('should not fail for non-existent path', async () => {
      // Should not throw
      await fileSystemManager.remove('/nonexistent/path');
    });
  });

  describe('glob', () => {
    it('should find files by pattern', async () => {
      await fileSystemManager.writeFile(join(TEST_DIR, 'file1.txt'), 'content');
      await fileSystemManager.writeFile(join(TEST_DIR, 'file2.txt'), 'content');
      await fileSystemManager.writeFile(join(TEST_DIR, 'other.log'), 'content');
      
      const results = await fileSystemManager.glob('*.txt', {
        cwd: TEST_DIR
      });
      
      expect(results).toHaveLength(2);
      expect(results.some(f => f.includes('file1.txt'))).toBe(true);
      expect(results.some(f => f.includes('file2.txt'))).toBe(true);
    });

    it('should handle multiple patterns', async () => {
      await fileSystemManager.writeFile(join(TEST_DIR, 'file.txt'), 'content');
      await fileSystemManager.writeFile(join(TEST_DIR, 'file.log'), 'content');
      await fileSystemManager.writeFile(join(TEST_DIR, 'file.md'), 'content');
      
      const results = await fileSystemManager.glob(['*.txt', '*.log'], {
        cwd: TEST_DIR
      });
      
      expect(results).toHaveLength(2);
    });

    it('should return absolute paths when requested', async () => {
      await fileSystemManager.writeFile(join(TEST_DIR, 'abs.txt'), 'content');
      
      const results = await fileSystemManager.glob('*.txt', {
        cwd: TEST_DIR,
        absolute: true
      });
      
      expect(results[0]).toContain(TEST_DIR);
    });
  });

  describe('getFileHash', () => {
    it('should generate consistent hash for same content', async () => {
      const content = 'Hash test content';
      await fileSystemManager.writeFile(TEST_FILE, content);
      
      const hash1 = await fileSystemManager.getFileHash(TEST_FILE);
      const hash2 = await fileSystemManager.getFileHash(TEST_FILE);
      
      expect(hash1).toBe(hash2);
      expect(hash1).toHaveLength(64); // SHA256 hex
    });

    it('should generate different hash for different content', async () => {
      await fileSystemManager.writeFile(TEST_FILE, 'content1');
      await fileSystemManager.writeFile(TEST_FILE_2, 'content2');
      
      const hash1 = await fileSystemManager.getFileHash(TEST_FILE);
      const hash2 = await fileSystemManager.getFileHash(TEST_FILE_2);
      
      expect(hash1).not.toBe(hash2);
    });
  });

  describe('isSafePath', () => {
    it('should allow paths within allowed roots', () => {
      const safePath = join(TEST_DIR, 'safe.txt');
      const result = fileSystemManager.isSafePath(safePath, [TEST_DIR]);
      
      expect(result).toBe(true);
    });

    it('should reject paths outside allowed roots', () => {
      const unsafePath = join(TEST_DIR, '..', '..', 'unsafe.txt');
      const result = fileSystemManager.isSafePath(unsafePath, [TEST_DIR]);
      
      expect(result).toBe(false);
    });

    it('should handle absolute paths correctly', () => {
      const result = fileSystemManager.isSafePath('/etc/passwd', [TEST_DIR]);
      expect(result).toBe(false);
    });
  });

  describe('temp file operations', () => {
    it('should create and clean up temp files', async () => {
      const tempFile = await fileSystemManager.createTempFile('test');
      
      expect(existsSync(tempFile)).toBe(true);
      expect(tempFile).toContain('test');
      
      await fileSystemManager.remove(tempFile);
      expect(existsSync(tempFile)).toBe(false);
    });

    it('should clean up temp files by pattern', async () => {
      const tempFile1 = await fileSystemManager.createTempFile('cleanup-test');
      const tempFile2 = await fileSystemManager.createTempFile('cleanup-test');
      
      expect(existsSync(tempFile1)).toBe(true);
      expect(existsSync(tempFile2)).toBe(true);
      
      await fileSystemManager.cleanupTempFiles('cleanup-test-*');
      
      expect(existsSync(tempFile1)).toBe(false);
      expect(existsSync(tempFile2)).toBe(false);
    });
  });
});