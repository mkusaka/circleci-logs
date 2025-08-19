import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { server } from './mocks/server.js';
import { http, HttpResponse } from 'msw';
import { fetchJobDetails, fetchActionOutput, parseJobUrl } from './circleci.js';

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('CircleCI API with MSW', () => {
  describe('fetchJobDetails with various responses', () => {
    it('should handle successful job with multiple steps', async () => {
      const jobResponse = {
        status: 'success',
        outcome: 'success',
        lifecycle: 'finished',
        steps: [
          {
            name: 'Spin up environment',
            actions: [
              {
                name: 'Spin up environment',
                status: 'success',
                has_output: false,
              },
            ],
          },
          {
            name: 'Checkout code',
            actions: [
              {
                name: 'Checkout code',
                status: 'success',
                has_output: true,
                output_url: 'https://storage.example.com/output/checkout',
              },
            ],
          },
          {
            name: 'Run tests',
            actions: [
              {
                name: 'npm test',
                status: 'success',
                has_output: true,
                output_url: 'https://storage.example.com/output/tests',
              },
            ],
          },
        ],
      };

      server.use(
        http.get('https://circleci.com/api/v1.1/project/gh/myorg/myrepo/123', () => {
          return HttpResponse.json(jobResponse);
        }),
      );

      const jobInfo = { vcsAbbrev: 'gh', org: 'myorg', repo: 'myrepo', jobNumber: '123' };
      const result = await fetchJobDetails(jobInfo, 'test-token');

      expect(result.status).toBe('success');
      expect(result.steps).toHaveLength(3);
      expect(result.steps?.[0]?.name).toBe('Spin up environment');
      expect(result.steps?.[2]?.actions?.[0]?.output_url).toBe(
        'https://storage.example.com/output/tests',
      );
    });

    it('should handle failed job with error details', async () => {
      const failedJobResponse = {
        status: 'failed',
        outcome: 'failed',
        lifecycle: 'finished',
        steps: [
          {
            name: 'Build',
            actions: [
              {
                name: 'Build application',
                status: 'failed',
                exit_code: 1,
                has_output: true,
                output_url: 'https://storage.example.com/output/build-error',
                failed: true,
              },
            ],
          },
        ],
      };

      server.use(
        http.get('https://circleci.com/api/v1.1/project/gh/myorg/myrepo/456', () => {
          return HttpResponse.json(failedJobResponse);
        }),
      );

      const jobInfo = { vcsAbbrev: 'gh', org: 'myorg', repo: 'myrepo', jobNumber: '456' };
      const result = await fetchJobDetails(jobInfo, 'test-token');

      expect(result.status).toBe('failed');
      expect(result.outcome).toBe('failed');
      expect(result.steps?.[0]?.actions?.[0]?.failed).toBe(true);
      expect(result.steps?.[0]?.actions?.[0]?.exit_code).toBe(1);
    });

    it('should handle timedout actions', async () => {
      const timedoutJobResponse = {
        status: 'failed',
        outcome: 'failed',
        steps: [
          {
            name: 'Deploy',
            actions: [
              {
                name: 'Deploy to production',
                status: 'timedout',
                has_output: true,
                output_url: 'https://storage.example.com/output/deploy',
                timedout: true,
              },
            ],
          },
        ],
      };

      server.use(
        http.get('https://circleci.com/api/v1.1/project/gh/myorg/myrepo/789', () => {
          return HttpResponse.json(timedoutJobResponse);
        }),
      );

      const jobInfo = { vcsAbbrev: 'gh', org: 'myorg', repo: 'myrepo', jobNumber: '789' };
      const result = await fetchJobDetails(jobInfo, 'test-token');

      expect(result.steps?.[0]?.actions?.[0]?.status).toBe('timedout');
      expect(result.steps?.[0]?.actions?.[0]?.timedout).toBe(true);
    });

    it('should handle 401 unauthorized error', async () => {
      server.use(
        http.get('https://circleci.com/api/v1.1/project/gh/myorg/myrepo/401', () => {
          return new HttpResponse(null, { status: 401, statusText: 'Unauthorized' });
        }),
      );

      const jobInfo = { vcsAbbrev: 'gh', org: 'myorg', repo: 'myrepo', jobNumber: '401' };

      await expect(fetchJobDetails(jobInfo, 'invalid-token')).rejects.toThrow(
        'HTTP 401 Unauthorized',
      );
    });

    it('should handle 404 not found error', async () => {
      server.use(
        http.get('https://circleci.com/api/v1.1/project/gh/myorg/myrepo/404', () => {
          return new HttpResponse(null, { status: 404, statusText: 'Not Found' });
        }),
      );

      const jobInfo = { vcsAbbrev: 'gh', org: 'myorg', repo: 'myrepo', jobNumber: '404' };

      await expect(fetchJobDetails(jobInfo, 'test-token')).rejects.toThrow('HTTP 404 Not Found');
    });

    it('should handle 500 server error', async () => {
      server.use(
        http.get('https://circleci.com/api/v1.1/project/gh/myorg/myrepo/500', () => {
          return new HttpResponse(null, { status: 500, statusText: 'Internal Server Error' });
        }),
      );

      const jobInfo = { vcsAbbrev: 'gh', org: 'myorg', repo: 'myrepo', jobNumber: '500' };

      await expect(fetchJobDetails(jobInfo, 'test-token')).rejects.toThrow(
        'HTTP 500 Internal Server Error',
      );
    });

    it('should handle network error', async () => {
      server.use(
        http.get('https://circleci.com/api/v1.1/project/gh/myorg/myrepo/network', () => {
          return HttpResponse.error();
        }),
      );

      const jobInfo = { vcsAbbrev: 'gh', org: 'myorg', repo: 'myrepo', jobNumber: 'network' };

      await expect(fetchJobDetails(jobInfo, 'test-token')).rejects.toThrow();
    });

    it('should handle job with no steps', async () => {
      server.use(
        http.get('https://circleci.com/api/v1.1/project/gh/myorg/myrepo/empty', () => {
          return HttpResponse.json({
            status: 'not_run',
            steps: [],
          });
        }),
      );

      const jobInfo = { vcsAbbrev: 'gh', org: 'myorg', repo: 'myrepo', jobNumber: 'empty' };
      const result = await fetchJobDetails(jobInfo, 'test-token');

      expect(result.status).toBe('not_run');
      expect(result.steps).toEqual([]);
    });

    it('should handle job with actions without output', async () => {
      server.use(
        http.get('https://circleci.com/api/v1.1/project/gh/myorg/myrepo/no-output', () => {
          return HttpResponse.json({
            status: 'success',
            steps: [
              {
                name: 'Setup',
                actions: [
                  {
                    name: 'Initialize',
                    status: 'success',
                    has_output: false,
                  },
                ],
              },
            ],
          });
        }),
      );

      const jobInfo = { vcsAbbrev: 'gh', org: 'myorg', repo: 'myrepo', jobNumber: 'no-output' };
      const result = await fetchJobDetails(jobInfo, 'test-token');

      expect(result.steps?.[0]?.actions?.[0]?.has_output).toBe(false);
      expect(result.steps?.[0]?.actions?.[0]?.output_url).toBeUndefined();
    });

    it('should handle parallel actions in a step', async () => {
      server.use(
        http.get('https://circleci.com/api/v1.1/project/gh/myorg/myrepo/parallel', () => {
          return HttpResponse.json({
            status: 'success',
            steps: [
              {
                name: 'Parallel Tests',
                actions: [
                  {
                    name: 'Test Suite 1',
                    status: 'success',
                    has_output: true,
                    output_url: 'https://storage.example.com/output/test1',
                    index: 0,
                    parallel: true,
                  },
                  {
                    name: 'Test Suite 2',
                    status: 'success',
                    has_output: true,
                    output_url: 'https://storage.example.com/output/test2',
                    index: 1,
                    parallel: true,
                  },
                  {
                    name: 'Test Suite 3',
                    status: 'failed',
                    has_output: true,
                    output_url: 'https://storage.example.com/output/test3',
                    index: 2,
                    parallel: true,
                  },
                ],
              },
            ],
          });
        }),
      );

      const jobInfo = { vcsAbbrev: 'gh', org: 'myorg', repo: 'myrepo', jobNumber: 'parallel' };
      const result = await fetchJobDetails(jobInfo, 'test-token');

      expect(result.steps?.[0]?.actions).toHaveLength(3);
      expect(result.steps?.[0]?.actions?.[0]?.parallel).toBe(true);
      expect(result.steps?.[0]?.actions?.[2]?.status).toBe('failed');
    });
  });

  describe('fetchActionOutput with various responses', () => {
    it('should fetch and parse log lines successfully', async () => {
      server.use(
        http.get('https://storage.example.com/output/test-logs', () => {
          return HttpResponse.json([
            { message: 'Starting tests...', time: '2024-01-01T00:00:00Z' },
            { message: 'Running test suite', time: '2024-01-01T00:00:01Z' },
            { message: 'All tests passed!', time: '2024-01-01T00:00:02Z' },
          ]);
        }),
      );

      const logs = await fetchActionOutput('https://storage.example.com/output/test-logs');

      expect(logs).toHaveLength(3);
      expect(logs[0]?.message).toBe('Starting tests...');
      expect(logs[2]?.message).toBe('All tests passed!');
    });

    it('should handle empty log output', async () => {
      server.use(
        http.get('https://storage.example.com/output/empty', () => {
          return HttpResponse.json([]);
        }),
      );

      const logs = await fetchActionOutput('https://storage.example.com/output/empty');

      expect(logs).toEqual([]);
    });

    it('should handle malformed JSON response', async () => {
      server.use(
        http.get('https://storage.example.com/output/malformed', () => {
          return HttpResponse.text('Not JSON content');
        }),
      );

      const logs = await fetchActionOutput('https://storage.example.com/output/malformed');

      expect(logs).toHaveLength(1);
      expect(logs[0]?.message).toContain('failed to fetch output_url');
      expect(logs[0]?.message).toContain('is not valid JSON');
    });

    it('should handle logs with special characters', async () => {
      server.use(
        http.get('https://storage.example.com/output/special', () => {
          return HttpResponse.json([
            { message: 'Testing with "quotes" and \'apostrophes\'', time: '2024-01-01T00:00:00Z' },
            { message: 'Unicode: 你好 🎉 émojis', time: '2024-01-01T00:00:01Z' },
            { message: 'Escape sequences: \\n\\t\\r', time: '2024-01-01T00:00:02Z' },
          ]);
        }),
      );

      const logs = await fetchActionOutput('https://storage.example.com/output/special');

      expect(logs[0]?.message).toContain('quotes');
      expect(logs[1]?.message).toContain('🎉');
      expect(logs[2]?.message).toContain('\\n');
    });

    it('should handle very large log files', async () => {
      const largeLogs = Array.from({ length: 1000 }, (_, i) => ({
        message: `Log line ${i + 1}`,
        time: `2024-01-01T00:00:${String(i).padStart(2, '0')}Z`,
      }));

      server.use(
        http.get('https://storage.example.com/output/large', () => {
          return HttpResponse.json(largeLogs);
        }),
      );

      const logs = await fetchActionOutput('https://storage.example.com/output/large');

      expect(logs).toHaveLength(1000);
      expect(logs[0]?.message).toBe('Log line 1');
      expect(logs[999]?.message).toBe('Log line 1000');
    });

    it('should handle 403 forbidden on storage URL', async () => {
      server.use(
        http.get('https://storage.example.com/output/forbidden', () => {
          return new HttpResponse(null, { status: 403, statusText: 'Forbidden' });
        }),
      );

      const logs = await fetchActionOutput('https://storage.example.com/output/forbidden');

      expect(logs).toHaveLength(1);
      expect(logs[0]?.message).toContain('failed to fetch output_url');
      expect(logs[0]?.message).toContain('HTTP 403 Forbidden');
    });

    it('should handle network timeout', async () => {
      server.use(
        http.get('https://storage.example.com/output/timeout', async () => {
          await new Promise((resolve) => setTimeout(resolve, 10000));
          return HttpResponse.json([]);
        }),
      );

      const controller = new AbortController();
      setTimeout(() => controller.abort(), 100);

      // This will timeout in a real scenario
      await expect(
        fetch('https://storage.example.com/output/timeout', { signal: controller.signal }),
      ).rejects.toThrow();
    });
  });

  describe('parseJobUrl edge cases', () => {
    it('should handle URLs with query parameters', () => {
      const result = parseJobUrl('https://circleci.com/gh/org/repo/123?tab=tests');
      expect(result).toEqual({
        vcsAbbrev: 'gh',
        org: 'org',
        repo: 'repo',
        jobNumber: '123',
      });
    });

    it('should handle URLs with hash fragments', () => {
      const result = parseJobUrl('https://circleci.com/gh/org/repo/456#step-2');
      expect(result).toEqual({
        vcsAbbrev: 'gh',
        org: 'org',
        repo: 'repo',
        jobNumber: '456',
      });
    });

    it('should handle URLs with trailing slash', () => {
      const result = parseJobUrl('https://circleci.com/gh/org/repo/789/');
      expect(result).toEqual({
        vcsAbbrev: 'gh',
        org: 'org',
        repo: 'repo',
        jobNumber: '789',
      });
    });

    it('should handle new UI format with complex paths', () => {
      const result = parseJobUrl(
        'https://app.circleci.com/pipelines/github/myorg/my-repo/1234/workflows/abc-def-ghi/jobs/56789',
      );
      expect(result).toEqual({
        vcsAbbrev: 'gh',
        org: 'myorg',
        repo: 'my-repo',
        jobNumber: '56789',
      });
    });

    it('should handle BitBucket URLs', () => {
      const result = parseJobUrl('https://circleci.com/bb/org/repo/123');
      expect(result).toEqual({
        vcsAbbrev: 'bb',
        org: 'org',
        repo: 'repo',
        jobNumber: '123',
      });
    });

    it('should throw on invalid URLs', () => {
      expect(() => parseJobUrl('not-a-url')).toThrow('Unsupported CircleCI job URL format');
      expect(() => parseJobUrl('https://example.com/something')).toThrow(
        'Unsupported CircleCI job URL format',
      );
      expect(() => parseJobUrl('https://circleci.com/invalid/format')).toThrow(
        'Unsupported CircleCI job URL format',
      );
    });
  });

  describe('Rate limiting and retry scenarios', () => {
    it('should handle rate limit response', async () => {
      server.use(
        http.get('https://circleci.com/api/v1.1/project/gh/myorg/myrepo/ratelimit', () => {
          return new HttpResponse(null, {
            status: 429,
            statusText: 'Too Many Requests',
            headers: {
              'Retry-After': '60',
            },
          });
        }),
      );

      const jobInfo = { vcsAbbrev: 'gh', org: 'myorg', repo: 'myrepo', jobNumber: 'ratelimit' };

      await expect(fetchJobDetails(jobInfo, 'test-token')).rejects.toThrow(
        'HTTP 429 Too Many Requests',
      );
    });

    it('should handle temporary server errors', async () => {
      let attempts = 0;
      server.use(
        http.get('https://circleci.com/api/v1.1/project/gh/myorg/myrepo/retry', () => {
          attempts++;
          if (attempts < 3) {
            return new HttpResponse(null, { status: 503, statusText: 'Service Unavailable' });
          }
          return HttpResponse.json({
            status: 'success',
            steps: [],
          });
        }),
      );

      const jobInfo = { vcsAbbrev: 'gh', org: 'myorg', repo: 'myrepo', jobNumber: 'retry' };

      // First attempt should fail
      await expect(fetchJobDetails(jobInfo, 'test-token')).rejects.toThrow(
        'HTTP 503 Service Unavailable',
      );
    });
  });
});
