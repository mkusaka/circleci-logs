#!/usr/bin/env tsx

import { writeFileSync } from 'fs';
import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import { program } from '../src/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Extract metadata from the actual CLI program
const name = program.name();
const description = program.description();
const version = program.version();
const args = program.registeredArguments || [];
const options = program.options;

// Generate Markdown documentation
function generateMarkdown(): string {
  const md = [];

  // Header
  md.push(`# ${name}(1) -- ${description}`);
  md.push('');

  // Synopsis
  md.push('## SYNOPSIS');
  md.push('');
  // Handle different argument formats
  const argsStr =
    args.length > 0
      ? args
          .map((a) => {
            // Handle both object and string formats
            const argName = a._name || a.name || 'ARG';
            const isRequired = a.required !== false;
            return isRequired ? argName.toUpperCase() : `[${argName.toUpperCase()}]`;
          })
          .join(' ')
      : 'URL';
  md.push(`\`${name}\` [OPTIONS] ${argsStr}`);
  md.push('');

  // Description
  md.push('## DESCRIPTION');
  md.push('');
  md.push(
    `**${name}** is a command-line tool that fetches and displays step logs from CircleCI jobs.`,
  );
  md.push('It can parse both legacy and new CircleCI UI URLs, filter logs by status or pattern,');
  md.push('and output in either human-readable or JSON format.');
  md.push('');
  md.push('The tool uses the CircleCI API v1.1 to fetch job details and requires a CircleCI');
  md.push('Personal Token for authentication.');
  md.push('');

  // Arguments
  if (args.length > 0) {
    md.push('## ARGUMENTS');
    md.push('');
    args.forEach((arg) => {
      const argName = arg._name || arg.name || 'url';
      md.push(`* \`${argName.toUpperCase()}\`:`);
      const argDesc = arg.description || 'CircleCI job URL';
      md.push(`  ${argDesc}`);
      if (argName.toLowerCase() === 'url') {
        md.push('  (`https://circleci.com/gh/org/repo/12345`) and new UI format');
        md.push(
          '  (`https://app.circleci.com/pipelines/github/org/repo/123/workflows/abc/jobs/12345`).',
        );
      }
      md.push('');
    });
  }

  // Options
  md.push('## OPTIONS');
  md.push('');

  // Add detailed option descriptions
  const optionDetails = {
    '--errors-only':
      'Only show actions with non-success status. Filters out all successful steps, displaying only failed, timed out, or errored actions.',
    '--grep':
      'Filter log lines using a regular expression pattern. Only lines matching the pattern will be displayed. Supports standard JavaScript regex syntax.',
    '--json':
      'Output results as structured JSON instead of human-readable format. Useful for piping to other tools or for programmatic processing.',
    '--fail-on-error':
      'Exit with code 1 if there are any error actions in the job. Useful for CI/CD pipelines to fail when errors are detected.',
    '--token':
      'CircleCI Personal Token for authentication. If not provided, the tool will use the CIRCLE_TOKEN environment variable.',
  };

  options.forEach((opt) => {
    const flag = opt.flags.split(',')[0]?.trim();
    const longFlag = opt.long;
    const desc = optionDetails[longFlag] || opt.description;

    md.push(`* \`${opt.flags}\`:`);
    md.push(`  ${desc}`);
    md.push('');
  });

  // Help and version
  md.push(`* \`-h\`, \`--help\`:`);
  md.push(`  Display help information and exit.`);
  md.push('');
  md.push(`* \`-V\`, \`--version\`:`);
  md.push(`  Display version information and exit.`);
  md.push('');

  // Environment
  md.push('## ENVIRONMENT');
  md.push('');
  md.push('* `CIRCLE_TOKEN`:');
  md.push('  CircleCI Personal Token used for API authentication.');
  md.push('  This token is required to fetch job details from CircleCI.');
  md.push('');

  // Exit codes
  md.push('## EXIT CODES');
  md.push('');
  md.push('* `0`: Successful execution (or no errors found when using --fail-on-error).');
  md.push('* `1`: Errors found in job when using --fail-on-error, or general execution error.');
  md.push('* `2`: Invalid command line arguments or missing required token.');
  md.push('');

  // Examples
  md.push('## EXAMPLES');
  md.push('');
  md.push('Fetch all logs from a CircleCI job:');
  md.push('');
  md.push('    $ export CIRCLE_TOKEN=xxxxx');
  md.push('    $ circleci-logs "https://circleci.com/gh/org/repo/12345"');
  md.push('');
  md.push('Show only failed actions:');
  md.push('');
  md.push('    $ circleci-logs --errors-only "https://circleci.com/gh/org/repo/12345"');
  md.push('');
  md.push('Filter logs for ERROR or WARNING messages:');
  md.push('');
  md.push('    $ circleci-logs --grep "ERROR|WARN" "https://circleci.com/gh/org/repo/12345"');
  md.push('');
  md.push('Output as JSON for further processing:');
  md.push('');
  md.push('    $ circleci-logs --json "https://circleci.com/gh/org/repo/12345" | jq \'.\'');
  md.push('');
  md.push('Integration with GitHub CLI to fetch logs from latest PR check:');
  md.push('');
  md.push("    $ gh pr checks --json link -q '.[].link' | head -n1 | \\");
  md.push('      xargs -n1 circleci-logs --errors-only');
  md.push('');
  md.push('Use in CI pipeline to fail on errors:');
  md.push('');
  md.push('    $ circleci-logs --fail-on-error --errors-only "$BUILD_URL"');
  md.push('');

  // Requirements
  md.push('## REQUIREMENTS');
  md.push('');
  md.push('Node.js >= 22.18.0');
  md.push('');
  md.push('CircleCI Personal Token with appropriate permissions');
  md.push('');

  // API Details
  md.push('## API DETAILS');
  md.push('');
  md.push('The tool uses CircleCI API v1.1 with the following workflow:');
  md.push('');
  md.push('1. Parse the CircleCI job URL to extract organization, repository, and job number');
  md.push('2. Call `/api/v1.1/project/{vcs}/{org}/{repo}/{job_number}` with authentication');
  md.push('3. For each step action with output, fetch logs from the `output_url` (signed URL)');
  md.push('4. Apply filters and format the output');
  md.push('');

  // Footer
  md.push('## BUGS');
  md.push('');
  md.push('Report bugs at: <https://github.com/mkusaka/circleci-logs/issues>');
  md.push('');
  md.push('## AUTHOR');
  md.push('');
  md.push('Written by the circleci-logs contributors.');
  md.push('');
  md.push('## COPYRIGHT');
  md.push('');
  md.push('Copyright (C) 2025. MIT License.');
  md.push('');
  md.push('This is free software: you are free to change and redistribute it.');
  md.push('There is NO WARRANTY, to the extent permitted by law.');
  md.push('');
  md.push('## SEE ALSO');
  md.push('');
  md.push('gh(1), jq(1), grep(1)');
  md.push('');
  md.push('Full documentation at: <https://github.com/mkusaka/circleci-logs>');

  return md.join('\n');
}

// Main execution
const projectRoot = path.resolve(__dirname, '..');
const docsDir = path.join(projectRoot, 'docs');
const manDir = path.join(projectRoot, 'man');

// Generate markdown
const markdown = generateMarkdown();
const mdPath = path.join(docsDir, 'man.md');
writeFileSync(mdPath, markdown);
console.log(`✅ Generated: ${mdPath}`);

// Generate man page using marked-man
try {
  const manPath = path.join(manDir, 'circleci-logs.1');
  execSync(`npx marked-man ${mdPath} > ${manPath}`, { cwd: projectRoot });
  console.log(`✅ Generated: ${manPath}`);
} catch (error) {
  console.error('Failed to generate man page:', error);
  process.exit(1);
}
