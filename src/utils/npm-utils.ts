import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { NetworkError, PackageNotFoundError, TimeoutError } from '../errors/errors';
import { FileUtils } from './file-utils';

export interface NpmPackageInfo {
  name: string;
  version: string;
  description: string;
  license: string;
  homepage: string;
  repository: {
    type: string;
    url: string;
  };
  bugs: {
    url: string;
  };
  dist: {
    integrity: string;
    shasum: string;
    tarball: string;
    fileCount: number;
    unpackedSize: number;
  };
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
  files: string[];
  main?: string;
  types?: string;
  module?: string;
  bin?: Record<string, string>;
}

export interface NpmRegistryConfig {
  registryUrl: string;
  timeout: number;
  maxRetries: number;
}

export class NpmUtils {
  private config: NpmRegistryConfig;

  constructor(config: Partial<NpmRegistryConfig> = {}) {
    this.config = {
      registryUrl: config.registryUrl || 'https://registry.npmjs.org',
      timeout: config.timeout || 30000,
      maxRetries: config.maxRetries || 3
    };
  }

  async getPackageInfo(packageName: string, version: string = 'latest'): Promise<NpmPackageInfo> {
    const url = `${this.config.registryUrl}/${packageName}/${version}`;

    for (let attempt = 1; attempt <= this.config.maxRetries; attempt++) {
      try {
        const response = await axios.get(url, {
          timeout: this.config.timeout,
          headers: {
            'Accept': 'application/vnd.npm.install-v1+json'
          }
        });

        if (response.status === 200) {
          return this.normalizePackageInfo(response.data);
        }

        if (response.status === 404) {
          throw new PackageNotFoundError(`Package ${packageName}@${version} not found in registry`, packageName, version);
        }

        throw new NetworkError(`HTTP ${response.status} when fetching package info`, packageName, version);
      } catch (error) {
        if (attempt === this.config.maxRetries) {
          if (axios.isAxiosError(error)) {
            if (error.code === 'ETIMEDOUT' || error.code === 'ECONNABORTED') {
              throw new TimeoutError(`Timeout while fetching package info for ${packageName}@${version}`, packageName, version);
            }
            if (error.response?.status === 404) {
              throw new PackageNotFoundError(`Package ${packageName}@${version} not found in registry`, packageName, version);
            }
          }
          throw new NetworkError(`Failed to fetch package info after ${this.config.maxRetries} attempts: ${error}`, packageName, version);
        }
        await this.delay(1000 * attempt);
      }
    }

    throw new NetworkError(`Failed to fetch package info for ${packageName}@${version}`, packageName, version);
  }

  async downloadPackageTarball(packageName: string, version: string, targetDir: string): Promise<string> {
    const packageInfo = await this.getPackageInfo(packageName, version);
    const tarballUrl = packageInfo.dist.tarball;
    const tarballPath = path.join(targetDir, `${packageName}-${version}.tgz`);

    await FileUtils.ensureDirectoryExists(targetDir);

    for (let attempt = 1; attempt <= this.config.maxRetries; attempt++) {
      try {
        const response = await axios.get(tarballUrl, {
          timeout: this.config.timeout,
          responseType: 'arraybuffer'
        });

        if (response.status === 200) {
          await fs.promises.writeFile(tarballPath, response.data);
          
          const downloadedHash = await FileUtils.calculateFileHash(tarballPath, 'sha256');
          const expectedHash = packageInfo.dist.integrity.split('-')[1];
          
          if (downloadedHash !== expectedHash) {
            await fs.promises.unlink(tarballPath);
            throw new NetworkError(`Integrity check failed for ${packageName}@${version}`, packageName, version);
          }

          return tarballPath;
        }

        throw new NetworkError(`HTTP ${response.status} when downloading tarball`, packageName, version);
      } catch (error) {
        if (attempt === this.config.maxRetries) {
          if (axios.isAxiosError(error) && (error.code === 'ETIMEDOUT' || error.code === 'ECONNABORTED')) {
            throw new TimeoutError(`Timeout while downloading tarball for ${packageName}@${version}`, packageName, version);
          }
          throw new NetworkError(`Failed to download tarball after ${this.config.maxRetries} attempts: ${error}`, packageName, version);
        }
        await this.delay(1000 * attempt);
      }
    }

    throw new NetworkError(`Failed to download tarball for ${packageName}@${version}`, packageName, version);
  }

