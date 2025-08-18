# circleci-logs

[![CI](https://github.com/mkusaka/circleci-logs/actions/workflows/ci.yml/badge.svg)](https://github.com/mkusaka/circleci-logs/actions/workflows/ci.yml)
[![npm version](https://badge.fury.io/js/circleci-logs.svg)](https://badge.fury.io/js/circleci-logs)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Fetch CircleCI job step logs from GitHub PR checks URLs. Lightweight CLI tool with TypeScript support and minimal dependencies.

## Requirements

- Node.js >= 22.18.0
- CircleCI Personal Token

## Installation

```bash
# Install dependencies
pnpm install

# Build the project
pnpm run build

# Create a global link (optional)
pnpm link --global
```

## Usage

### Basic Usage

```bash
# Set your CircleCI Personal Token
export CIRCLE_TOKEN=xxxxx

# Fetch all logs from a CircleCI job URL
circleci-logs "https://circleci.com/gh/org/repo/12345"

# Or use the new UI URL format
circleci-logs "https://app.circleci.com/pipelines/github/org/repo/123/workflows/abc/jobs/12345"
```

### Options

```bash
# Show only failed actions
circleci-logs --errors-only "https://circleci.com/gh/org/repo/12345"

# Filter logs with regex pattern
circleci-logs --grep "ERROR|WARN" "https://circleci.com/gh/org/repo/12345"

# Output as JSON
circleci-logs --json "https://circleci.com/gh/org/repo/12345"

# Exit with code 1 if there are errors
circleci-logs --fail-on-error "https://circleci.com/gh/org/repo/12345"

# Use a specific token (instead of env variable)
circleci-logs --token "your-token" "https://circleci.com/gh/org/repo/12345"
```

### Integration with GitHub CLI

```bash
# Get the latest PR check URL and fetch its logs
gh pr checks --json link -q '.[].link' | head -n1 | xargs -n1 circleci-logs

# With error filtering
gh pr checks --json link -q '.[].link' | head -n1 | xargs -n1 circleci-logs --errors-only
```

## Development

```bash
# Run in development mode
pnpm run dev <url>

# Type checking
pnpm run typecheck

# Linting
pnpm run lint

# Format code
pnpm run format
```

## API Details

This tool uses CircleCI API v1.1 to fetch job details. The flow is:

1. Parse the CircleCI job URL to extract org, repo, and job number
2. Call `/api/v1.1/project/{vcs}/{org}/{repo}/{job_number}` with your CircleCI token
3. For each step action with output, fetch logs from the `output_url` (signed URL, no auth required)
4. Apply filters and format the output

## License

MIT