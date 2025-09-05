import { EventEmitter } from 'events';
import { watch, FSWatcher } from 'chokidar';
import { debounce } from 'lodash-es';
import { PipelineConfig } from '../types.js';

export class WatchService extends EventEmitter {
  private watchers: Map<string, FSWatcher>;
  private debouncedHandlers: Map<string, (...args: any[]) => void>;

  constructor() {
    super();
    this.watchers = new Map();
    this.debouncedHandlers = new Map();
  }

  async watch(config: PipelineConfig): Promise<void> {
    if (!config.watch?.enabled) {
      throw new Error('Watch service is disabled in configuration');
    }

    const debounceMs = config.watch.debounce || 500;
    const ignorePatterns = config.watch.ignore || [
      'node_modules/**',
      '.git/**',
      '**/*.log',
      '**/.*',
    ];

    // Watch ontology files
    for (const ontology of config.ontologies) {
      await this.watchPath(
        `ontology:${ontology.path}`,
        ontology.path,
        debounceMs,
        ignorePatterns
      );
    }

    // Watch template files
    for (const template of config.templates) {
      await this.watchPath(
        `template:${template.path}`,
        template.path,
        debounceMs,
        ignorePatterns
      );
    }

    this.emit('watch:started', {
      ontologies: config.ontologies.length,
      templates: config.templates.length,
    });
  }

  private async watchPath(
    id: string,
    path: string,
    debounceMs: number,
    ignorePatterns: string[]
  ): Promise<void> {
    // Create debounced handler
    const handler = debounce((eventPath: string, stats?: any) => {
      this.emit('change', eventPath, {
        id,
        type: id.split(':')[0],
        stats,
      });
    }, debounceMs);

    this.debouncedHandlers.set(id, handler);

    // Create file watcher
    const watcher = watch(path, {
      ignored: ignorePatterns,
      persistent: true,
      ignoreInitial: true,
      followSymlinks: false,
    });

    watcher.on('change', handler);
    watcher.on('add', handler);
    watcher.on('unlink', (filePath) => {
      this.emit('delete', filePath, { id, type: id.split(':')[0] });
    });

    watcher.on('error', (error) => {
      this.emit('error', error, { id, path });
    });

    this.watchers.set(id, watcher);
  }

  async stop(): Promise<void> {
    const promises: Promise<void>[] = [];

    for (const [id, watcher] of this.watchers) {
      promises.push(
        new Promise((resolve) => {
          watcher.close().then(() => {
            this.watchers.delete(id);
            this.debouncedHandlers.delete(id);
            resolve();
          });
        })
      );
    }

    await Promise.all(promises);
    this.emit('watch:stopped');
  }

  isWatching(): boolean {
    return this.watchers.size > 0;
  }

  getWatchedPaths(): string[] {
    return Array.from(this.watchers.keys());
  }
}