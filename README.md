# circleci-logs

[![CI](https://github.com/mkusaka/circleci-logs/actions/workflows/ci.yml/badge.svg)](https://github.com/mkusaka/circleci-logs/actions/workflows/ci.yml)
[![npm version](https://badge.fury.io/js/circleci-logs.svg)](https://badge.fury.io/js/circleci-logs)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Fetch CircleCI job step logs from GitHub PR checks URLs. Lightweight CLI tool with TypeScript support and minimal dependencies.

## Requirements

- Node.js >= 22.18.0
- CircleCI Personal Token

## Installation

### Global Install (Recommended)

```bash
# Install globally from npm
npm i -g circleci-logs

# Or using pnpm
pnpm add -g circleci-logs
```

### Local Development

```bash
# Clone the repository
git clone https://github.com/mkusaka/circleci-logs.git
cd circleci-logs

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

#### Basic Integration

```bash
# Get the latest PR check URL and fetch its logs
gh pr checks --json link -q '.[].link' | head -n1 | xargs -n1 circleci-logs

# Show only error actions from the latest check
gh pr checks --json link -q '.[].link' | head -n1 | xargs -n1 circleci-logs --errors-only
```

#### Advanced: Filter Failed Checks Only

```bash
# Get logs only from FAILED CircleCI checks
gh pr checks --json state,link,name -q '.[] | select(.state=="FAILURE") | select(.name | contains("circleci")) | .link' | \
  xargs -n1 circleci-logs --errors-only

# Process all failed checks (not just CircleCI)
gh pr checks --json state,link -q '.[] | select(.state=="FAILURE") | .link' | \
  while read url; do
    echo "Processing failed check: $url"
    circleci-logs --errors-only "$url"
  done

# Get logs from specific workflow by name
gh pr checks --json name,link -q '.[] | select(.name | contains("build")) | .link' | \
  xargs -n1 circleci-logs
```

#### Check States Reference

GitHub PR checks can have these states:
- `SUCCESS` - Check passed
- `FAILURE` - Check failed
- `PENDING` - Check is still running
- `NEUTRAL` - Check completed with neutral result
- `CANCELLED` - Check was cancelled
- `SKIPPED` - Check was skipped
- `TIMED_OUT` - Check timed out

#### Useful Combinations

```bash
# Get summary of all failed checks with their error logs
gh pr checks --json state,name,link -q '.[] | select(.state=="FAILURE")' | \
  jq -r '"\(.name): \(.link)"' | \
  while IFS=': ' read name url; do
    echo "=== $name ==="
    if [[ "$url" == *"circleci.com"* ]]; then
      circleci-logs --errors-only "$url" | head -20
    fi
  done

# Check if any CircleCI jobs failed and get their logs
if gh pr checks --json state,name -q '.[] | select(.state=="FAILURE") | select(.name | contains("circleci"))' | jq -e '.' > /dev/null; then
  echo "CircleCI checks failed. Fetching error logs..."
  gh pr checks --json state,link,name -q '.[] | select(.state=="FAILURE") | select(.name | contains("circleci")) | .link' | \
    xargs -n1 circleci-logs --errors-only
fi
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

## LLM Usage

### Prompt Examples for AI Assistants

When using this tool with AI assistants (Claude, ChatGPT, etc.), you can use these prompts:

#### Primary Use Case: Check Failed PR CI
```
Check if my PR has any failing CircleCI checks and show me the error logs.

# Prerequisites: CIRCLE_TOKEN must be set in environment
# User should run: export CIRCLE_TOKEN=your-token-here

Steps:
1. First check PR status: gh pr checks --json state,name,link
2. If there are FAILURE states, get their logs:
   gh pr checks --json state,link,name -q '.[] | select(.state=="FAILURE") | select(.name | contains("circleci")) | .link' | xargs -n1 circleci-logs --errors-only
```

#### Quick Debug Failed CI
```
My PR CI is failing. Show me what's wrong.

# Prerequisites: CIRCLE_TOKEN environment variable must be set

Run:
gh pr checks --json state,link,name -q '.[] | select(.state=="FAILURE") | .link' | head -1 | xargs circleci-logs --errors-only

This will show error logs from the first failed check.
```

#### Comprehensive CI Analysis
```
Analyze all failed CircleCI checks in my PR and summarize the issues.

# Prerequisites: CIRCLE_TOKEN environment variable required

Commands to run:
1. List all failed checks:
   gh pr checks --json state,name,link -q '.[] | select(.state=="FAILURE")'

2. Get error logs from each failed CircleCI check:
   gh pr checks --json state,link,name -q '.[] | select(.state=="FAILURE") | select(.name | contains("circleci")) | .link' | while read url; do
     echo "=== Checking $url ==="
     circleci-logs --errors-only "$url" | head -30
   done

3. Search for specific error patterns:
   # For critical errors only (less noise):
   gh pr checks --json state,link,name -q '.[] | select(.state=="FAILURE") | select(.name | contains("circleci")) | .link' | head -1 | xargs circleci-logs --grep "ERROR|FAILED|FATAL"
   
   # For comprehensive error search (may include more context):
   gh pr checks --json state,link,name -q '.[] | select(.state=="FAILURE") | select(.name | contains("circleci")) | .link' | head -1 | xargs circleci-logs --grep -i "error|fail|timeout"

Then provide:
- Summary of which checks failed
- Key error messages found
- Suggested fixes
```

#### Direct URL Analysis
```
Analyze this specific CircleCI job that's failing:
URL: https://circleci.com/gh/org/repo/12345

# Prerequisites: CIRCLE_TOKEN must be set

Run these diagnostics:
1. circleci-logs --errors-only "[URL]" | head -50
2. circleci-logs --grep "ERROR|FAILED|FATAL|error|failed|timeout" "[URL]" 
3. circleci-logs --verbose "[URL]" 2>&1 | grep -E "Job status|Steps:"

Identify the root cause and suggest fixes.
```

### Tips for LLM Integration

1. **Set CIRCLE_TOKEN as environment variable** - Never include tokens directly in prompts
   ```bash
   export CIRCLE_TOKEN=your-token-here  # Set this once in your terminal
   ```
2. **Use --json for structured analysis** - Easier for LLMs to parse and analyze
3. **Combine with jq** - For complex JSON filtering and analysis
4. **Use --errors-only first** - To quickly identify problem areas
5. **Use --grep with patterns** - To search for specific error types
6. **Alternative: Use --token flag only when necessary** - If you must pass token inline, use the --token flag instead of environment variable

### Security Note

When sharing logs with LLMs:
- Review logs for sensitive information before sharing
- Consider using `--grep` to filter only relevant error messages
- Use private/local LLMs for sensitive codebases

## License

MIT