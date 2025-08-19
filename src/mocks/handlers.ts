import { http, HttpResponse } from 'msw';

// Realistic CircleCI v1.1 API responses based on official documentation
export const handlers = [
  // CircleCI v1.1 Single Job endpoint
  http.get('https://circleci.com/api/v1.1/project/:vcsAbbrev/:org/:repo/:jobNumber', () => {
    return HttpResponse.json({
      vcs_url: 'https://github.com/test-org/test-repo',
      build_url: 'https://circleci.com/gh/test-org/test-repo/12345',
      build_num: 12345,
      branch: 'main',
      vcs_revision: '1d231626ba1d2838e599c5c598d28e2306ad4e48',
      committer_name: 'Test User',
      committer_email: 'test@example.com',
      subject: 'Fix: Update dependencies',
      body: '',
      why: 'github',
      dont_build: null,
      queued_at: '2024-01-01T10:00:00Z',
      start_time: '2024-01-01T10:00:30Z',
      stop_time: '2024-01-01T10:05:00Z',
      build_time_millis: 270000,
      username: 'test-org',
      reponame: 'test-repo',
      lifecycle: 'finished',
      outcome: 'success',
      status: 'success',
      retry_of: null,
      steps: [
        {
          name: 'Spin up environment',
          actions: [
            {
              index: 0,
              step: 0,
              name: 'Spin up environment',
              bash_command: null,
              type: 'infrastructure',
              source: 'cache',
              status: 'success',
              run_time_millis: 1646,
              start_time: '2024-01-01T10:00:30Z',
              end_time: '2024-01-01T10:00:32Z',
              exit_code: null,
              has_output: true,
              output_url: 'https://circle-production-action-output.s3.amazonaws.com/abc123-test-output?X-Amz-Algorithm=AWS4-HMAC-SHA256',
              truncated: false,
              failed: null,
              infrastructure_fail: null,
              canceled: null,
              timedout: null,
              parallel: false,
              messages: [],
            },
          ],
        },
        {
          name: 'Checkout code',
          actions: [
            {
              index: 0,
              step: 1,
              name: 'Checkout code',
              bash_command: 'git checkout',
              type: 'checkout',
              source: 'config',
              status: 'success',
              run_time_millis: 2310,
              start_time: '2024-01-01T10:00:32Z',
              end_time: '2024-01-01T10:00:34Z',
              exit_code: 0,
              has_output: true,
              output_url: 'https://circle-production-action-output.s3.amazonaws.com/def456-test-output?X-Amz-Algorithm=AWS4-HMAC-SHA256',
              truncated: false,
              failed: null,
              infrastructure_fail: null,
              canceled: null,
              timedout: null,
              parallel: false,
              messages: [],
            },
          ],
        },
        {
          name: 'Run tests',
          actions: [
            {
              index: 0,
              step: 2,
              name: 'npm test',
              bash_command: 'npm test',
              type: 'test',
              source: 'config',
              status: 'failed',
              run_time_millis: 5555,
              start_time: '2024-01-01T10:00:34Z',
              end_time: '2024-01-01T10:00:40Z',
              exit_code: 1,
              has_output: true,
              output_url: 'https://circle-production-action-output.s3.amazonaws.com/ghi789-test-output?X-Amz-Algorithm=AWS4-HMAC-SHA256',
              truncated: false,
              failed: true,
              infrastructure_fail: null,
              canceled: null,
              timedout: null,
              parallel: true,
              messages: [],
            },
          ],
        },
      ],
    });
  }),

  // CircleCI action output endpoints (S3 signed URLs)
  http.get('https://circle-production-action-output.s3.amazonaws.com/:outputId', () => {
    // Return realistic log output as JSON array
    return HttpResponse.json([
      {
        message: '\nStarting container circleci/node:14',
        time: '2024-01-01T10:00:30.123Z',
        type: 'out',
      },
      {
        message: 'image cache not found on this host, downloading circleci/node:14',
        time: '2024-01-01T10:00:30.456Z',
        type: 'out',
      },
      {
        message: '14: Pulling from circleci/node',
        time: '2024-01-01T10:00:31.000Z',
        type: 'out',
      },
      {
        message: 'Digest: sha256:1a2b3c4d5e6f7g8h9i0j',
        time: '2024-01-01T10:00:31.500Z',
        type: 'out',
      },
      {
        message: 'Status: Downloaded newer image for circleci/node:14',
        time: '2024-01-01T10:00:32.000Z',
        type: 'out',
      },
      {
        message: 'Container circleci/node:14 started',
        time: '2024-01-01T10:00:32.100Z',
        type: 'out',
      },
    ]);
  }),
];

// Additional handlers for error scenarios
export const errorHandlers = {
  unauthorized: http.get(
    'https://circleci.com/api/v1.1/project/:vcsAbbrev/:org/:repo/:jobNumber',
    () => {
      return new HttpResponse(null, { status: 401, statusText: 'Unauthorized' });
    },
  ),

  notFound: http.get(
    'https://circleci.com/api/v1.1/project/:vcsAbbrev/:org/:repo/:jobNumber',
    () => {
      return new HttpResponse(null, { status: 404, statusText: 'Not Found' });
    },
  ),

  serverError: http.get(
    'https://circleci.com/api/v1.1/project/:vcsAbbrev/:org/:repo/:jobNumber',
    () => {
      return new HttpResponse(null, { status: 500, statusText: 'Internal Server Error' });
    },
  ),

  // Failed job response
  failedJob: http.get(
    'https://circleci.com/api/v1.1/project/:vcsAbbrev/:org/:repo/:jobNumber',
    () => {
      return HttpResponse.json({
        vcs_url: 'https://github.com/test-org/test-repo',
        build_url: 'https://circleci.com/gh/test-org/test-repo/12346',
        build_num: 12346,
        branch: 'feature/broken',
        lifecycle: 'finished',
        outcome: 'failed',
        status: 'failed',
        steps: [
          {
            name: 'Run tests',
            actions: [
              {
                name: 'npm test',
                type: 'test',
                status: 'failed',
                exit_code: 1,
                has_output: true,
                output_url: 'https://circle-production-action-output.s3.amazonaws.com/failed-test-output',
                failed: true,
              },
            ],
          },
        ],
      });
    },
  ),
};