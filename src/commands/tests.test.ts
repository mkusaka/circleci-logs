import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import { server } from '../mocks/server.js';
import { http, HttpResponse } from 'msw';
import { createTestsCommand } from './tests.js';

beforeAll(() => server.listen());
afterEach(() => {
  server.resetHandlers();
  vi.clearAllMocks();
});
afterAll(() => server.close());

describe('Tests Subcommand', () => {
  it('should create tests command with correct options', () => {
    const testsCommand = createTestsCommand();
    
    expect(testsCommand.name()).toBe('tests');
    expect(testsCommand.description()).toContain('test results');
    
    // Check that all options are registered
    const optionNames = testsCommand.options.map(opt => opt.long);
    expect(optionNames).toContain('--json');
    expect(optionNames).toContain('--failed-only');
    expect(optionNames).toContain('--grep');
    expect(optionNames).toContain('--fail-on-test-failure');
    expect(optionNames).toContain('--token');
    expect(optionNames).toContain('--verbose');
  });

  it('should handle test results successfully', async () => {
    const mockResponse = {
      items: [
        {
          classname: 'TestClass',
          file: 'test.rb',
          name: 'test case 1',
          result: 'success',
          run_time: 0.123,
        },
        {
          classname: 'TestClass',
          file: 'test.rb',
          name: 'test case 2',
          result: 'failure',
          message: 'Expected true but got false',
          run_time: 0.456,
        },
      ],
      next_page_token: null,
    };

    server.use(
      http.get('https://circleci.com/api/v2/project/github/owner/repo/123/tests', () => {
        return HttpResponse.json(mockResponse);
      }),
      http.get('https://circleci.com/api/v1.1/project/github/owner/repo/123', () => {
        return HttpResponse.json({
          status: 'success',
          steps: [],
        });
      }),
    );

    const logSpy = vi.spyOn(console, 'log');
    const errorSpy = vi.spyOn(console, 'error');
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit');
    });

    const testsCommand = createTestsCommand();
    
    // Set up test environment
    process.env.CIRCLE_TOKEN = 'test-token';
    
    // Parse command with test URL
    await testsCommand.parseAsync(['node', 'test', 'https://app.circleci.com/pipelines/github/owner/repo/1/workflows/abc/jobs/123']);
    
    // Should have printed test results
    expect(logSpy).toHaveBeenCalled();
    
    delete process.env.CIRCLE_TOKEN;
    logSpy.mockRestore();
    errorSpy.mockRestore();
    exitSpy.mockRestore();
  });

  it('should exit with code 1 when --fail-on-test-failure and tests fail', async () => {
    const mockResponse = {
      items: [
        {
          name: 'failing test',
          result: 'failure',
          message: 'Test failed',
        },
      ],
      next_page_token: null,
    };

    server.use(
      http.get('https://circleci.com/api/v2/project/github/owner/repo/456/tests', () => {
        return HttpResponse.json(mockResponse);
      }),
    );

    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((code) => {
      throw new Error(`process.exit(${code})`);
    });

    const testsCommand = createTestsCommand();
    process.env.CIRCLE_TOKEN = 'test-token';
    
    await expect(
      testsCommand.parseAsync([
        'node',
        'test',
        'https://app.circleci.com/pipelines/github/owner/repo/1/workflows/abc/jobs/456',
        '--fail-on-test-failure',
      ])
    ).rejects.toThrow('process.exit(1)');
    
    delete process.env.CIRCLE_TOKEN;
    exitSpy.mockRestore();
  });

  it('should output JSON when --json flag is used', async () => {
    const mockResponse = {
      items: [
        {
          name: 'test 1',
          result: 'success',
        },
      ],
      next_page_token: null,
    };

    server.use(
      http.get('https://circleci.com/api/v2/project/github/owner/repo/789/tests', () => {
        return HttpResponse.json(mockResponse);
      }),
    );

    const logSpy = vi.spyOn(console, 'log');
    
    const testsCommand = createTestsCommand();
    process.env.CIRCLE_TOKEN = 'test-token';
    
    await testsCommand.parseAsync([
      'node',
      'test',
      'https://app.circleci.com/pipelines/github/owner/repo/1/workflows/abc/jobs/789',
      '--json',
    ]);
    
    // Check that JSON was output
    const output = logSpy.mock.calls.join('');
    expect(output).toContain('"tests"');
    expect(output).toContain('"summary"');
    
    delete process.env.CIRCLE_TOKEN;
    logSpy.mockRestore();
  });

  it('should require CIRCLE_TOKEN', async () => {
    const errorSpy = vi.spyOn(console, 'error');
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((code) => {
      throw new Error(`process.exit(${code})`);
    });

    const testsCommand = createTestsCommand();
    
    // Ensure no token is set
    delete process.env.CIRCLE_TOKEN;
    
    await expect(
      testsCommand.parseAsync([
        'node',
        'test',
        'https://app.circleci.com/pipelines/github/owner/repo/1/workflows/abc/jobs/123',
      ])
    ).rejects.toThrow('process.exit(2)');
    
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('CIRCLE_TOKEN is required'));
    
    errorSpy.mockRestore();
    exitSpy.mockRestore();
  });
});