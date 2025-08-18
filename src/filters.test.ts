import { describe, it, expect } from 'vitest';
import { filterActions, filterLines, getLineMessage } from './filters.js';
import type { CircleCIAction, LogLine } from './types.js';

describe('filterActions', () => {
  const mockActions: CircleCIAction[] = [
    { name: 'Action 1', status: 'success' },
    { name: 'Action 2', status: 'failed' },
    { name: 'Action 3', status: 'timedout' },
    { name: 'Action 4', status: 'Success' }, // Uppercase
    { name: 'Action 5', status: undefined },
    { name: 'Action 6', status: 'error' },
  ];

  it('should return all actions when errorsOnly is false', () => {
    const result = filterActions(mockActions, false);
    expect(result).toEqual(mockActions);
    expect(result).toHaveLength(6);
  });

  it('should filter out successful actions when errorsOnly is true', () => {
    const result = filterActions(mockActions, true);
    expect(result).toHaveLength(3);
    expect(result).toEqual([
      { name: 'Action 2', status: 'failed' },
      { name: 'Action 3', status: 'timedout' },
      { name: 'Action 6', status: 'error' },
    ]);
  });

  it('should handle case-insensitive status comparison', () => {
    const actionsWithMixedCase: CircleCIAction[] = [
      { name: 'Action 1', status: 'SUCCESS' },
      { name: 'Action 2', status: 'Success' },
      { name: 'Action 3', status: 'success' },
      { name: 'Action 4', status: 'FAILED' },
    ];

    const result = filterActions(actionsWithMixedCase, true);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ name: 'Action 4', status: 'FAILED' });
  });

  it('should handle empty actions array', () => {
    const result = filterActions([], true);
    expect(result).toEqual([]);
  });

  it('should not include actions with undefined status when errorsOnly is true', () => {
    const actionsWithUndefined: CircleCIAction[] = [
      { name: 'Action 1', status: undefined },
      { name: 'Action 2' }, // No status property
      { name: 'Action 3', status: 'failed' },
    ];

    const result = filterActions(actionsWithUndefined, true);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ name: 'Action 3', status: 'failed' });
  });
});

describe('filterLines', () => {
  const mockLines: LogLine[] = [
    { message: 'INFO: Starting process', time: '2024-01-01T00:00:00Z' },
    { message: 'ERROR: Failed to connect', time: '2024-01-01T00:00:01Z' },
    { message: 'WARNING: Deprecated API', time: '2024-01-01T00:00:02Z' },
    { message: 'DEBUG: Connection established', time: '2024-01-01T00:00:03Z' },
    { message: 'ERROR: Timeout occurred', time: '2024-01-01T00:00:04Z' },
    { message: undefined }, // Line with no message
  ];

  it('should return all lines when grep is null', () => {
    const result = filterLines(mockLines, null);
    expect(result).toEqual(mockLines);
    expect(result).toHaveLength(6);
  });

  it('should filter lines matching regex pattern', () => {
    const grep = /ERROR/;
    const result = filterLines(mockLines, grep);
    expect(result).toHaveLength(2);
    expect(result).toEqual([
      { message: 'ERROR: Failed to connect', time: '2024-01-01T00:00:01Z' },
      { message: 'ERROR: Timeout occurred', time: '2024-01-01T00:00:04Z' },
    ]);
  });

  it('should handle case-insensitive regex', () => {
    const grep = /error/i;
    const result = filterLines(mockLines, grep);
    expect(result).toHaveLength(2);
  });

  it('should handle multi-pattern regex', () => {
    const grep = /ERROR|WARNING/;
    const result = filterLines(mockLines, grep);
    expect(result).toHaveLength(3);
    expect(result).toContainEqual({
      message: 'WARNING: Deprecated API',
      time: '2024-01-01T00:00:02Z',
    });
  });

  it('should handle lines with undefined messages', () => {
    const grep = /undefined/;
    const result = filterLines(mockLines, grep);
    expect(result).toHaveLength(0); // undefined becomes empty string, doesn't match
  });

  it('should handle empty lines array', () => {
    const grep = /ERROR/;
    const result = filterLines([], grep);
    expect(result).toEqual([]);
  });

  it('should handle complex regex patterns', () => {
    const grep = /^(ERROR|WARNING):.*/;
    const result = filterLines(mockLines, grep);
    expect(result).toHaveLength(3);
  });
});

describe('getLineMessage', () => {
  it('should return string as-is when input is string', () => {
    const result = getLineMessage('Test message');
    expect(result).toBe('Test message');
  });

  it('should extract message from LogLine object', () => {
    const logLine: LogLine = {
      message: 'Test log message',
      time: '2024-01-01T00:00:00Z',
    };
    const result = getLineMessage(logLine);
    expect(result).toBe('Test log message');
  });

  it('should return empty string when LogLine has no message', () => {
    const logLine: LogLine = {
      time: '2024-01-01T00:00:00Z',
    };
    const result = getLineMessage(logLine);
    expect(result).toBe('');
  });

  it('should return empty string when LogLine message is undefined', () => {
    const logLine: LogLine = {
      message: undefined,
    };
    const result = getLineMessage(logLine);
    expect(result).toBe('');
  });

  it('should handle empty string input', () => {
    const result = getLineMessage('');
    expect(result).toBe('');
  });

  it('should handle multi-line string', () => {
    const multiLine = 'Line 1\nLine 2\nLine 3';
    const result = getLineMessage(multiLine);
    expect(result).toBe(multiLine);
  });
});
