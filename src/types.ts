export interface CLIOptions {
  errorsOnly: boolean;
  json: boolean;
  failOnError: boolean;
  grep: RegExp | null;
  token: string | null;
  url: string;
  verbose: boolean;
}

export interface JobUrlInfo {
  vcsAbbrev: string;
  org: string;
  repo: string;
  jobNumber: string;
}

export interface CircleCIAction {
  name?: string;
  status?: string;
  has_output?: boolean;
  output_url?: string;
  type?: string;
  index?: number;
  background?: boolean;
  exit_code?: number | null;
  start_time?: string;
  end_time?: string;
  run_time_millis?: number;
  failed?: boolean | null;
  infrastructure_fail?: boolean | null;
  canceled?: boolean | null;
  timedout?: boolean | null;
  parallel?: boolean;
  messages?: any[];
  source?: string;
  bash_command?: string | null;
  truncated?: boolean;
  step?: number;
}

export interface CircleCIStep {
  name?: string;
  actions?: CircleCIAction[];
}

export interface CircleCIJob {
  steps?: CircleCIStep[];
  status?: string;
  outcome?: string;
  lifecycle?: string;
  build_num?: number;
  vcs_revision?: string;
  branch?: string;
  subject?: string;
  why?: string;
  user?: {
    login?: string;
    name?: string;
  };
  vcs_url?: string;
  build_url?: string;
  username?: string;
  reponame?: string;
  queued_at?: string;
  start_time?: string;
  stop_time?: string;
  build_time_millis?: number;
  committer_name?: string;
  committer_email?: string;
  body?: string;
  dont_build?: any;
  retry_of?: any;
}

export interface LogLine {
  message?: string;
  time?: string;
  timestamp?: string;
  type?: string;
}

export interface LogSegment {
  step: string;
  action: CircleCIAction;
  lines: LogLine[];
}
