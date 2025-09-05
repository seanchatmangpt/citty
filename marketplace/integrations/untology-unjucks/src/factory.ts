import { PipelineCoordinator } from './pipeline/coordinator.js';
import { ConfigManager } from './config/config-manager.js';
import { WatchService } from './services/watch-service.js';
import { ValidationService } from './services/validation-service.js';
import { GitHubIntegration } from './integrations/github-integration.js';
import { PipelineConfig } from './types.js';

export interface PipelineFactory {
  coordinator: PipelineCoordinator;
  configManager: ConfigManager;
  watchService: WatchService;
  validator: ValidationService;
  github: GitHubIntegration;
}

export function createPipeline(options: {
  enableHiveQueen?: boolean;
  maxWorkers?: number;
  cacheDirectory?: string;
  monitoringEnabled?: boolean;
} = {}): PipelineFactory {
  const {
    enableHiveQueen = true,
    maxWorkers = 8,
    cacheDirectory = './.unjucks-cache',
    monitoringEnabled = true,
  } = options;

  // Create and configure pipeline coordinator
  const coordinator = new PipelineCoordinator();

  // Configure services
  const configManager = new ConfigManager();
  const watchService = new WatchService();
  const validator = new ValidationService();
  const github = new GitHubIntegration();

  return {
    coordinator,
    configManager,
    watchService,
    validator,
    github,
  };
}

// Convenience functions for common workflows
export async function createStandardPipeline(configPath: string): Promise<{
  pipeline: PipelineFactory;
  config: PipelineConfig;
}> {
  const pipeline = createPipeline();
  const config = await pipeline.configManager.loadConfig(configPath);
  
  return { pipeline, config };
}

export async function runOneShotGeneration(
  configPath: string,
  overrides?: Partial<PipelineConfig>
): Promise<void> {
  const { pipeline, config } = await createStandardPipeline(configPath);
  
  const finalConfig = overrides 
    ? await pipeline.configManager.mergeConfigs(config, overrides)
    : config;
  
  const job = await pipeline.coordinator.executeJob(finalConfig);
  
  if (job.status === 'failed') {
    throw new Error(`Pipeline failed: ${job.metrics.errors.join(', ')}`);
  }
}

export async function startWatchMode(
  configPath: string,
  overrides?: Partial<PipelineConfig>
): Promise<{ 
  pipeline: PipelineFactory; 
  config: PipelineConfig; 
  stop: () => Promise<void> 
}> {
  const { pipeline, config } = await createStandardPipeline(configPath);
  
  const finalConfig = overrides 
    ? await pipeline.configManager.mergeConfigs(config, overrides)
    : config;
  
  // Enable watching if not already enabled
  finalConfig.watch = finalConfig.watch || { enabled: true };
  finalConfig.watch.enabled = true;
  
  // Set up change handler
  pipeline.watchService.on('change', async (filePath) => {
    console.log(`Detected change: ${filePath}`);
    
    try {
      const job = await pipeline.coordinator.executeJob(finalConfig);
      console.log(`Regenerated ${job.metrics.filesGenerated} files`);
    } catch (error) {
      console.error('Regeneration failed:', error);
    }
  });
  
  // Start watching
  await pipeline.watchService.watch(finalConfig);
  
  const stop = async () => {
    await pipeline.watchService.stop();
    await pipeline.coordinator.cleanup();
  };
  
  return { pipeline, config: finalConfig, stop };
}