import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { server } from './mocks/server.js';
import { http, HttpResponse } from 'msw';
import {
  fetchTestResults,
  filterTestResults,
  calculateTestSummary,
  hasFailedTests,
  toProjectSlug,
} from './tests-api.js';

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('Tests API', () => {
  describe('toProjectSlug', () => {
    it('should convert gh to github', () => {
      expect(
        toProjectSlug({ vcsAbbrev: 'gh', org: 'myorg', repo: 'myrepo', jobNumber: '123' }),
      ).toBe('github/myorg/myrepo');
    });

    it('should convert bb to bitbucket', () => {
      expect(
        toProjectSlug({ vcsAbbrev: 'bb', org: 'myorg', repo: 'myrepo', jobNumber: '123' }),
      ).toBe('bitbucket/myorg/myrepo');
    });
  });

  describe('fetchTestResults', () => {
    it('should fetch test results successfully', async () => {
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
        http.get('https://circleci.com/api/v2/project/github/myorg/myrepo/123/tests', () => {
          return HttpResponse.json(mockResponse);
        }),
      );

      const jobInfo = { vcsAbbrev: 'gh', org: 'myorg', repo: 'myrepo', jobNumber: '123' };
      const results = await fetchTestResults(jobInfo, 'test-token');

      expect(results).toHaveLength(2);
      expect(results[0]?.name).toBe('test case 1');
      expect(results[1]?.result).toBe('failure');
    });

    it('should handle pagination', async () => {
      server.use(
        http.get(
          'https://circleci.com/api/v2/project/github/myorg/myrepo/456/tests',
          ({ request }) => {
            const url = new URL(request.url);
            const pageToken = url.searchParams.get('page-token');

            if (!pageToken) {
              return HttpResponse.json({
                items: [
                  { name: 'test 1', result: 'success' },
                  { name: 'test 2', result: 'success' },
                ],
                next_page_token: 'token-2',
              });
            } else if (pageToken === 'token-2') {
              return HttpResponse.json({
                items: [
                  { name: 'test 3', result: 'success' },
                  { name: 'test 4', result: 'failure' },
                ],
                next_page_token: null,
              });
            }

            return HttpResponse.json({ items: [], next_page_token: null });
          },
        ),
      );

      const jobInfo = { vcsAbbrev: 'gh', org: 'myorg', repo: 'myrepo', jobNumber: '456' };
      const results = await fetchTestResults(jobInfo, 'test-token');

      expect(results).toHaveLength(4);
      expect(results[0]?.name).toBe('test 1');
      expect(results[3]?.name).toBe('test 4');
    });

    it('should return empty array for 404', async () => {
      server.use(
        http.get('https://circleci.com/api/v2/project/github/myorg/myrepo/789/tests', () => {
          return new HttpResponse(null, { status: 404 });
        }),
      );

      const jobInfo = { vcsAbbrev: 'gh', org: 'myorg', repo: 'myrepo', jobNumber: '789' };
      const results = await fetchTestResults(jobInfo, 'test-token');

      expect(results).toEqual([]);
    });

    it('should throw error for other HTTP errors', async () => {
      server.use(
        http.get('https://circleci.com/api/v2/project/github/myorg/myrepo/500/tests', () => {
          return new HttpResponse(null, { status: 500 });
        }),
      );

      const jobInfo = { vcsAbbrev: 'gh', org: 'myorg', repo: 'myrepo', jobNumber: '500' };

      await expect(fetchTestResults(jobInfo, 'test-token')).rejects.toThrow('HTTP 500');
    });
  });

  describe('filterTestResults', () => {
    const sampleTests = [
      { name: 'test 1', result: 'success' as const, classname: 'ClassA', file: 'a.rb' },
      { name: 'test 2', result: 'failure' as const, classname: 'ClassB', file: 'b.rb' },
      { name: 'test 3', result: 'skipped' as const, classname: 'ClassC', file: 'c.rb' },
      { name: 'test 4', result: 'error' as const, classname: 'ClassD', file: 'd.rb' },
    ];

    it('should filter by failed only', () => {
      const filtered = filterTestResults(sampleTests, { failedOnly: true });

      expect(filtered).toHaveLength(2);
      expect(filtered[0]?.result).toBe('failure');
      expect(filtered[1]?.result).toBe('error');
    });

    it('should filter by grep pattern', () => {
      const filtered = filterTestResults(sampleTests, { grep: /ClassB/ });

      expect(filtered).toHaveLength(1);
      expect(filtered[0]?.classname).toBe('ClassB');
    });

    it('should combine filters', () => {
      const filtered = filterTestResults(sampleTests, {
        failedOnly: true,
        grep: /ClassB/,
      });

      expect(filtered).toHaveLength(1);
      expect(filtered[0]?.name).toBe('test 2');
    });
  });

  describe('calculateTestSummary', () => {
    it('should calculate summary correctly', () => {
      const tests = [
        { name: 'test 1', result: 'success' as const, run_time: 0.1 },
        { name: 'test 2', result: 'success' as const, run_time: 0.2 },
        { name: 'test 3', result: 'failure' as const, run_time: 0.3 },
        { name: 'test 4', result: 'skipped' as const, run_time: 0 },
        { name: 'test 5', result: 'error' as const, run_time: 0.4 },
      ];

      const summary = calculateTestSummary(tests);

      expect(summary.total).toBe(5);
      expect(summary.passed).toBe(2);
      expect(summary.failed).toBe(1);
      expect(summary.skipped).toBe(1);
      expect(summary.errors).toBe(1);
      expect(summary.duration).toBeCloseTo(1.0);
    });

    it('should handle empty tests', () => {
      const summary = calculateTestSummary([]);

      expect(summary.total).toBe(0);
      expect(summary.passed).toBe(0);
      expect(summary.failed).toBe(0);
      expect(summary.duration).toBe(0);
    });
  });

  describe('hasFailedTests', () => {
    it('should return true for failed tests', () => {
      expect(hasFailedTests([{ name: 'test', result: 'failure' }])).toBe(true);
    });

    it('should return true for error tests', () => {
      expect(hasFailedTests([{ name: 'test', result: 'error' }])).toBe(true);
    });

    it('should return false for all passed', () => {
      expect(
        hasFailedTests([
          { name: 'test 1', result: 'success' },
          { name: 'test 2', result: 'skipped' },
        ]),
      ).toBe(false);
    });

    it('should return false for empty', () => {
      expect(hasFailedTests([])).toBe(false);
    });
  });
});
