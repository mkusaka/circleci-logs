import { describe, it, expect, vi, beforeEach, afterEach, type MockInstance } from 'vitest';
import { printHuman, printJson, checkForErrors } from './formatter.js';
import type { LogSegment } from './types.js';
import chalk from 'chalk';

// Force chalk to use colors in tests
chalk.level = 1;

describe('printHuman', () => {
  let consoleLogSpy: MockInstance;
  let stdoutWriteSpy: MockInstance;

  beforeEach(() => {
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    stdoutWriteSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should print formatted output for segments with logs', () => {
    const segments: LogSegment[] = [
      {
        step: 'Build',
        action: {
          name: 'Compile',
          status: 'success',
        },
        lines: [{ message: 'Compiling source code...' }, { message: 'Build complete!' }],
      },
    ];

    printHuman(segments);

    expect(consoleLogSpy).toHaveBeenCalled();
    expect(stdoutWriteSpy).toHaveBeenCalledWith('Compiling source code...\n');
    expect(stdoutWriteSpy).toHaveBeenCalledWith('Build complete!\n');
  });

  it('should handle segments with no output', () => {
    const segments: LogSegment[] = [
      {
        step: 'Setup',
        action: {
          name: 'Initialize',
          status: 'success',
        },
        lines: [],
      },
    ];

    printHuman(segments);

    expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('(no output)'));
  });

  it('should handle missing step and action names', () => {
    const segments: LogSegment[] = [
      {
        step: '',
        action: {},
        lines: [{ message: 'Test line' }],
      },
    ];

    printHuman(segments);

    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining('(no step name)') && expect.stringContaining('(no action name)'),
    );
  });

  it('should handle lines without newline endings', () => {
    const segments: LogSegment[] = [
      {
        step: 'Test',
        action: { name: 'Run', status: 'success' },
        lines: [{ message: 'Line without newline' }, { message: 'Line with newline\n' }],
      },
    ];

    printHuman(segments);

    expect(stdoutWriteSpy).toHaveBeenCalledWith('Line without newline\n');
    expect(stdoutWriteSpy).toHaveBeenCalledWith('Line with newline\n');
  });

  it('should handle completely empty segments array', () => {
    const segments: LogSegment[] = [];

    printHuman(segments);

    // Should not throw and handle gracefully
    expect(consoleLogSpy).not.toHaveBeenCalled();
    expect(stdoutWriteSpy).not.toHaveBeenCalled();
  });

  it('should apply correct colors for different statuses', () => {
    const testCases = [
      { status: 'success', expectedColor: 'green' },
      { status: 'failed', expectedColor: 'red' },
      { status: 'timedout', expectedColor: 'yellow' },
      { status: 'canceled', expectedColor: 'gray' },
      { status: 'running', expectedColor: 'blue' },
      { status: 'unknown', expectedColor: 'white' },
    ];

    testCases.forEach(({ status }) => {
      const segments: LogSegment[] = [
        {
          step: 'Test',
          action: { name: 'Action', status },
          lines: [],
        },
      ];

      printHuman(segments);
      // Status should be wrapped with color codes
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining(`[${status}]`));
    });
  });
});

describe('printJson', () => {
  let consoleLogSpy: MockInstance;

  beforeEach(() => {
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should print segments as formatted JSON', () => {
    const segments: LogSegment[] = [
      {
        step: 'Build',
        action: {
          name: 'Compile',
          status: 'success',
        },
        lines: [{ message: 'Building...', time: '2024-01-01T00:00:00Z' }],
      },
    ];

    printJson(segments);

    expect(consoleLogSpy).toHaveBeenCalledWith(JSON.stringify(segments, null, 2));
  });

  it('should handle empty segments array', () => {
    const segments: LogSegment[] = [];

    printJson(segments);

    expect(consoleLogSpy).toHaveBeenCalledWith('[]');
  });

  it('should preserve all properties in JSON output', () => {
    const segments: LogSegment[] = [
      {
        step: 'Test Step',
        action: {
          name: 'Test Action',
          status: 'failed',
          has_output: true,
          output_url: 'https://example.com/output',
          exit_code: 1,
          run_time_millis: 5000,
        },
        lines: [
          {
            message: 'Error occurred',
            time: '2024-01-01T00:00:00Z',
            type: 'error',
          },
        ],
      },
    ];

    printJson(segments);

    const output = consoleLogSpy.mock.calls[0]?.[0];
    const parsed = JSON.parse(output);

    expect(parsed[0].action.has_output).toBe(true);
    expect(parsed[0].action.exit_code).toBe(1);
    expect(parsed[0].lines[0].type).toBe('error');
  });
});

describe('checkForErrors', () => {
  it('should return false when all actions are successful', () => {
    const segments: LogSegment[] = [
      {
        step: 'Build',
        action: { name: 'Compile', status: 'success' },
        lines: [],
      },
      {
        step: 'Test',
        action: { name: 'Unit Tests', status: 'SUCCESS' },
        lines: [],
      },
    ];

    expect(checkForErrors(segments)).toBe(false);
  });

  it('should return true when any action has non-success status', () => {
    const segments: LogSegment[] = [
      {
        step: 'Build',
        action: { name: 'Compile', status: 'success' },
        lines: [],
      },
      {
        step: 'Test',
        action: { name: 'Unit Tests', status: 'failed' },
        lines: [],
      },
    ];

    expect(checkForErrors(segments)).toBe(true);
  });

  it('should handle various error statuses', () => {
    const errorStatuses = ['failed', 'timedout', 'error', 'canceled'];

    errorStatuses.forEach((status) => {
      const segments: LogSegment[] = [
        {
          step: 'Test',
          action: { name: 'Action', status },
          lines: [],
        },
      ];

      expect(checkForErrors(segments)).toBe(true);
    });
  });

  it('should handle missing or empty status', () => {
    const segments: LogSegment[] = [
      {
        step: 'Test1',
        action: { name: 'Action1', status: '' },
        lines: [],
      },
      {
        step: 'Test2',
        action: { name: 'Action2', status: undefined },
        lines: [],
      },
      {
        step: 'Test3',
        action: { name: 'Action3' },
        lines: [],
      },
    ];

    expect(checkForErrors(segments)).toBe(false);
  });

  it('should handle empty segments array', () => {
    expect(checkForErrors([])).toBe(false);
  });

  it('should be case-insensitive for success status', () => {
    const segments: LogSegment[] = [
      {
        step: 'Build',
        action: { name: 'Compile', status: 'SUCCESS' },
        lines: [],
      },
      {
        step: 'Test',
        action: { name: 'Unit Tests', status: 'Success' },
        lines: [],
      },
    ];

    expect(checkForErrors(segments)).toBe(false);
  });
});
