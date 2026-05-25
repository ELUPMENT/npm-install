export class DependencyError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly packageName?: string,
    public readonly packageVersion?: string
  ) {
    super(message);
    this.name = 'DependencyError';
  }
}

export class NetworkError extends DependencyError {
  constructor(message: string, packageName?: string, packageVersion?: string) {
    super(message, 'NETWORK_ERROR', packageName, packageVersion);
    this.name = 'NetworkError';
  }
}

export class FileSystemError extends DependencyError {
  constructor(message: string, packageName?: string, packageVersion?: string) {
    super(message, 'FILE_SYSTEM_ERROR', packageName, packageVersion);
    this.name = 'FileSystemError';
  }
}

export class PackageNotFoundError extends DependencyError {
  constructor(message: string, packageName?: string, packageVersion?: string) {
    super(message, 'PACKAGE_NOT_FOUND', packageName, packageVersion);
    this.name = 'PackageNotFoundError';
  }
}

export class IntegrityError extends DependencyError {
  constructor(message: string, packageName?: string, packageVersion?: string) {
    super(message, 'INTEGRITY_ERROR', packageName, packageVersion);
    this.name = 'IntegrityError';
  }
}

export class ValidationError extends DependencyError {
  constructor(message: string, packageName?: string, packageVersion?: string) {
    super(message, 'VALIDATION_ERROR', packageName, packageVersion);
    this.name = 'ValidationError';
  }
}

export class ConfigurationError extends DependencyError {
  constructor(message: string) {
    super(message, 'CONFIGURATION_ERROR');
    this.name = 'ConfigurationError';
  }
}

export class TimeoutError extends DependencyError {
  constructor(message: string, packageName?: string, packageVersion?: string) {
    super(message, 'TIMEOUT_ERROR', packageName, packageVersion);
    this.name = 'TimeoutError';
  }
}

export function isDependencyError(error: unknown): error is DependencyError {
  return error instanceof DependencyError;
}

export function createError(
  type: 'NETWORK' | 'FILE_SYSTEM' | 'PACKAGE_NOT_FOUND' | 'INTEGRITY' | 'VALIDATION' | 'CONFIGURATION' | 'TIMEOUT',
  message: string,
  packageName?: string,
  packageVersion?: string
): DependencyError {
  switch (type) {
    case 'NETWORK':
      return new NetworkError(message, packageName, packageVersion);
    case 'FILE_SYSTEM':
      return new FileSystemError(message, packageName, packageVersion);
    case 'PACKAGE_NOT_FOUND':
      return new PackageNotFoundError(message, packageName, packageVersion);
    case 'INTEGRITY':
      return new IntegrityError(message, packageName, packageVersion);
    case 'VALIDATION':
      return new ValidationError(message, packageName, packageVersion);
    case 'CONFIGURATION':
      return new ConfigurationError(message);
    case 'TIMEOUT':
      return new TimeoutError(message, packageName, packageVersion);
    default:
      return new DependencyError(message, 'UNKNOWN_ERROR', packageName, packageVersion);
  }
}