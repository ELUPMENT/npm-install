import { ConfigManager } from '../config';
import { Logger } from '../utils/logger';

// Mock configuration for tests
const testConfig = {
  registryUrl: 'https://registry.npmjs.org',
  timeoutMs: 5000,
  maxRetries: 1,
  backupPath: '.test-backup',
  cachePath: '.test-cache',
  logLevel: 'error' as const,
  enableCache: false,
  enableBackup: false,
  verifyIntegrity: false,
  maxConcurrentDownloads: 1,
  blacklist: [],
  whitelist: []
};

// Setup test environment before each test
beforeAll(() => {
  // Create test directories
  const fs = require('fs');
  const path = require('path');
  
  const testDirs = ['.test-backup', '.test-cache', 'test-packages'];
  testDirs.forEach(dir => {
    const dirPath = path.join(__dirname, '..', '..', dir);
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
  });

  // Setup test logger
  Logger.prototype.log = jest.fn();
});

afterAll(() => {
  // Cleanup test directories
  const fs = require('fs');
  const path = require('path');
  
  const testDirs = ['.test-backup', '.test-cache', 'test-packages'];
  testDirs.forEach(dir => {
    const dirPath = path.join(__dirname, '..', '..', dir);
    if (fs.existsSync(dirPath)) {
      fs.rmSync(dirPath, { recursive: true, force: true });
    }
  });
});

// Test utilities
export function createTestPackage(name: string, version: string, files: Record<string, string> = {}): string {
  const fs = require('fs');
  const path = require('path');
  
  const packageDir = path.join(__dirname, '..', '..', 'test-packages', `${name}@${version}`);
  
  if (fs.existsSync(packageDir)) {
    fs.rmSync(packageDir, { recursive: true, force: true });
  }
  
  fs.mkdirSync(packageDir, { recursive: true });
  
  // Create package.json
  const packageJson = {
    name,
    version,
    description: `Test package ${name}`,
    main: 'index.js',
    license: 'MIT',
    files: Object.keys(files),
    dependencies: {},
    devDependencies: {}
  };
  
  fs.writeFileSync(
    path.join(packageDir, 'package.json'),
    JSON.stringify(packageJson, null, 2)
  );
  
  // Create other files
  Object.entries(files).forEach(([filePath, content]) => {
    const fullPath = path.join(packageDir, filePath);
    const dir = path.dirname(fullPath);
    
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    fs.writeFileSync(fullPath, content);
  });
  
  return packageDir;
}

export function cleanupTestPackage(packageDir: string): void {
  const fs = require('fs');
  
  if (fs.existsSync(packageDir)) {
    fs.rmSync(packageDir, { recursive: true, force: true });
  }
}

export function mockNpmRegistry(response: any = {}): void {
  const axios = require('axios');
  
  jest.spyOn(axios, 'get').mockImplementation(async (url: string) => {
    if (url.includes('registry.npmjs.org')) {
      return {
        status: 200,
        data: {
          name: 'test-package',
          version: '1.0.0',
          description: 'Test package',
          license: 'MIT',
          homepage: 'https://example.com',
          repository: { type: 'git', url: 'https://github.com/test/test-package.git' },
          bugs: { url: 'https://github.com/test/test-package/issues' },
          dist: {
            integrity: 'sha256-test',
            shasum: 'testshasum',
            tarball: 'https://registry.npmjs.org/test-package/-/test-package-1.0.0.tgz',
            fileCount: 10,
            unpackedSize: 1024
          },
          dependencies: {},
          devDependencies: {},
          files: ['package.json', 'README.md', 'LICENSE', 'index.js'],
          main: 'index.js',
          ...response
        }
      };
    }
    
    return { status: 404, data: {} };
  });
}

export function restoreNpmRegistry(): void {
  const axios = require('axios');
  
  if (axios.get.mockRestore) {
    axios.get.mockRestore();
  }
}

export function createMockConfigManager(): ConfigManager {
  const configManager = new ConfigManager();
  configManager.updateConfig(testConfig);
  return configManager;
}

export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}