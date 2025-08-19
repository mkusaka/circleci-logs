#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import packageJson from '../package.json' with { type: 'json' };
import { CLIOptions, LogSegment, LogLine } from './types.js';
import { parseJobUrl, fetchJobDetails, fetchActionOutput } from './circleci.js';
import { filterActions, filterLines } from './filters.js';
import { printHuman, printJson, checkForErrors } from './formatter.js';

export const program = new Command();

program
  .name('circleci-logs')
  .description('Fetch CircleCI job step logs from a gh pr checks URL')
  .version(packageJson.version)
  .argument('<url>', 'CircleCI job URL')
  .option('--errors-only', 'Only show actions with non-success status', false)
  .option('--grep <pattern>', 'Filter log lines with regex pattern')
  .option('--json', 'Output as structured JSON', false)
  .option('--fail-on-error', 'Exit with code 1 if there are error actions', false)
  .option('--token <token>', 'CircleCI Personal Token (defaults to CIRCLE_TOKEN env)')
  .option('--verbose', 'Show verbose output including debug information', false)
  .action(async (url: string) => {
    try {
      const opts = program.opts<Partial<CLIOptions>>();

      // Get token from option or environment
      const token = opts.token ?? process.env.CIRCLE_TOKEN;
      if (!token) {
        console.error(
          chalk.red('Error: CIRCLE_TOKEN is required. Set environment variable or use --token.'),
        );
        process.exit(2);
      }

      // Parse CLI options
      const options: CLIOptions = {
        errorsOnly: opts.errorsOnly ?? false,
        json: opts.json ?? false,
        failOnError: opts.failOnError ?? false,
        grep: opts.grep ? new RegExp(opts.grep) : null,
        token,
        url,
        verbose: opts.verbose ?? false,
      };

      // Parse CircleCI job URL
      const jobInfo = parseJobUrl(url);

      if (options.verbose) {
        console.error(chalk.gray(`Parsed URL: ${JSON.stringify(jobInfo)}`));
      }

      // Fetch job details from CircleCI API
      const job = await fetchJobDetails(jobInfo, token);

      if (options.verbose) {
        console.error(chalk.gray(`Job status: ${job.status}, Steps: ${job.steps?.length ?? 0}`));
      }

      // Process all steps and actions
      const segments: LogSegment[] = [];

      for (const step of job.steps ?? []) {
        const actions = filterActions(step.actions ?? [], options.errorsOnly);

        if (options.verbose && step.actions) {
          console.error(
            chalk.gray(
              `Step "${step.name}": ${step.actions.length} actions, ${actions.length} after filter`,
            ),
          );
        }

        for (const action of actions) {
          let lines: LogLine[] = [];

          // Fetch output if available
          if (action.has_output && action.output_url) {
            const rawLines = await fetchActionOutput(action.output_url);
            lines = filterLines(rawLines, options.grep);
          }

          segments.push({
            step: step.name ?? '(unnamed step)',
            action,
            lines,
          });
        }
      }

      // Output results
      if (options.verbose) {
        console.error(chalk.gray(`Total segments to output: ${segments.length}`));
      }

      if (segments.length === 0 && !options.json) {
        console.log(chalk.yellow('No log output found. This could mean:'));
        console.log('- The job has no steps with output');
        console.log('- All steps were filtered out (try without --errors-only)');
        console.log('- The job is still running or has no logs');
        console.log('\nUse --verbose for more details');
      } else if (options.json) {
        printJson(segments);
      } else {
        printHuman(segments);
      }

      // Exit with error code if requested
      if (options.failOnError && checkForErrors(segments)) {
        process.exit(1);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(chalk.red('Error:'), errorMessage);
      process.exit(1);
    }
  });

// Export for testing/importing
export function run() {
  program.parse(process.argv);

  // Show help if no arguments provided
  if (process.argv.length === 2) {
    program.help();
  }
}

// Only run if this is the main module being executed
// Check if running as generate-docs script
const isGenerateDocs = process.argv[1]?.includes('generate-docs');

if (!isGenerateDocs) {
  run();
}
