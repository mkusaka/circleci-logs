import { JobUrlInfo, CircleCIJob, LogLine } from './types.js';

export function parseJobUrl(url: string): JobUrlInfo {
  // Legacy format: https://circleci.com/gh/<org>/<repo>/<build_num>
  let match = url.match(/^https?:\/\/circleci\.com\/(gh|bb)\/([^/]+)\/([^/]+)\/(\d+)(?:$|[/?#])/);
  if (match) {
    return {
      vcsAbbrev: match[1]!,
      org: match[2]!,
      repo: match[3]!,
      jobNumber: match[4]!,
    };
  }

  // New UI format: https://app.circleci.com/pipelines/github/<org>/<repo>/.../jobs/<job_number>
  match = url.match(
    /^https?:\/\/app\.circleci\.com\/pipelines\/(github|bitbucket)\/([^/]+)\/([^/]+)\/.*\/jobs\/(\d+)(?:$|[/?#])/,
  );
  if (match) {
    const vcsMap: Record<string, string> = {
      github: 'gh',
      bitbucket: 'bb',
    };
    return {
      vcsAbbrev: vcsMap[match[1]!] ?? 'gh',
      org: match[2]!,
      repo: match[3]!,
      jobNumber: match[4]!,
    };
  }

  throw new Error(`Unsupported CircleCI job URL format: ${url}`);
}

export async function fetchJson<T = any>(
  url: string,
  headers: Record<string, string> = {},
): Promise<T> {
  const response = await fetch(url, { headers });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} ${response.statusText} for ${url}`);
  }
  return (await response.json()) as T;
}

export async function fetchJobDetails(jobInfo: JobUrlInfo, token: string): Promise<CircleCIJob> {
  const { vcsAbbrev, org, repo, jobNumber } = jobInfo;
  const jobApiUrl = `https://circleci.com/api/v1.1/project/${vcsAbbrev}/${org}/${repo}/${jobNumber}`;

  return await fetchJson<CircleCIJob>(jobApiUrl, {
    'Circle-Token': token,
  });
}

export async function fetchActionOutput(outputUrl: string): Promise<LogLine[]> {
  try {
    // output_url is a signed URL, no additional headers required
    const data = await fetchJson<LogLine[]>(outputUrl);
    return data;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return [{ message: `(failed to fetch output_url: ${errorMessage})` }];
  }
}
