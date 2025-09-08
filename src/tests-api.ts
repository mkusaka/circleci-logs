import { JobUrlInfo } from './types.js';

export interface TestResult {
  classname?: string;
  file?: string;
  name: string;
  result: 'success' | 'failure' | 'skipped' | 'error';
  message?: string;
  run_time?: number;
  source?: string;
}

export interface TestResultsResponse {
  items: TestResult[];
  next_page_token?: string | null;
}

export interface TestSummary {
  total: number;
  passed: number;
  failed: number;
  skipped: number;
  errors: number;
  duration: number;
}

export interface TestOptions {
  tests?: boolean;
  testsJson?: boolean;
  failedOnly?: boolean;
  failOnTestFailure?: boolean;
  grep?: RegExp | null;
}

/**
 * Convert job URL info to project slug format for v2 API
 */
export function toProjectSlug(jobInfo: JobUrlInfo): string {
  const vcsProvider = jobInfo.vcsAbbrev === 'gh' ? 'github' : 'bitbucket';
  return `${vcsProvider}/${jobInfo.org}/${jobInfo.repo}`;
}

/**
 * Fetch test results from CircleCI v2 API
 */
export async function fetchTestResults(jobInfo: JobUrlInfo, token: string): Promise<TestResult[]> {
  const projectSlug = toProjectSlug(jobInfo);
  const apiUrl = `https://circleci.com/api/v2/project/${projectSlug}/${jobInfo.jobNumber}/tests`;

  const allTests: TestResult[] = [];
  let nextPageToken: string | null = null;

  do {
    const url = nextPageToken
      ? `${apiUrl}?page-token=${encodeURIComponent(nextPageToken)}`
      : apiUrl;

    const response = await fetch(url, {
      headers: {
        'Circle-Token': token,
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        // No test results available for this job
        return [];
      }
      throw new Error(`HTTP ${response.status} ${response.statusText} for ${url}`);
    }

    const data = (await response.json()) as TestResultsResponse;
    allTests.push(...data.items);
    nextPageToken = data.next_page_token ?? null;
  } while (nextPageToken);

  return allTests;
}

/**
 * Filter test results based on options
 */
export function filterTestResults(tests: TestResult[], options: TestOptions): TestResult[] {
  let filtered = tests;

  // Filter by status
  if (options.failedOnly) {
    filtered = filtered.filter((test) => test.result === 'failure' || test.result === 'error');
  }

  // Filter by pattern
  if (options.grep) {
    filtered = filtered.filter((test) => {
      const searchText = `${test.classname || ''} ${test.name} ${test.file || ''}`;
      return options.grep!.test(searchText);
    });
  }

  return filtered;
}

/**
 * Calculate test summary statistics
 */
export function calculateTestSummary(tests: TestResult[]): TestSummary {
  const summary: TestSummary = {
    total: tests.length,
    passed: 0,
    failed: 0,
    skipped: 0,
    errors: 0,
    duration: 0,
  };

  for (const test of tests) {
    switch (test.result) {
      case 'success':
        summary.passed++;
        break;
      case 'failure':
        summary.failed++;
        break;
      case 'skipped':
        summary.skipped++;
        break;
      case 'error':
        summary.errors++;
        break;
    }

    if (test.run_time) {
      summary.duration += test.run_time;
    }
  }

  return summary;
}

/**
 * Check if there are any failed tests
 */
export function hasFailedTests(tests: TestResult[]): boolean {
  return tests.some((test) => test.result === 'failure' || test.result === 'error');
}
