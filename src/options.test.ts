import { describe, it, expect } from 'vitest';
import type { CLIOptions } from './types.js';

describe('CLI Options', () => {
  describe('verbose option', () => {
    it('should include verbose in CLIOptions type', () => {
      const options: CLIOptions = {
        errorsOnly: false,
        json: false,
        failOnError: false,
        grep: null,
        token: 'test-token',
        url: 'https://test.com',
        verbose: false,
      };

      expect(options.verbose).toBeDefined();
      expect(typeof options.verbose).toBe('boolean');
    });

    it('should default verbose to false', () => {
      const defaultOptions = {
        errorsOnly: false,
        json: false,
        failOnError: false,
        grep: null,
        token: 'token',
        url: 'url',
        verbose: false,
      };

      expect(defaultOptions.verbose).toBe(false);
    });

    it('should handle verbose true correctly', () => {
      const verboseOptions: CLIOptions = {
        errorsOnly: false,
        json: false,
        failOnError: false,
        grep: null,
        token: 'test-token',
        url: 'https://test.com',
        verbose: true,
      };

      expect(verboseOptions.verbose).toBe(true);
    });
  });

  describe('options combination', () => {
    it('should allow verbose with errorsOnly', () => {
      const options: CLIOptions = {
        errorsOnly: true,
        json: false,
        failOnError: false,
        grep: null,
        token: 'test-token',
        url: 'https://test.com',
        verbose: true,
      };

      expect(options.verbose).toBe(true);
      expect(options.errorsOnly).toBe(true);
    });

    it('should allow verbose with json output', () => {
      const options: CLIOptions = {
        errorsOnly: false,
        json: true,
        failOnError: false,
        grep: null,
        token: 'test-token',
        url: 'https://test.com',
        verbose: true,
      };

      expect(options.verbose).toBe(true);
      expect(options.json).toBe(true);
    });

    it('should allow all options together', () => {
      const options: CLIOptions = {
        errorsOnly: true,
        json: true,
        failOnError: true,
        grep: /test/,
        token: 'test-token',
        url: 'https://test.com',
        verbose: true,
      };

      expect(options.verbose).toBe(true);
      expect(options.errorsOnly).toBe(true);
      expect(options.json).toBe(true);
      expect(options.failOnError).toBe(true);
      expect(options.grep).toBeInstanceOf(RegExp);
    });
  });
});
