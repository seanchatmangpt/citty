/**
 * FileSystem Manager for Citty CLI
 * Handles robust file operations with cross-platform compatibility
 */

import { 
  readFile, 
  writeFile, 
  mkdir, 
  stat, 
  readdir, 
  access,
  copyFile,
  unlink,
  rmdir,
  chmod,
  readlink,
  symlink
} from 'node:fs/promises';
import { 
  existsSync, 
  lstatSync, 
  constants as fsConstants 
} from 'node:fs';
import { 
  resolve, 
  dirname, 
  basename, 
  extname, 
  join, 
  relative,
  normalize,
  isAbsolute,
  sep 
} from 'node:path';
import { consola } from 'consola';
import { createHash } from 'node:crypto';
import { glob } from 'fast-glob';
import { EventEmitter } from 'node:events';

export interface FileInfo {
  path: string;
  absolutePath: string;
  relativePath: string;
  name: string;
  extension: string;
  size: number;
  isFile: boolean;
  isDirectory: boolean;
  isSymlink: boolean;
  createdAt: Date;
  modifiedAt: Date;
  mode: number;
  hash?: string;
}

export interface WriteOptions {
  encoding?: BufferEncoding;
  mode?: number;
  flag?: string;
  createDir?: boolean;
  backup?: boolean;
  atomic?: boolean;
}

export interface ReadOptions {
  encoding?: BufferEncoding;
  flag?: string;
}

export interface CopyOptions {
  overwrite?: boolean;
  preserveTimestamps?: boolean;
  recursive?: boolean;
  filter?: (src: string, dest: string) => boolean;
}

export interface GlobOptions {
  cwd?: string;
  absolute?: boolean;
  onlyFiles?: boolean;
  onlyDirectories?: boolean;
  ignore?: string[];
  dot?: boolean;
}

export class FileSystemManager extends EventEmitter {
  private readonly platform: string;

  constructor() {
    super();
    this.platform = process.platform;
    
    // Handle process cleanup
    this.setupCleanupHandlers();
  }

  /**
   * Read file with robust error handling
   */
  async readFile(filePath: string, options: ReadOptions = {}): Promise<string> {
    try {
      const absolutePath = this.normalizePath(filePath);
      
      // Validate file exists and is readable
      await this.validateFileAccess(absolutePath, fsConstants.R_OK);
      
      const content = await readFile(absolutePath, {
        encoding: options.encoding || 'utf8',
        flag: options.flag
      });
      
      consola.debug(`Read file: ${absolutePath}`);
      this.emit('fileRead', { path: absolutePath, size: content.length });
      
      return content;
    } catch (error) {
      this.handleFileError('readFile', filePath, error);
      throw error;
    }
  }

  /**
   * Write file with robust error handling
   */
  async writeFile(
    filePath: string, 
    content: string, 
    options: WriteOptions = {}
  ): Promise<void> {
    try {
      const absolutePath = this.normalizePath(filePath);
      const dirPath = dirname(absolutePath);
      
      // Create directory if needed
      if (options.createDir !== false) {
        await this.ensureDirectory(dirPath);
      }
      
      // Create backup if requested
      if (options.backup && existsSync(absolutePath)) {
        await this.createBackup(absolutePath);
      }
      
      // Write atomically if requested
      if (options.atomic) {
        await this.writeFileAtomic(absolutePath, content, options);
      } else {
        await writeFile(absolutePath, content, {
          encoding: options.encoding || 'utf8',
          mode: options.mode,
          flag: options.flag
        });
      }
      
      consola.debug(`Wrote file: ${absolutePath} (${content.length} bytes)`);
      this.emit('fileWritten', { path: absolutePath, size: content.length });
      
    } catch (error) {
      this.handleFileError('writeFile', filePath, error);
      throw error;
    }
  }

