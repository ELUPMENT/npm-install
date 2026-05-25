import { ConfigManager, createDefaultConfig, validateConfigPath } from '../config';
import { FileUtils } from '../utils/file-utils';
import path from 'path';
import fs from 'fs';

describe('ConfigManager', () => {
  const testConfigPath = path.join(__dirname, '..', '..', 'test-config.json');
  let configManager: ConfigManager;

  beforeEach(() => {
    // Clean up test config file if it exists
    if (fs.existsSync(testConfigPath)) {
      fs.unlinkSync(testConfigPath);
    }
    
    configManager = new ConfigManager(testConfigPath);
  });

  afterEach(() => {
    // Clean up test config file
    if (fs.existsSync(testConfigPath)) {
      fs.unlinkSync(testConfigPath);
    }
  });

  describe('constructor', () => {
    it('should create ConfigManager with default config when file does not exist', () => {
      expect(configManager).toBeDefined();
      
      const config = configManager.getConfig();
      expect(config.registryUrl).toBe('https://registry.npmjs.org');
      expect(config.timeoutMs).toBe(30000);
      expect(config.maxRetries).toBe(3);
      expect(config.backupPath).toBe('.backup');
      expect(config.cachePath).toBe('.cache');
      expect(config.logLevel).toBe('info');
      expect(config.enableCache).toBe(true);
      expect(config.enableBackup).toBe(true);
      expect(config.verifyIntegrity).toBe(true);
      expect(config.maxConcurrentDownloads).toBe(5);
      expect(config.blacklist).toEqual([]);
      expect(config.whitelist).toEqual([]);
    });

    it('should load existing config file', async () => {
      const existingConfig = {
        registryUrl: 'https://custom.registry.com',
        timeoutMs: 10000,
        logLevel: 'debug' as const
      };
      
      await FileUtils.writeJsonFile(testConfigPath, existingConfig);
      
      const manager = new ConfigManager(testConfigPath);
      const config = manager.getConfig();
      
      expect(config.registryUrl).toBe('https://custom.registry.com');
      expect(config.timeoutMs).toBe(10000);
      expect(config.logLevel).toBe('debug');
      // Other values should be defaults
      expect(config.maxRetries).toBe(3);
      expect(config.enableCache).toBe(true);
    });
  });

  describe('saveConfig', () => {
    it('should save config to file', async () => {
      const updates = {
        registryUrl: 'https://test.registry.com',
        timeoutMs: 5000,
        logLevel: 'error' as const
      };
      
      configManager.saveConfig(updates);
      
      expect(fs.existsSync(testConfigPath)).toBe(true);
      
      const savedConfig = JSON.parse(fs.readFileSync(testConfigPath, 'utf-8'));
      expect(savedConfig.registryUrl).toBe('https://test.registry.com');
      expect(savedConfig.timeoutMs).toBe(5000);
      expect(savedConfig.logLevel).toBe('error');
    });

    it('should merge updates with existing config', () => {
      const initialConfig = configManager.getConfig();
      expect(initialConfig.registryUrl).toBe('https://registry.npmjs.org');
      expect(initialConfig.timeoutMs).toBe(30000);
      
      configManager.saveConfig({ timeoutMs: 15000 });
      
      const updatedConfig = configManager.getConfig();
      expect(updatedConfig.registryUrl).toBe('https://registry.npmjs.org'); // unchanged
      expect(updatedConfig.timeoutMs).toBe(15000); // updated
      expect(updatedConfig.maxRetries).toBe(3); // default unchanged
    });
  });

  describe('updateConfig', () => {
    it('should update config and save to file', () => {
      expect(fs.existsSync(testConfigPath)).toBe(false);
      
      configManager.updateConfig({ timeoutMs: 20000, maxRetries: 5 });
      
      const config = configManager.getConfig();
      expect(config.timeoutMs).toBe(20000);
      expect(config.maxRetries).toBe(5);
      
      expect(fs.existsSync(testConfigPath)).toBe(true);
      
      const savedConfig = JSON.parse(fs.readFileSync(testConfigPath, 'utf-8'));
      expect(savedConfig.timeoutMs).toBe(20000);
      expect(savedConfig.maxRetries).toBe(5);
    });
  });

  describe('validateConfig', () => {
    it('should return empty array for valid config', () => {
      const errors = configManager.validateConfig();
      expect(errors).toEqual([]);
    });

    it('should detect invalid registryUrl', () => {
      configManager.updateConfig({ registryUrl: 'invalid-url' });
      const errors = configManager.validateConfig();
      expect(errors).toContain('registryUrl must be a valid URL starting with http or https');
    });

    it('should detect invalid timeoutMs', () => {
      configManager.updateConfig({ timeoutMs: 500 });
      const errors = configManager.validateConfig();
      expect(errors).toContain('timeoutMs must be at least 1000ms');
    });

    it('should detect invalid maxRetries', () => {
      configManager.updateConfig({ maxRetries: -1 });
      const errors = configManager.validateConfig();
      expect(errors).toContain('maxRetries must be non-negative');
    });

    it('should detect invalid maxConcurrentDownloads', () => {
      configManager.updateConfig({ maxConcurrentDownloads: 0 });
      const errors = configManager.validateConfig();
      expect(errors).toContain('maxConcurrentDownloads must be at least 1');
    });

    it('should detect invalid logLevel', () => {
      configManager.updateConfig({ logLevel: 'invalid' as any });
      const errors = configManager.validateConfig();
      expect(errors).toContain('logLevel must be one of: debug, info, warn, error');
    });

    it('should return multiple errors for multiple invalid fields', () => {
      configManager.updateConfig({
        registryUrl: 'invalid',
        timeoutMs: 500,
        maxRetries: -1,
        logLevel: 'invalid' as any
      });
      
      const errors = configManager.validateConfig();
      expect(errors).toHaveLength(4);
      expect(errors).toContain('registryUrl must be a valid URL starting with http or https');
      expect(errors).toContain('timeoutMs must be at least 1000ms');
      expect(errors).toContain('maxRetries must be non-negative');
      expect(errors).toContain('logLevel must be one of: debug, info, warn, error');
    });
  });

  describe('getBackupPath and getCachePath', () => {
    it('should generate safe backup path', () => {
      const packageName = 'test-package';
      const version = '1.0.0';
      const backupPath = configManager.getBackupPath(packageName, version);
      
      expect(backupPath).toContain('.backup');
      expect(backupPath).toContain('test-package@1.0.0');
      expect(backupPath).toMatch(/_\d+$/); // ends with timestamp
    });

    it('should sanitize special characters in package name', () => {
      const packageName = '@scope/test-package@v1';
      const version = '2.0.0-beta.1';
      const backupPath = configManager.getBackupPath(packageName, version);
      
      expect(backupPath).toContain('_scope_test-package_v1@2.0.0-beta_1');
      expect(backupPath).not.toContain('@');
      expect(backupPath).not.toContain('.');
    });

    it('should generate cache path', () => {
      const packageName = 'test-package';
      const version = '1.0.0';
      const cachePath = configManager.getCachePath(packageName, version);
      
      expect(cachePath).toContain('.cache');
      expect(cachePath).toContain('test-package@1.0.0');
      expect(cachePath).not.toMatch(/_\d+$/); // no timestamp
    });
  });

  describe('shouldProcessPackage', () => {
    it('should process all packages when no whitelist or blacklist', () => {
      expect(configManager.shouldProcessPackage('package1')).toBe(true);
      expect(configManager.shouldProcessPackage('package2')).toBe(true);
      expect(configManager.shouldProcessPackage('package3')).toBe(true);
    });

    it('should only process packages in whitelist', () => {
      configManager.updateConfig({ whitelist: ['package1', 'package2'] });
      
      expect(configManager.shouldProcessPackage('package1')).toBe(true);
      expect(configManager.shouldProcessPackage('package2')).toBe(true);
      expect(configManager.shouldProcessPackage('package3')).toBe(false);
    });

    it('should exclude packages in blacklist', () => {
      configManager.updateConfig({ blacklist: ['package3'] });
      
      expect(configManager.shouldProcessPackage('package1')).toBe(true);
      expect(configManager.shouldProcessPackage('package2')).toBe(true);
      expect(configManager.shouldProcessPackage('package3')).toBe(false);
    });

    it('should prioritize whitelist over blacklist', () => {
      configManager.updateConfig({
        whitelist: ['package1'],
        blacklist: ['package1', 'package2', 'package3']
      });
      
      expect(configManager.shouldProcessPackage('package1')).toBe(true); // in whitelist
      expect(configManager.shouldProcessPackage('package2')).toBe(false); // not in whitelist, in blacklist
      expect(configManager.shouldProcessPackage('package4')).toBe(false); // not in whitelist
    });
  });

  describe('resetToDefaults', () => {
    it('should reset config to defaults', () => {
      configManager.updateConfig({
        registryUrl: 'https://custom.registry.com',
        timeoutMs: 10000,
        logLevel: 'debug' as const
      });
      
      let config = configManager.getConfig();
      expect(config.registryUrl).toBe('https://custom.registry.com');
      expect(config.timeoutMs).toBe(10000);
      expect(config.logLevel).toBe('debug');
      
      configManager.resetToDefaults();
      
      config = configManager.getConfig();
      expect(config.registryUrl).toBe('https://registry.npmjs.org');
      expect(config.timeoutMs).toBe(30000);
      expect(config.logLevel).toBe('info');
    });
  });
});

describe('createDefaultConfig', () => {
  it('should create default config object', () => {
    const defaultConfig = createDefaultConfig();
    
    expect(defaultConfig).toEqual({
      registryUrl: 'https://registry.npmjs.org',
      timeoutMs: 30000,
      maxRetries: 3,
      backupPath: '.backup',
      cachePath: '.cache',
      logLevel: 'info',
      enableCache: true,
      enableBackup: true,
      verifyIntegrity: true,
      maxConcurrentDownloads: 5,
      blacklist: [],
      whitelist: []
    });
  });
});

describe('validateConfigPath', () => {
  const testDir = path.join(__dirname, '..', '..', 'test-dir');
  const testConfigPath = path.join(testDir, 'config.json');

  afterAll(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  it('should create directory and return true for valid path', () => {
    expect(fs.existsSync(testDir)).toBe(false);
    
    const result = validateConfigPath(testConfigPath);
    
    expect(result).toBe(true);
    expect(fs.existsSync(testDir)).toBe(true);
  });

  it('should handle invalid paths gracefully', () => {
    const invalidPath = '/invalid/path/with/special/chars/\\/*?:"<>|/config.json';
    const result = validateConfigPath(invalidPath);
    
    expect(result).toBe(false);
  });
});