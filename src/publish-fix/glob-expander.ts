import fs from 'fs';
import path from 'path';

export interface GlobExpandResult {
  original: string;
  expanded: string[];
  matchedDirs: string[];
  isGlob: boolean;
}

export class GlobExpander {
  static expandGlobPatterns(
    filesField: string[],
    packageDir: string
  ): GlobExpandResult[] {
    const results: GlobExpandResult[] = [];

    for (const entry of filesField) {
      const result = this.expandSinglePattern(entry, packageDir);
      results.push(result);
    }

    return results;
  }

  private static expandSinglePattern(
    pattern: string,
    packageDir: string
  ): GlobExpandResult {
    const isGlob = this.containsGlobChars(pattern);

    if (!isGlob) {
      return {
        original: pattern,
        expanded: [pattern],
        matchedDirs: [],
        isGlob: false
      };
    }

    const matchedDirs = this.matchGlobInDir(pattern, packageDir);
    const expanded = matchedDirs.length > 0 ? matchedDirs : [pattern];

    return {
      original: pattern,
      expanded,
      matchedDirs,
      isGlob: true
    };
  }

  static containsGlobChars(pattern: string): boolean {
    return /[*?[\]{}]/.test(pattern);
  }

  private static matchGlobInDir(
    pattern: string,
    packageDir: string
  ): string[] {
    const normalizedPattern = pattern.replace(/\/$/, '');
    const matchedDirs: string[] = [];

    try {
      const items = fs.readdirSync(packageDir);

      for (const item of items) {
        const fullPath = path.join(packageDir, item);
        let stat: fs.Stats;

        try {
          stat = fs.statSync(fullPath);
        } catch {
          continue;
        }

        if (!stat.isDirectory()) {
          continue;
        }

        if (this.matchGlobPattern(normalizedPattern, item)) {
          if (pattern.endsWith('/')) {
            matchedDirs.push(`${item}/`);
          } else {
            matchedDirs.push(item);
          }
        }
      }
    } catch (error) {
      return [];
    }

    return matchedDirs.sort();
  }

  static matchGlobPattern(pattern: string, testName: string): boolean {
    const regex = this.globToRegex(pattern);
    return regex.test(testName);
  }

  private static globToRegex(pattern: string): RegExp {
    let regexStr = '';
    let i = 0;

    while (i < pattern.length) {
      const char = pattern[i];

      switch (char) {
        case '*':
          if (i + 1 < pattern.length && pattern[i + 1] === '*') {
            regexStr += '.*';
            i += 2;
            if (i < pattern.length && pattern[i] === '/') {
              regexStr += '\\/?';
              i++;
            }
          } else {
            regexStr += '[^/]*';
            i++;
          }
          break;
        case '?':
          regexStr += '[^/]';
          i++;
          break;
        case '[':
          const bracketEnd = pattern.indexOf(']', i);
          if (bracketEnd === -1) {
            regexStr += '\\[';
            i++;
          } else {
            regexStr += pattern.substring(i, bracketEnd + 1);
            i = bracketEnd + 1;
          }
          break;
        case '{':
          const braceEnd = pattern.indexOf('}', i);
          if (braceEnd === -1) {
            regexStr += '\\{';
            i++;
          } else {
            const groupContent = pattern.substring(i + 1, braceEnd);
            const alternatives = groupContent.split(',').map(s => s.trim());
            regexStr += `(?:${alternatives.join('|')})`;
            i = braceEnd + 1;
          }
          break;
        default:
          regexStr += char.replace(/[\\^$.|+()]/g, '\\$&');
          i++;
          break;
      }
    }

    return new RegExp(`^${regexStr}$`);
  }

  static expandFilesField(
    filesField: string[],
    packageDir: string
  ): string[] {
    const results = this.expandGlobPatterns(filesField, packageDir);
    const expanded: string[] = [];

    for (const result of results) {
      expanded.push(...result.expanded);
    }

    return Array.from(new Set(expanded));
  }

  static getGlobOnlyEntries(
    filesField: string[],
    packageDir: string
  ): GlobExpandResult[] {
    const results = this.expandGlobPatterns(filesField, packageDir);
    return results.filter(r => r.isGlob);
  }

  static getUnmatchedGlobs(
    filesField: string[],
    packageDir: string
  ): GlobExpandResult[] {
    const results = this.expandGlobPatterns(filesField, packageDir);
    return results.filter(r => r.isGlob && r.matchedDirs.length === 0);
  }

  static getIncompleteGlobs(
    filesField: string[],
    packageDir: string
  ): GlobExpandResult[] {
    const results = this.expandGlobPatterns(filesField, packageDir);
    return results.filter(r => r.isGlob && r.expanded.length > 1 && r.matchedDirs.length > 0);
  }
}