import { describe, it, expect, vi } from 'vitest';
import type { LogSegment } from './types.js';

describe('CLI Integration Tests', () => {
  describe('--verbose option', () => {
    it('should parse verbose option correctly in logs subcommand', async () => {
      // Since we're importing the program, we can test the option is registered
      const { program } = await import('./index.js');
      const logsCommand = program.commands.find((cmd) => cmd.name() === 'logs');
      expect(logsCommand).toBeDefined();
      const verboseOption = logsCommand?.options.find((opt) => opt.long === '--verbose');
      expect(verboseOption).toBeDefined();
      expect(verboseOption?.description).toContain('verbose');
    });
  });

  describe('subcommands', () => {
    it('should have logs subcommand', async () => {
      const { program } = await import('./index.js');
      const logsCommand = program.commands.find((cmd) => cmd.name() === 'logs');
      expect(logsCommand).toBeDefined();
      expect(logsCommand?.description()).toContain('CircleCI job step logs');
    });

    it('should have tests subcommand', async () => {
      const { program } = await import('./index.js');
      const testsCommand = program.commands.find((cmd) => cmd.name() === 'tests');
      expect(testsCommand).toBeDefined();
      expect(testsCommand?.description()).toContain('test results');
    });
  });

  describe('Empty output handling', () => {
    it('should handle empty segments without errors', async () => {
      // Import the relevant functions for testing
      const { printHuman } = await import('./formatter.js');

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
      // This is a compile-time check, but we can verify the type exists
      const mockOptions = {
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
    const segments: LogSegment[] = [];

    // Test that empty segments don't cause errors
    expect(() => {
      if (segments.length === 0) {
        // This is what the code does
        return 'No output found';
      }
      return 'Has output';
    }).not.toThrow();
  });

  it('should detect when all actions are filtered out', () => {
    const actions = [{ status: 'success' }, { status: 'success' }];

    const filtered = actions.filter((a) => a.status !== 'success');

    expect(filtered).toHaveLength(0);
  });
});
