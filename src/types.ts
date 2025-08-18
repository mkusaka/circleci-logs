export interface CLIOptions {
  errorsOnly: boolean;
  json: boolean;
  failOnError: boolean;
  grep: RegExp | null;
  token: string | null;
  url: string;
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
}

export interface CircleCIStep {
  name?: string;
  actions?: CircleCIAction[];
}

export interface CircleCIJob {
  steps?: CircleCIStep[];
  status?: string;
  build_num?: number;
  vcs_revision?: string;
  branch?: string;
  subject?: string;
  why?: string;
  user?: {
    login?: string;
    name?: string;
  };
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
