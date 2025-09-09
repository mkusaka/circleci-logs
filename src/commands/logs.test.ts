import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import { server } from '../mocks/server.js';
import { http, HttpResponse } from 'msw';
import { createLogsCommand } from './logs.js';

beforeAll(() => server.listen());
afterEach(() => {
  server.resetHandlers();
  vi.clearAllMocks();
});
afterAll(() => server.close());

describe('Logs Subcommand', () => {
  it('should create logs command with correct options', () => {
    const logsCommand = createLogsCommand();

    expect(logsCommand.name()).toBe('logs');
    expect(logsCommand.description()).toContain('CircleCI job step logs');

    // Check that all options are registered
    const optionNames = logsCommand.options.map((opt) => opt.long);
    expect(optionNames).toContain('--errors-only');
    expect(optionNames).toContain('--grep');
    expect(optionNames).toContain('--json');
    expect(optionNames).toContain('--fail-on-error');
    expect(optionNames).toContain('--token');
    expect(optionNames).toContain('--verbose');
  });

  it('should handle logs fetching successfully', async () => {
    const mockJobResponse = {
      status: 'success',
      steps: [
        {
          name: 'Test Step',
          actions: [
            {
              name: 'Run tests',
              status: 'success',
              has_output: true,
              output_url: 'https://output.circleci.com/output/test',
            },
          ],
        },
      ],
    };

    server.use(
      http.get('https://circleci.com/api/v1.1/project/github/owner/repo/123', () => {
        return HttpResponse.json(mockJobResponse);
      }),
      http.get('https://output.circleci.com/output/test', () => {
        return HttpResponse.json([
          { message: 'Test output line 1', time: '2024-01-01T00:00:00Z' },
          { message: 'Test output line 2', time: '2024-01-01T00:00:01Z' },
        ]);
      }),
    );

    const logSpy = vi.spyOn(console, 'log');
    const errorSpy = vi.spyOn(console, 'error');

    const logsCommand = createLogsCommand();

    // Set up test environment
    process.env.CIRCLE_TOKEN = 'test-token';

    // Parse command with test URL
    await logsCommand.parseAsync([
      'node',
      'test',
      'https://app.circleci.com/pipelines/github/owner/repo/1/workflows/abc/jobs/123',
    ]);

    // Should have printed logs
    expect(logSpy).toHaveBeenCalled();

    delete process.env.CIRCLE_TOKEN;
    logSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it('should exit with code 1 when --fail-on-error and errors exist', async () => {
    const mockJobResponse = {
      status: 'failed',
      steps: [
        {
          name: 'Failed Step',
          actions: [
            {
              name: 'Failed action',
              status: 'failed',
              has_output: true,
              output_url: 'https://output.circleci.com/output/fail',
            },
          ],
        },
      ],
    };

    server.use(
      http.get('https://circleci.com/api/v1.1/project/github/owner/repo/456', () => {
        return HttpResponse.json(mockJobResponse);
      }),
      http.get('https://output.circleci.com/output/fail', () => {
        return HttpResponse.json([{ message: 'Error occurred', time: '2024-01-01T00:00:00Z' }]);
      }),
    );

    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((code) => {
      throw new Error(`process.exit(${code})`);
    });

    const logsCommand = createLogsCommand();
    process.env.CIRCLE_TOKEN = 'test-token';

    await expect(
      logsCommand.parseAsync([
        'node',
        'test',
        'https://app.circleci.com/pipelines/github/owner/repo/1/workflows/abc/jobs/456',
        '--fail-on-error',
      ]),
    ).rejects.toThrow('process.exit(1)');

    delete process.env.CIRCLE_TOKEN;
    exitSpy.mockRestore();
  });

  it('should output JSON when --json flag is used', async () => {
    const mockJobResponse = {
      status: 'success',
      steps: [
        {
          name: 'Test Step',
          actions: [
            {
              name: 'Run tests',
              status: 'success',
              has_output: false,
            },
          ],
        },
      ],
    };

    server.use(
      http.get('https://circleci.com/api/v1.1/project/github/owner/repo/789', () => {
        return HttpResponse.json(mockJobResponse);
      }),
    );

    const logSpy = vi.spyOn(console, 'log');

    const logsCommand = createLogsCommand();
    process.env.CIRCLE_TOKEN = 'test-token';

    await logsCommand.parseAsync([
      'node',
      'test',
      'https://app.circleci.com/pipelines/github/owner/repo/1/workflows/abc/jobs/789',
      '--json',
    ]);

    // Check that JSON was output
    const output = logSpy.mock.calls.join('');
    expect(output).toContain('[');
    expect(output).toContain(']');

    delete process.env.CIRCLE_TOKEN;
    logSpy.mockRestore();
  });

  it('should require CIRCLE_TOKEN', async () => {
    const errorSpy = vi.spyOn(console, 'error');
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((code) => {
      throw new Error(`process.exit(${code})`);
    });

    const logsCommand = createLogsCommand();

    // Ensure no token is set
    delete process.env.CIRCLE_TOKEN;

    await expect(
      logsCommand.parseAsync([
        'node',
        'test',
        'https://app.circleci.com/pipelines/github/owner/repo/1/workflows/abc/jobs/123',
      ]),
    ).rejects.toThrow('process.exit(2)');

    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('CIRCLE_TOKEN is required'));

    errorSpy.mockRestore();
    exitSpy.mockRestore();
  });
});