  /**
   * Atomic file write (write to temp file then rename)
   */
  private async writeFileAtomic(
    filePath: string, 
    content: string, 
    options: WriteOptions
  ): Promise<void> {
    const tempPath = `${filePath}.tmp.${Date.now()}.${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      // Write to temporary file
      await writeFile(tempPath, content, {
        encoding: options.encoding || 'utf8',
        mode: options.mode,
        flag: options.flag
      });
      
      // Atomic rename
      const { rename } = await import('node:fs/promises');
      await rename(tempPath, filePath);
      
    } catch (error) {
      // Clean up temp file on error
      try {
        await unlink(tempPath);
      } catch {
        // Ignore cleanup errors
      }
      throw error;
    }
  }

  /**
   * Create directory recursively
   */
  async ensureDirectory(dirPath: string): Promise<void> {
    try {
      const absolutePath = this.normalizePath(dirPath);
      
      if (existsSync(absolutePath)) {
        const stats = lstatSync(absolutePath);
        if (!stats.isDirectory()) {
          throw new Error(`Path exists but is not a directory: ${absolutePath}`);
        }
        return;
      }
      
      await mkdir(absolutePath, { recursive: true });
      consola.debug(`Created directory: ${absolutePath}`);
      this.emit('directoryCreated', { path: absolutePath });
      
    } catch (error) {
      this.handleFileError('ensureDirectory', dirPath, error);
      throw error;
    }
  }

  /**
   * Get detailed file information
   */
  async getFileInfo(filePath: string, includeHash = false): Promise<FileInfo> {
    try {
      const absolutePath = this.normalizePath(filePath);
      const stats = await stat(absolutePath);
      const name = basename(absolutePath);
      
      const info: FileInfo = {
        path: filePath,
        absolutePath,
        relativePath: relative(process.cwd(), absolutePath),
        name,
        extension: extname(name),
        size: stats.size,
        isFile: stats.isFile(),
        isDirectory: stats.isDirectory(),
        isSymlink: stats.isSymbolicLink(),
        createdAt: stats.birthtime,
        modifiedAt: stats.mtime,
        mode: stats.mode
      };
      
      // Include file hash if requested
      if (includeHash && info.isFile) {
        info.hash = await this.getFileHash(absolutePath);
      }
      
      return info;
    } catch (error) {
      this.handleFileError('getFileInfo', filePath, error);
      throw error;
    }
  }

  /**
   * Copy file or directory
   */
  async copy(src: string, dest: string, options: CopyOptions = {}): Promise<void> {
    try {
      const srcPath = this.normalizePath(src);
      const destPath = this.normalizePath(dest);
      
      const srcInfo = await this.getFileInfo(srcPath);
      
      if (srcInfo.isFile) {
        await this.copyFile(srcPath, destPath, options);
      } else if (srcInfo.isDirectory && options.recursive) {
        await this.copyDirectory(srcPath, destPath, options);
      } else {
        throw new Error(`Cannot copy directory without recursive option: ${srcPath}`);
      }
      
    } catch (error) {
      this.handleFileError('copy', src, error);
      throw error;
    }
  }

  /**
   * Copy single file
   */
  private async copyFile(src: string, dest: string, options: CopyOptions): Promise<void> {
    // Check if destination exists
    if (existsSync(dest) && !options.overwrite) {
      throw new Error(`Destination file already exists: ${dest}`);
    }
    
    // Apply filter if provided
    if (options.filter && !options.filter(src, dest)) {
      return;
    }
    
    // Ensure destination directory exists
    await this.ensureDirectory(dirname(dest));
    
    // Copy the file
    await copyFile(src, dest);
    
    // Preserve timestamps if requested
    if (options.preserveTimestamps) {
      const srcStats = await stat(src);
      const { utimes } = await import('node:fs/promises');
      await utimes(dest, srcStats.atime, srcStats.mtime);
    }
    
    consola.debug(`Copied file: ${src} -> ${dest}`);
    this.emit('fileCopied', { src, dest });
  }

  /**
   * Copy directory recursively
   */
  private async copyDirectory(src: string, dest: string, options: CopyOptions): Promise<void> {
    await this.ensureDirectory(dest);
    
    const entries = await readdir(src);
    
    for (const entry of entries) {
      const srcEntry = join(src, entry);
      const destEntry = join(dest, entry);
      
      const entryInfo = await this.getFileInfo(srcEntry);
      
      if (entryInfo.isFile) {
        await this.copyFile(srcEntry, destEntry, options);
      } else if (entryInfo.isDirectory) {
        await this.copyDirectory(srcEntry, destEntry, options);
      }
    }
  }

  /**
   * Remove file or directory
   */
  async remove(path: string, recursive = false): Promise<void> {
    try {
      const absolutePath = this.normalizePath(path);
      
      if (!existsSync(absolutePath)) {
        consola.warn(`Path does not exist: ${absolutePath}`);
        return;
      }
      
      const info = await this.getFileInfo(absolutePath);
      
      if (info.isFile || info.isSymlink) {
        await unlink(absolutePath);
        consola.debug(`Removed file: ${absolutePath}`);
        this.emit('fileRemoved', { path: absolutePath });
      } else if (info.isDirectory) {
        if (recursive) {
          await this.removeDirectory(absolutePath);
        } else {
          await rmdir(absolutePath);
        }
        consola.debug(`Removed directory: ${absolutePath}`);
        this.emit('directoryRemoved', { path: absolutePath });
      }
      
    } catch (error) {
      this.handleFileError('remove', path, error);
      throw error;
    }
  }

  /**
   * Remove directory recursively
   */
  private async removeDirectory(dirPath: string): Promise<void> {
    const entries = await readdir(dirPath);
    
    for (const entry of entries) {
      const entryPath = join(dirPath, entry);
      await this.remove(entryPath, true);
    }
    
    await rmdir(dirPath);
  }

  /**
   * Find files using glob patterns
   */
  async glob(pattern: string | string[], options: GlobOptions = {}): Promise<string[]> {
    try {
      const patterns = Array.isArray(pattern) ? pattern : [pattern];
      
      const results = await glob(patterns, {
        cwd: options.cwd ? this.normalizePath(options.cwd) : process.cwd(),
        absolute: options.absolute ?? false,
        onlyFiles: options.onlyFiles ?? true,
        onlyDirectories: options.onlyDirectories ?? false,
        ignore: options.ignore || [],
        dot: options.dot ?? false,
        followSymbolicLinks: false,
        throwErrorOnBrokenSymbolicLink: false
      });
      
      consola.debug(`Glob found ${results.length} matches for: ${patterns.join(', ')}`);
      this.emit('globComplete', { patterns, count: results.length });
      
      return results;
    } catch (error) {
      this.handleFileError('glob', Array.isArray(pattern) ? pattern.join(', ') : pattern, error);
      throw error;
    }
  }

  /**
   * Watch file or directory for changes
   */
  watchPath(path: string, callback: (event: string, filename: string | null) => void): () => void {
    const { watch } = require('node:fs');
    const absolutePath = this.normalizePath(path);
    
    const watcher = watch(absolutePath, { recursive: true }, callback);
    
    consola.debug(`Watching path: ${absolutePath}`);
    this.emit('watchStarted', { path: absolutePath });
    
    return () => {
      watcher.close();
      consola.debug(`Stopped watching: ${absolutePath}`);
      this.emit('watchStopped', { path: absolutePath });
    };
  }

  /**
   * Get file hash
   */
  async getFileHash(filePath: string, algorithm = 'sha256'): Promise<string> {
    const content = await readFile(this.normalizePath(filePath));
    return createHash(algorithm).update(content).digest('hex');
  }

  /**
   * Create backup of file
   */
  async createBackup(filePath: string): Promise<string> {
    const absolutePath = this.normalizePath(filePath);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = `${absolutePath}.backup.${timestamp}`;
    
    await copyFile(absolutePath, backupPath);
    consola.debug(`Created backup: ${backupPath}`);
    
    return backupPath;
  }

  /**
   * Validate file access permissions
   */
  private async validateFileAccess(filePath: string, mode: number): Promise<void> {
    try {
      await access(filePath, mode);
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        throw new Error(`File not found: ${filePath}`);
      } else if (error.code === 'EACCES') {
        throw new Error(`Permission denied: ${filePath}`);
      }
      throw error;
    }
  }

  /**
   * Normalize path for cross-platform compatibility
   */
  private normalizePath(path: string): string {
    if (!path) {
      throw new Error('Path cannot be empty');
    }

    // Handle home directory expansion
    if (path.startsWith('~/')) {
      const homeDir = process.env.HOME || process.env.USERPROFILE;
      if (!homeDir) {
        throw new Error('Home directory not found');
      }
      path = join(homeDir, path.slice(2));
    }

    // Resolve to absolute path
    const absolutePath = isAbsolute(path) ? path : resolve(path);
    
    // Normalize separators and resolve .. and . segments
    return normalize(absolutePath);
  }

  /**
   * Handle file system errors with context
   */
  private handleFileError(operation: string, path: string, error: any): void {
    const errorMessage = `${operation} failed for "${path}": ${error.message}`;
    
    consola.error(errorMessage);
    this.emit('error', {
      operation,
      path,
      error,
      message: errorMessage
    });
  }

  /**
   * Setup cleanup handlers
   */
  private setupCleanupHandlers(): void {
    // Clean up watchers and temporary files on process exit
    const cleanup = () => {
      this.emit('cleanup');
    };

    process.on('exit', cleanup);
    process.on('SIGINT', cleanup);
    process.on('SIGTERM', cleanup);
    process.on('uncaughtException', cleanup);
  }

  /**
   * Get system information
   */
  getSystemInfo(): {
    platform: string;
    separator: string;
    cwd: string;
    homeDir: string | undefined;
    tempDir: string;
  } {
    return {
      platform: this.platform,
      separator: sep,
      cwd: process.cwd(),
      homeDir: process.env.HOME || process.env.USERPROFILE,
      tempDir: process.env.TMPDIR || process.env.TEMP || '/tmp'
    };
  }

  /**
   * Check if path is safe (not outside allowed directories)
   */
  isSafePath(path: string, allowedRoots: string[] = [process.cwd()]): boolean {
    const absolutePath = this.normalizePath(path);
    
    return allowedRoots.some(root => {
      const absoluteRoot = this.normalizePath(root);
      const relativePath = relative(absoluteRoot, absolutePath);
      return !relativePath.startsWith('..') && !isAbsolute(relativePath);
    });
  }

  /**
   * Create temp file
   */
  async createTempFile(prefix = 'citty', suffix = '.tmp'): Promise<string> {
    const tempDir = this.getSystemInfo().tempDir;
    const fileName = `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}${suffix}`;
    const tempPath = join(tempDir, fileName);
    
    // Create empty file
    await writeFile(tempPath, '', 'utf8');
    
    consola.debug(`Created temp file: ${tempPath}`);
    return tempPath;
  }

  /**
   * Clean up temp files
   */
  async cleanupTempFiles(pattern = 'citty-*'): Promise<void> {
    const tempDir = this.getSystemInfo().tempDir;
    const tempFiles = await this.glob(pattern, { 
      cwd: tempDir,
      absolute: true 
    });
    
    let cleaned = 0;
    for (const file of tempFiles) {
      try {
        await this.remove(file);
        cleaned++;
      } catch (error) {
        consola.warn(`Failed to clean temp file: ${file}`, error);
      }
    }
    
    if (cleaned > 0) {
      consola.debug(`Cleaned up ${cleaned} temp files`);
    }
  }
}

// Export singleton instance
export const fileSystemManager = new FileSystemManager();
export default fileSystemManager;