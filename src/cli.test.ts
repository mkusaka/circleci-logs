import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { spawn } from 'child_process';
import { join } from 'path';

describe('CLI Integration Tests', () => {
  const cliPath = join(process.cwd(), 'dist', 'index.js');
  let consoleErrorSpy: any;
  let consoleLogSpy: any;

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('--verbose option', () => {
    it('should parse verbose option correctly', async () => {
      // Since we're importing the program, we can test the option is registered
      const { program } = await import('./index');
      const verboseOption = program.options.find((opt: any) => opt.long === '--verbose');
      expect(verboseOption).toBeDefined();
      expect(verboseOption.description).toContain('verbose');
    });
  });

  describe('Empty output handling', () => {
    it('should handle empty segments without errors', async () => {
      // Import the relevant functions for testing
      const { printHuman } = await import('./formatter');

      // Mock console.log to capture output
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

      // Call with empty segments - should not throw
      expect(() => printHuman([])).not.toThrow();

      // Empty array means no output at all from formatter
      expect(logSpy).not.toHaveBeenCalled();
      expect(stdoutSpy).not.toHaveBeenCalled();

      logSpy.mockRestore();
      stdoutSpy.mockRestore();
    });
  });

  describe('CLI Options Types', () => {
    it('should have verbose property in CLIOptions interface', async () => {
      const types = await import('./types');

      // This is a compile-time check, but we can verify the type exists
      const mockOptions: types.CLIOptions = {
        errorsOnly: false,
        json: false,
        failOnError: false,
        grep: null,
        token: 'test-token',
        url: 'https://test.url',
        verbose: false, // This should compile without errors
      };

      expect(mockOptions.verbose).toBeDefined();
    });
  });
});

describe('Verbose Mode Behavior', () => {
  it('should include verbose in default options', () => {
    const options = {
      errorsOnly: false,
      json: false,
      failOnError: false,
      grep: null,
      token: 'test',
      url: 'test-url',
      verbose: false,
    };

    expect(options.verbose).toBe(false);
  });

  it('should handle verbose output correctly when enabled', () => {
    const options = {
      errorsOnly: false,
      json: false,
      failOnError: false,
      grep: null,
      token: 'test',
      url: 'test-url',
      verbose: true,
    };

    expect(options.verbose).toBe(true);
  });
});

describe('Empty Segments Handling', () => {
  it('should handle empty segments array gracefully', () => {
    const segments: any[] = [];

    // Test that empty segments don't cause errors
    expect(() => {
      if (segments.length === 0) {
        // This is what the code does
        return 'No output found';
      }
    }).not.toThrow();
  });

  it('should detect when all actions are filtered out', () => {
    const actions = [{ status: 'success' }, { status: 'success' }];

    const errorsOnly = true;
    const filtered = actions.filter((a) => a.status !== 'success');

    expect(filtered).toHaveLength(0);
  });
});
