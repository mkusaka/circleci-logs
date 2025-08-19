import { describe, it, expect, beforeEach } from 'vitest';
import { parseJobUrl, fetchJson, fetchJobDetails, fetchActionOutput } from './circleci.js';
import type { JobUrlInfo } from './types.js';
import { server } from './mocks/server.js';
import { errorHandlers } from './mocks/handlers.js';
import { http, HttpResponse } from 'msw';

describe('parseJobUrl', () => {
  it('should parse legacy CircleCI URL format (github)', () => {
    const url = 'https://circleci.com/gh/org-name/repo-name/12345';
    const result = parseJobUrl(url);
    expect(result).toEqual({
      vcsAbbrev: 'gh',
      org: 'org-name',
      repo: 'repo-name',
      jobNumber: '12345',
    });
  });

  it('should parse legacy CircleCI URL format (bitbucket)', () => {
    const url = 'https://circleci.com/bb/my-org/my-repo/67890';
    const result = parseJobUrl(url);
    expect(result).toEqual({
      vcsAbbrev: 'bb',
      org: 'my-org',
      repo: 'my-repo',
      jobNumber: '67890',
    });
  });

  it('should parse new CircleCI app URL format', () => {
    const url =
      'https://app.circleci.com/pipelines/github/org-name/repo-name/123/workflows/abc/jobs/456';
    const result = parseJobUrl(url);
    expect(result).toEqual({
      vcsAbbrev: 'gh', // Converted from 'github' to 'gh'
      org: 'org-name',
      repo: 'repo-name',
      jobNumber: '456',
    });
  });

  it('should parse new CircleCI app URL format (bitbucket)', () => {
    const url =
      'https://app.circleci.com/pipelines/bitbucket/my-org/my-repo/789/workflows/def/jobs/101112';
    const result = parseJobUrl(url);
    expect(result).toEqual({
      vcsAbbrev: 'bb', // Converted from 'bitbucket' to 'bb'
      org: 'my-org',
      repo: 'my-repo',
      jobNumber: '101112',
    });
  });

  it('should parse CircleCI URL with special characters', () => {
    const url = 'https://circleci.com/gh/org-name/repo.with.dots/12345';
    const result = parseJobUrl(url);
    expect(result).toEqual({
      vcsAbbrev: 'gh',
      org: 'org-name',
      repo: 'repo.with.dots',
      jobNumber: '12345',
    });
  });

  it('should throw error for invalid URL format', () => {
    const url = 'https://example.com/invalid/url';
    expect(() => parseJobUrl(url)).toThrow('Unsupported CircleCI job URL format');
  });

  it('should throw error for non-CircleCI URL', () => {
    const url = 'https://github.com/org/repo';
    expect(() => parseJobUrl(url)).toThrow('Unsupported CircleCI job URL format');
  });

  it('should handle URL with trailing slash', () => {
    const url = 'https://circleci.com/gh/org-name/repo-name/12345/';
    const result = parseJobUrl(url);
    expect(result).toEqual({
      vcsAbbrev: 'gh',
      org: 'org-name',
      repo: 'repo-name',
      jobNumber: '12345',
    });
  });

  it('should handle URL with query parameters', () => {
    const url = 'https://circleci.com/gh/org-name/repo-name/12345?filter=all';
    const result = parseJobUrl(url);
    expect(result).toEqual({
      vcsAbbrev: 'gh',
      org: 'org-name',
      repo: 'repo-name',
      jobNumber: '12345',
    });
  });
});

describe('fetchJson', () => {
  it('should fetch and parse JSON successfully', async () => {
    // MSW will intercept this request and return mock data
    const result = await fetchJson(
      'https://circleci.com/api/v1.1/project/gh/test-org/test-repo/12345',
    );

    expect(result).toHaveProperty('vcs_url');
    expect(result).toHaveProperty('build_num', 12345);
    expect(result).toHaveProperty('status', 'success');
  });

  it('should include custom headers', async () => {
    // Create a custom handler to verify headers
    let capturedHeaders: Headers | null = null;
    server.use(
      http.get('https://api.example.com/test-headers', ({ request }) => {
        capturedHeaders = request.headers;
        return HttpResponse.json({ success: true });
      }),
    );

    await fetchJson('https://api.example.com/test-headers', {
      Authorization: 'Bearer test-token',
      'X-Custom-Header': 'test-value',
    });

    expect(capturedHeaders?.get('Authorization')).toBe('Bearer test-token');
    expect(capturedHeaders?.get('X-Custom-Header')).toBe('test-value');
  });

  it('should throw error for non-OK response', async () => {
    // Use error handler for 404
    server.use(errorHandlers.notFound);

    await expect(
      fetchJson('https://circleci.com/api/v1.1/project/gh/test-org/test-repo/99999'),
    ).rejects.toThrow('HTTP 404 Not Found');
  });

  it('should handle network errors', async () => {
    // Simulate network error
    server.use(
      http.get('https://api.example.com/network-error', () => {
        return HttpResponse.error();
      }),
    );

    await expect(fetchJson('https://api.example.com/network-error')).rejects.toThrow();
  });
});

