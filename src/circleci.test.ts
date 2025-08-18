import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { parseJobUrl, fetchJson, fetchJobDetails, fetchActionOutput } from './circleci.js';
import type { JobUrlInfo } from './types.js';

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
    const url = 'https://circleci.com/bb/org-name/repo-name/67890';
    const result = parseJobUrl(url);
    expect(result).toEqual({
      vcsAbbrev: 'bb',
      org: 'org-name',
      repo: 'repo-name',
      jobNumber: '67890',
    });
  });

  it('should parse new CircleCI UI URL format (github)', () => {
    const url =
      'https://app.circleci.com/pipelines/github/org-name/repo-name/123/workflows/abc/jobs/45678';
    const result = parseJobUrl(url);
    expect(result).toEqual({
      vcsAbbrev: 'gh',
      org: 'org-name',
      repo: 'repo-name',
      jobNumber: '45678',
    });
  });

  it('should parse new CircleCI UI URL format (bitbucket)', () => {
    const url =
      'https://app.circleci.com/pipelines/bitbucket/org-name/repo-name/123/workflows/abc/jobs/45678';
    const result = parseJobUrl(url);
    expect(result).toEqual({
      vcsAbbrev: 'bb',
      org: 'org-name',
      repo: 'repo-name',
      jobNumber: '45678',
    });
  });

  it('should handle URLs with query parameters', () => {
    const url = 'https://circleci.com/gh/org-name/repo-name/12345?tab=tests';
    const result = parseJobUrl(url);
    expect(result).toEqual({
      vcsAbbrev: 'gh',
      org: 'org-name',
      repo: 'repo-name',
      jobNumber: '12345',
    });
  });

  it('should handle URLs with hash fragments', () => {
    const url = 'https://circleci.com/gh/org-name/repo-name/12345#step-1';
    const result = parseJobUrl(url);
    expect(result).toEqual({
      vcsAbbrev: 'gh',
      org: 'org-name',
      repo: 'repo-name',
      jobNumber: '12345',
    });
  });

  it('should throw error for unsupported URL format', () => {
    const url = 'https://example.com/invalid/url';
    expect(() => parseJobUrl(url)).toThrow('Unsupported CircleCI job URL format');
  });

  it('should handle orgs and repos with special characters', () => {
    const url = 'https://circleci.com/gh/my-org_123/repo.name-456/78901';
    const result = parseJobUrl(url);
    expect(result).toEqual({
      vcsAbbrev: 'gh',
      org: 'my-org_123',
      repo: 'repo.name-456',
      jobNumber: '78901',
    });
  });
});

describe('fetchJson', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should fetch and parse JSON successfully', async () => {
    const mockData = { test: 'data' };
    const mockResponse = {
      ok: true,
      json: vi.fn().mockResolvedValue(mockData),
    };
    vi.mocked(fetch).mockResolvedValue(mockResponse as any);

    const result = await fetchJson('https://api.example.com/data');
    expect(result).toEqual(mockData);
    expect(fetch).toHaveBeenCalledWith('https://api.example.com/data', { headers: {} });
  });

  it('should include custom headers', async () => {
    const mockData = { test: 'data' };
    const mockResponse = {
      ok: true,
      json: vi.fn().mockResolvedValue(mockData),
    };
    vi.mocked(fetch).mockResolvedValue(mockResponse as any);

    const headers = { Authorization: 'Bearer token123' };
    await fetchJson('https://api.example.com/data', headers);
    expect(fetch).toHaveBeenCalledWith('https://api.example.com/data', { headers });
  });

  it('should throw error for non-OK response', async () => {
    const mockResponse = {
      ok: false,
      status: 404,
      statusText: 'Not Found',
    };
    vi.mocked(fetch).mockResolvedValue(mockResponse as any);

    await expect(fetchJson('https://api.example.com/data')).rejects.toThrow(
      'HTTP 404 Not Found for https://api.example.com/data',
    );
  });
});

describe('fetchJobDetails', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should fetch job details with correct URL and token', async () => {
    const mockJob = {
      steps: [
        {
          name: 'Test Step',
          actions: [
            {
              name: 'Test Action',
              status: 'success',
            },
          ],
        },
      ],
    };

    const mockResponse = {
      ok: true,
      json: vi.fn().mockResolvedValue(mockJob),
    };
    vi.mocked(fetch).mockResolvedValue(mockResponse as any);

    const jobInfo: JobUrlInfo = {
      vcsAbbrev: 'gh',
      org: 'test-org',
      repo: 'test-repo',
      jobNumber: '12345',
    };

    const result = await fetchJobDetails(jobInfo, 'test-token');

    expect(result).toEqual(mockJob);
    expect(fetch).toHaveBeenCalledWith(
      'https://circleci.com/api/v1.1/project/gh/test-org/test-repo/12345',
      {
        headers: {
          'Circle-Token': 'test-token',
        },
      },
    );
  });
});

describe('fetchActionOutput', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should fetch action output successfully', async () => {
    const mockOutput = [
      { message: 'Line 1', time: '2024-01-01T00:00:00Z' },
      { message: 'Line 2', time: '2024-01-01T00:00:01Z' },
    ];

    const mockResponse = {
      ok: true,
      json: vi.fn().mockResolvedValue(mockOutput),
    };
    vi.mocked(fetch).mockResolvedValue(mockResponse as any);

    const result = await fetchActionOutput('https://output.url/signed');

    expect(result).toEqual(mockOutput);
    expect(fetch).toHaveBeenCalledWith('https://output.url/signed', { headers: {} });
  });

  it('should return error message on fetch failure', async () => {
    vi.mocked(fetch).mockRejectedValue(new Error('Network error'));

    const result = await fetchActionOutput('https://output.url/signed');

    expect(result).toEqual([{ message: '(failed to fetch output_url: Network error)' }]);
  });

  it('should handle non-Error exceptions', async () => {
    vi.mocked(fetch).mockRejectedValue('Unknown error');

    const result = await fetchActionOutput('https://output.url/signed');

    expect(result).toEqual([{ message: '(failed to fetch output_url: Unknown error)' }]);
  });
});
