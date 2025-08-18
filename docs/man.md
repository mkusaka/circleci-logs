# circleci-logs(1) -- Fetch CircleCI job step logs from a gh pr checks URL

## SYNOPSIS

`circleci-logs` [OPTIONS] URL

## DESCRIPTION

**circleci-logs** is a command-line tool that fetches and displays step logs from CircleCI jobs.
It can parse both legacy and new CircleCI UI URLs, filter logs by status or pattern,
and output in either human-readable or JSON format.

The tool uses the CircleCI API v1.1 to fetch job details and requires a CircleCI
Personal Token for authentication.

## ARGUMENTS

* `URL`:
  CircleCI job URL
  (`https://circleci.com/gh/org/repo/12345`) and new UI format
  (`https://app.circleci.com/pipelines/github/org/repo/123/workflows/abc/jobs/12345`).

## OPTIONS

* `-V, --version`:
  output the version number

* `--errors-only`:
  Only show actions with non-success status. Filters out all successful steps, displaying only failed, timed out, or errored actions.

* `--grep <pattern>`:
  Filter log lines using a regular expression pattern. Only lines matching the pattern will be displayed. Supports standard JavaScript regex syntax.

* `--json`:
  Output results as structured JSON instead of human-readable format. Useful for piping to other tools or for programmatic processing.

* `--fail-on-error`:
  Exit with code 1 if there are any error actions in the job. Useful for CI/CD pipelines to fail when errors are detected.

* `--token <token>`:
  CircleCI Personal Token for authentication. If not provided, the tool will use the CIRCLE_TOKEN environment variable.

* `--verbose`:
  Show verbose output including debug information

* `-h`, `--help`:
  Display help information and exit.

* `-V`, `--version`:
  Display version information and exit.

## ENVIRONMENT

* `CIRCLE_TOKEN`:
  CircleCI Personal Token used for API authentication.
  This token is required to fetch job details from CircleCI.

## EXIT CODES

* `0`: Successful execution (or no errors found when using --fail-on-error).
* `1`: Errors found in job when using --fail-on-error, or general execution error.
* `2`: Invalid command line arguments or missing required token.

## EXAMPLES

Fetch all logs from a CircleCI job:

    $ export CIRCLE_TOKEN=xxxxx
    $ circleci-logs "https://circleci.com/gh/org/repo/12345"

Show only failed actions:

    $ circleci-logs --errors-only "https://circleci.com/gh/org/repo/12345"

Filter logs for ERROR or WARNING messages:

    $ circleci-logs --grep "ERROR|WARN" "https://circleci.com/gh/org/repo/12345"

Output as JSON for further processing:

    $ circleci-logs --json "https://circleci.com/gh/org/repo/12345" | jq '.'

Integration with GitHub CLI to fetch logs from latest PR check:

    $ gh pr checks --json link -q '.[].link' | head -n1 | \
      xargs -n1 circleci-logs --errors-only

Use in CI pipeline to fail on errors:

    $ circleci-logs --fail-on-error --errors-only "$BUILD_URL"

## REQUIREMENTS

Node.js >= 22.18.0

CircleCI Personal Token with appropriate permissions

## API DETAILS

The tool uses CircleCI API v1.1 with the following workflow:

1. Parse the CircleCI job URL to extract organization, repository, and job number
2. Call `/api/v1.1/project/{vcs}/{org}/{repo}/{job_number}` with authentication
3. For each step action with output, fetch logs from the `output_url` (signed URL)
4. Apply filters and format the output

## BUGS

Report bugs at: <https://github.com/mkusaka/circleci-logs/issues>

## AUTHOR

Written by the circleci-logs contributors.

## COPYRIGHT

Copyright (C) 2025. MIT License.

This is free software: you are free to change and redistribute it.
There is NO WARRANTY, to the extent permitted by law.

## SEE ALSO

gh(1), jq(1), grep(1)

Full documentation at: <https://github.com/mkusaka/circleci-logs>