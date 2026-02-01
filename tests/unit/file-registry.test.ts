import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FileRegistry } from '../../src/file-registry';
import * as fs from 'fs';
import * as path from 'path';

// Mock fs.promises
vi.mock('fs', () => {
  return {
    promises: {
      readdir: vi.fn(),
    }
  };
});

describe('FileRegistry', () => {
  let registry: FileRegistry;

  beforeEach(() => {
    vi.resetAllMocks();
    registry = new FileRegistry('/app');
  });

  it('should scan files recursively ignoring ignored patterns', async () => {
    const readdirMock = fs.promises.readdir as any;
    
    // First call: root directory
    readdirMock.mockImplementation(async (dirPath: string) => {
        if (dirPath === '/app') {
            return [
                { name: 'src', isDirectory: () => true },
                { name: 'package.json', isDirectory: () => false },
                { name: 'node_modules', isDirectory: () => true },
            ];
        }
        if (dirPath === '/app/src') {
            return [
                { name: 'index.ts', isDirectory: () => false },
            ];
        }
        return [];
    });

    await registry.scan();
    const files = registry.getFiles();

    expect(files).toHaveLength(2);
    
    const pkg = files.find(f => f.name === 'package.json');
    expect(pkg).toBeDefined();
    expect(pkg?.path).toBe('package.json');
    
    const idx = files.find(f => f.name === 'index.ts');
    expect(idx).toBeDefined();
    expect(idx?.path).toBe('src/index.ts'); // Path should be relative to root
  });

  it('should search files with matching', async () => {
    const readdirMock = fs.promises.readdir as any;
    readdirMock.mockResolvedValue([
        { name: 'apple.ts', isDirectory: () => false },
        { name: 'application.ts', isDirectory: () => false },
        { name: 'banana.ts', isDirectory: () => false },
        { name: 'z_app.ts', isDirectory: () => false },
    ]);
    
    await registry.scan();
    
    const results = registry.search('app');
    // apple.ts, application.ts, z_app.ts should match
    expect(results.map(f => f.name)).toContain('apple.ts');
    expect(results.map(f => f.name)).toContain('application.ts');
    expect(results.map(f => f.name)).toContain('z_app.ts');
    expect(results.map(f => f.name)).not.toContain('banana.ts');
    
    // Sort order: starts with 'app' first
    expect(results[0].name).toMatch(/^app/);
  });
});