  async extractTarball(tarballPath: string, targetDir: string): Promise<void> {
    const tar = require('tar');
    
    try {
      await FileUtils.ensureDirectoryExists(targetDir);
      await tar.extract({
        file: tarballPath,
        cwd: targetDir
      });
    } catch (error) {
      throw new NetworkError(`Failed to extract tarball ${tarballPath}: ${error}`);
    }
  }

  async getPackageFileList(packageName: string, version: string = 'latest'): Promise<string[]> {
    const packageInfo = await this.getPackageInfo(packageName, version);
    const expectedFiles: string[] = [];

    if (packageInfo.files && Array.isArray(packageInfo.files)) {
      expectedFiles.push(...packageInfo.files);
    }

    if (packageInfo.main) {
      expectedFiles.push(packageInfo.main);
    }

    if (packageInfo.types) {
      expectedFiles.push(packageInfo.types);
    }

    if (packageInfo.module) {
      expectedFiles.push(packageInfo.module);
    }

    if (packageInfo.bin) {
      Object.values(packageInfo.bin).forEach(binFile => {
        expectedFiles.push(binFile);
      });
    }

    const standardFiles = [
      'package.json',
      'README.md',
      'LICENSE',
      'LICENSE.md',
      'LICENSE.txt',
      'CHANGELOG.md',
      'CHANGELOG',
      'AUTHORS',
      'CONTRIBUTORS'
    ];

    standardFiles.forEach(file => {
      expectedFiles.push(file);
    });

    return Array.from(new Set(expectedFiles)).filter(Boolean);
  }

  async getPackageDependencies(packageName: string, version: string = 'latest'): Promise<Record<string, string>> {
    const packageInfo = await this.getPackageInfo(packageName, version);
    return packageInfo.dependencies || {};
  }

  async getPackageDevDependencies(packageName: string, version: string = 'latest'): Promise<Record<string, string>> {
    const packageInfo = await this.getPackageInfo(packageName, version);
    return packageInfo.devDependencies || {};
  }

  async verifyPackageIntegrity(packageDir: string, packageName: string, version: string): Promise<boolean> {
    try {
      const packageInfo = await this.getPackageInfo(packageName, version);
      const expectedFiles = await this.getPackageFileList(packageName, version);
      const existingFiles = await FileUtils.listFiles(packageDir, false);

      const normalizedExistingFiles = existingFiles.map(f => path.relative(packageDir, f));

      for (const expectedFile of expectedFiles) {
        if (!normalizedExistingFiles.includes(expectedFile)) {
          console.warn(`Missing file in package ${packageName}@${version}: ${expectedFile}`);
          return false;
        }
      }

      const packageJsonPath = path.join(packageDir, 'package.json');
      if (await FileUtils.fileExists(packageJsonPath)) {
        const localPackageJson = await FileUtils.readJsonFile(packageJsonPath);
        if (localPackageJson.name !== packageName || localPackageJson.version !== version) {
          console.warn(`Package name/version mismatch in ${packageName}@${version}`);
          return false;
        }
      }

      return true;
    } catch (error) {
      console.error(`Failed to verify package integrity for ${packageName}@${version}:`, error);
      return false;
    }
  }

  private normalizePackageInfo(data: any): NpmPackageInfo {
    const version = data['dist-tags']?.latest || data.version;
    const versionData = data.versions?.[version] || data;

    return {
      name: versionData.name || data.name,
      version: version,
      description: versionData.description || data.description || '',
      license: versionData.license || data.license || '',
      homepage: versionData.homepage || data.homepage || '',
      repository: versionData.repository || data.repository || { type: '', url: '' },
      bugs: versionData.bugs || data.bugs || { url: '' },
      dist: versionData.dist || data.dist || {
        integrity: '',
        shasum: '',
        tarball: '',
        fileCount: 0,
        unpackedSize: 0
      },
      dependencies: versionData.dependencies || {},
      devDependencies: versionData.devDependencies || {},
      files: versionData.files || [],
      main: versionData.main,
      types: versionData.types,
      module: versionData.module,
      bin: versionData.bin
    };
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}