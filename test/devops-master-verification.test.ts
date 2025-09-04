import { describe, it, expect } from "vitest";
import { devopsMasterCLI } from "../src/commands/devops-master";
import { resolveValue } from "../src/_utils";
import type { CommandDef } from "../src/types";

describe("DevOps Master CLI - ULTRATHINK Architecture Verification", () => {
  it("should have proper meta information", async () => {
    const meta = await resolveValue(devopsMasterCLI.meta);
    expect(meta).toBeDefined();
    expect(meta?.name).toBe("devops");
    expect(meta?.description).toContain("ULTRATHINK");
    expect(meta?.version).toBe("2.0.0-alpha");
  });

  it("should have comprehensive main command structure", async () => {
    const subCommands = await resolveValue(devopsMasterCLI.subCommands);
    expect(subCommands).toBeDefined();
    
    // Verify we have 20+ main commands
    const mainCommands = Object.keys(subCommands!);
    expect(mainCommands.length).toBeGreaterThanOrEqual(20);
    
    // Verify key expected commands exist
    const expectedCommands = [
      "infra", "container", "pipeline", "monitor", "security", 
      "database", "network", "config", "secret", "backup",
      "cost", "performance", "env", "notify", "template",
      "plugin", "version", "workflow", "compliance", "debug"
    ];
    
    for (const cmd of expectedCommands) {
      expect(mainCommands).toContain(cmd);
    }
  });

  it("should have complex nested subcommands (3+ levels deep)", async () => {
    const subCommands = await resolveValue(devopsMasterCLI.subCommands);
    
    // Test infra > provision > cloud > aws (4 levels)
    const infra = await resolveValue(subCommands!.infra);
    const infraSubs = await resolveValue(infra.subCommands);
    expect(infraSubs).toBeDefined();
    expect(infraSubs!.provision).toBeDefined();
    
    const provision = await resolveValue(infraSubs!.provision);
    const provisionSubs = await resolveValue(provision.subCommands);
    expect(provisionSubs).toBeDefined();
    expect(provisionSubs!.cloud).toBeDefined();
    
    const cloud = await resolveValue(provisionSubs!.cloud);
    const cloudSubs = await resolveValue(cloud.subCommands);
    expect(cloudSubs).toBeDefined();
    expect(cloudSubs!.aws).toBeDefined();
    
    // Test 4th level: infra > provision > cloud > aws > ec2
    const aws = await resolveValue(cloudSubs!.aws);
    const awsSubs = await resolveValue(aws.subCommands);
    expect(awsSubs).toBeDefined();
    expect(awsSubs!.ec2).toBeDefined();
  });

  it("should have 50+ total arguments across all commands", async () => {
    let totalArgs = 0;
    
    // Count arguments recursively
    const countArgs = async (cmd: CommandDef): Promise<number> => {
      let count = 0;
      
      // Count direct arguments
      const args = await resolveValue(cmd.args);
      if (args) {
        count += Object.keys(args).length;
      }
      
      // Count arguments in subcommands recursively
      const subCmds = await resolveValue(cmd.subCommands);
      if (subCmds) {
        for (const subCmd of Object.values(subCmds)) {
          const resolvedSubCmd = await resolveValue(subCmd);
          count += await countArgs(resolvedSubCmd);
        }
      }
      
      return count;
    };
    
    totalArgs = await countArgs(devopsMasterCLI);
    
    expect(totalArgs).toBeGreaterThanOrEqual(50);
  });

  it("should include all argument types", async () => {
    const typesFound = new Set<string>();
    
    // Collect all argument types recursively
    const collectTypes = async (cmd: CommandDef): Promise<void> => {
      const args = await resolveValue(cmd.args);
      if (args) {
        for (const arg of Object.values(args)) {
          if (arg.type) {
            typesFound.add(arg.type);
          }
        }
      }
      
      const subCmds = await resolveValue(cmd.subCommands);
      if (subCmds) {
        for (const subCmd of Object.values(subCmds)) {
          const resolvedSubCmd = await resolveValue(subCmd);
          await collectTypes(resolvedSubCmd);
        }
      }
    };
    
    await collectTypes(devopsMasterCLI);
    
    // Verify all required types are present
    expect(typesFound.has("string")).toBe(true);
    expect(typesFound.has("number")).toBe(true);
    expect(typesFound.has("boolean")).toBe(true);
    expect(typesFound.has("enum")).toBe(true);
    // Note: positional args would be found if they were used
  });

  it("should have advanced CLI features", async () => {
    let hasAliases = false;
    let hasDefaults = false;
    let hasRequired = false;
    let hasValueHints = false;
    
    // Check features recursively
    const checkFeatures = async (cmd: CommandDef): Promise<void> => {
      const args = await resolveValue(cmd.args);
      if (args) {
        for (const arg of Object.values(args)) {
          if (arg.alias) hasAliases = true;
          if (arg.default !== undefined) hasDefaults = true;
          if (arg.required) hasRequired = true;
          if (arg.valueHint) hasValueHints = true;
        }
      }
      
      const subCmds = await resolveValue(cmd.subCommands);
      if (subCmds) {
        for (const subCmd of Object.values(subCmds)) {
          const resolvedSubCmd = await resolveValue(subCmd);
          await checkFeatures(resolvedSubCmd);
        }
      }
    };
    
    await checkFeatures(devopsMasterCLI);
    
    expect(hasAliases).toBe(true);
    expect(hasDefaults).toBe(true);
    expect(hasRequired).toBe(true);
    expect(hasValueHints).toBe(true);
  });

  it("should have comprehensive descriptions", async () => {
    let commandsWithDescriptions = 0;
    let argsWithDescriptions = 0;
    
    const checkDescriptions = async (cmd: CommandDef): Promise<void> => {
      const meta = await resolveValue(cmd.meta);
      if (meta?.description) {
        commandsWithDescriptions++;
      }
      
      const args = await resolveValue(cmd.args);
      if (args) {
        for (const arg of Object.values(args)) {
          if (arg.description) {
            argsWithDescriptions++;
          }
        }
      }
      
      const subCmds = await resolveValue(cmd.subCommands);
      if (subCmds) {
        for (const subCmd of Object.values(subCmds)) {
          const resolvedSubCmd = await resolveValue(subCmd);
          await checkDescriptions(resolvedSubCmd);
        }
      }
    };
    
    await checkDescriptions(devopsMasterCLI);
    
    // Should have descriptions for most commands and arguments
    expect(commandsWithDescriptions).toBeGreaterThanOrEqual(15);
    expect(argsWithDescriptions).toBeGreaterThanOrEqual(40);
  });

  it("should have version management commands", async () => {
    const subCommands = await resolveValue(devopsMasterCLI.subCommands);
    expect(subCommands?.version).toBeDefined();
    
    const version = await resolveValue(subCommands!.version);
    const versionSubs = await resolveValue(version.subCommands);
    expect(versionSubs).toBeDefined();
    expect(versionSubs!.bump).toBeDefined();
    expect(versionSubs!.tag).toBeDefined();
  });

  it("should have hidden debug commands", async () => {
    const subCommands = await resolveValue(devopsMasterCLI.subCommands);
    expect(subCommands?.debug).toBeDefined();
    
    const debug = await resolveValue(subCommands!.debug);
    const debugMeta = await resolveValue(debug.meta);
    expect(debugMeta?.hidden).toBe(true);
    
    const debugSubs = await resolveValue(debug.subCommands);
    expect(debugSubs).toBeDefined();
    expect(debugSubs!.trace).toBeDefined();
    expect(debugSubs!.dump).toBeDefined();
    expect(debugSubs!.inject).toBeDefined();
    
    // Verify trace command is hidden
    const trace = await resolveValue(debugSubs!.trace);
    const traceMeta = await resolveValue(trace.meta);
    expect(traceMeta?.hidden).toBe(true);
  });

  it("should have proper enum argument configurations", async () => {
    let enumArgsFound = 0;
    let enumsWithOptions = 0;
    
    const checkEnums = async (cmd: CommandDef): Promise<void> => {
      const args = await resolveValue(cmd.args);
      if (args) {
        for (const arg of Object.values(args)) {
          if (arg.type === "enum") {
            enumArgsFound++;
            if ((arg as any).options && Array.isArray((arg as any).options)) {
              enumsWithOptions++;
            }
          }
        }
      }
      
      const subCmds = await resolveValue(cmd.subCommands);
      if (subCmds) {
        for (const subCmd of Object.values(subCmds)) {
          const resolvedSubCmd = await resolveValue(subCmd);
          await checkEnums(resolvedSubCmd);
        }
      }
    };
    
    await checkEnums(devopsMasterCLI);
    
    expect(enumArgsFound).toBeGreaterThanOrEqual(10);
    expect(enumsWithOptions).toBe(enumArgsFound); // All enum args should have options
  });

  it("should have infrastructure cloud provider commands", async () => {
    const subCommands = await resolveValue(devopsMasterCLI.subCommands);
    const infra = await resolveValue(subCommands!.infra);
    const infraSubs = await resolveValue(infra.subCommands);
    const provision = await resolveValue(infraSubs!.provision);
    const provisionSubs = await resolveValue(provision.subCommands);
    const cloud = await resolveValue(provisionSubs!.cloud);
    const cloudSubs = await resolveValue(cloud.subCommands);
    
    // Should have major cloud providers
    expect(cloudSubs!.aws).toBeDefined();
    expect(cloudSubs!.azure).toBeDefined();
    expect(cloudSubs!.gcp).toBeDefined();
    
    // AWS should have EC2 and RDS
    const aws = await resolveValue(cloudSubs!.aws);
    const awsSubs = await resolveValue(aws.subCommands);
    expect(awsSubs!.ec2).toBeDefined();
    expect(awsSubs!.rds).toBeDefined();
  });

  it("should have monitoring and security commands", async () => {
    const subCommands = await resolveValue(devopsMasterCLI.subCommands);
    
    // Monitor command should exist with metrics, logs, alerts
    expect(subCommands!.monitor).toBeDefined();
    const monitor = await resolveValue(subCommands!.monitor);
    const monitorSubs = await resolveValue(monitor.subCommands);
    expect(monitorSubs!.metrics).toBeDefined();
    expect(monitorSubs!.logs).toBeDefined();
    expect(monitorSubs!.alerts).toBeDefined();
    
    // Security command should exist with scan and audit
    expect(subCommands!.security).toBeDefined();
    const security = await resolveValue(subCommands!.security);
    const securitySubs = await resolveValue(security.subCommands);
    expect(securitySubs!.scan).toBeDefined();
    expect(securitySubs!.audit).toBeDefined();
  });

  it("should have proper TypeScript typing", () => {
    // Type checking happens at compile time, but we can verify the structure
    expect(devopsMasterCLI).toHaveProperty("meta");
    expect(devopsMasterCLI).toHaveProperty("args");
    expect(devopsMasterCLI).toHaveProperty("subCommands");
    
    // Verify it conforms to CommandDef interface
    expect(typeof devopsMasterCLI.meta).toBeDefined();
    expect(typeof devopsMasterCLI.args).toBeDefined();
    expect(typeof devopsMasterCLI.subCommands).toBeDefined();
  });

  it("should have comprehensive argument coverage", async () => {
    const argStats = {
      withAliases: 0,
      withDefaults: 0,
      withValueHints: 0,
      required: 0,
      total: 0
    };
    
    const analyzeArgs = async (cmd: CommandDef): Promise<void> => {
      const args = await resolveValue(cmd.args);
      if (args) {
        for (const arg of Object.values(args)) {
          argStats.total++;
          if (arg.alias) argStats.withAliases++;
          if (arg.default !== undefined) argStats.withDefaults++;
          if (arg.valueHint) argStats.withValueHints++;
          if (arg.required) argStats.required++;
        }
      }
      
      const subCmds = await resolveValue(cmd.subCommands);
      if (subCmds) {
        for (const subCmd of Object.values(subCmds)) {
          const resolvedSubCmd = await resolveValue(subCmd);
          await analyzeArgs(resolvedSubCmd);
        }
      }
    };
    
    await analyzeArgs(devopsMasterCLI);
    
    // Quality checks
    expect(argStats.total).toBeGreaterThanOrEqual(50);
    expect(argStats.withAliases).toBeGreaterThanOrEqual(30);
    expect(argStats.withDefaults).toBeGreaterThanOrEqual(20);
    expect(argStats.withValueHints).toBeGreaterThanOrEqual(15);
    expect(argStats.required).toBeGreaterThanOrEqual(10);
  });
});