describe('fetchJobDetails', () => {
  it('should fetch job details with correct URL and token', async () => {
    const jobInfo: JobUrlInfo = {
      vcsAbbrev: 'gh',
      org: 'test-org',
      repo: 'test-repo',
      jobNumber: '12345',
    };

    // Create a handler to verify the Circle-Token header
    let capturedToken: string | null = null;
    server.use(
      http.get(
        'https://circleci.com/api/v1.1/project/gh/test-org/test-repo/12345',
        ({ request }) => {
          capturedToken = request.headers.get('Circle-Token');
          // Return the default mock response
          return HttpResponse.json({
            vcs_url: 'https://github.com/test-org/test-repo',
            build_num: 12345,
            status: 'success',
            steps: [
              {
                name: 'Spin up environment',
                actions: [
                  {
                    name: 'Spin up environment',
                    status: 'success',
                    has_output: true,
                    output_url:
                      'https://circle-production-action-output.s3.amazonaws.com/test-output',
                  },
                ],
              },
            ],
          });
        },
      ),
    );

    const result = await fetchJobDetails(jobInfo, 'test-token-12345');

    expect(capturedToken).toBe('test-token-12345');
    expect(result).toHaveProperty('vcs_url');
    expect(result).toHaveProperty('build_num', 12345);
    expect(result.steps).toBeInstanceOf(Array);
    expect(result.steps?.[0]?.actions?.[0]?.has_output).toBe(true);
  });

  it('should handle unauthorized errors', async () => {
    server.use(errorHandlers.unauthorized);

    const jobInfo: JobUrlInfo = {
      vcsAbbrev: 'gh',
      org: 'test-org',
      repo: 'test-repo',
      jobNumber: '12345',
    };

    await expect(fetchJobDetails(jobInfo, 'invalid-token')).rejects.toThrow(
      'HTTP 401 Unauthorized',
    );
  });

  it('should handle failed job response', async () => {
    server.use(errorHandlers.failedJob);

    const jobInfo: JobUrlInfo = {
      vcsAbbrev: 'gh',
      org: 'test-org',
      repo: 'test-repo',
      jobNumber: '12346',
    };

    const result = await fetchJobDetails(jobInfo, 'test-token');

    expect(result.status).toBe('failed');
    expect(result.outcome).toBe('failed');
    expect(result.steps?.[0]?.actions?.[0]?.status).toBe('failed');
    expect(result.steps?.[0]?.actions?.[0]?.failed).toBe(true);
  });
});

describe('fetchActionOutput', () => {
  it('should fetch action output successfully', async () => {
    const result = await fetchActionOutput(
      'https://circle-production-action-output.s3.amazonaws.com/test-output',
    );

    expect(result).toBeInstanceOf(Array);
    expect(result.length).toBeGreaterThan(0);
    expect(result[0]).toHaveProperty('message');
    expect(result[0]).toHaveProperty('time');
    expect(result[0]).toHaveProperty('type');
  });

  it('should handle empty output', async () => {
    server.use(
      http.get('https://circle-production-action-output.s3.amazonaws.com/:outputId', () => {
        return HttpResponse.json([]);
      }),
    );

    const result = await fetchActionOutput(
      'https://circle-production-action-output.s3.amazonaws.com/empty-output',
    );

    expect(result).toEqual([]);
  });

  it('should handle S3 errors', async () => {
    server.use(
      http.get('https://circle-production-action-output.s3.amazonaws.com/:outputId', () => {
        return new HttpResponse(null, { status: 403, statusText: 'Forbidden' });
      }),
    );

    // fetchActionOutput catches errors and returns error message
    const result = await fetchActionOutput(
      'https://circle-production-action-output.s3.amazonaws.com/forbidden-output',
    );

    expect(result).toHaveLength(1);
    expect(result[0]?.message).toContain('failed to fetch output_url');
    expect(result[0]?.message).toContain('403 Forbidden');
  });

  it('should handle malformed JSON', async () => {
    server.use(
      http.get('https://circle-production-action-output.s3.amazonaws.com/:outputId', () => {
        return new HttpResponse('not valid json', {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }),
    );

    // fetchActionOutput catches errors and returns error message
    const result = await fetchActionOutput(
      'https://circle-production-action-output.s3.amazonaws.com/malformed-output',
    );

    expect(result).toHaveLength(1);
    expect(result[0]?.message).toContain('failed to fetch output_url');
    expect(result[0]?.message).toMatch(/not valid JSON|Unexpected token/);
  });
});
