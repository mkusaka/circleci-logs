import { Command } from 'commander';
import chalk from 'chalk';
import { parseJobUrl } from '../circleci.js';
import {
  fetchTestResults,
  filterTestResults,
  calculateTestSummary,
  hasFailedTests,
  TestOptions,
} from '../tests-api.js';
import { printTestResults, printTestResultsJson } from '../tests-formatter.js';

export function createTestsCommand(): Command {
  const testsCommand = new Command('tests');

  testsCommand
    .description('Fetch and display test results from CircleCI v2 API')
    .argument('<url>', 'CircleCI job URL')
    .option('--json', 'Output test results as JSON', false)
    .option('--failed-only', 'Only show failed tests', false)
    .option('--grep <pattern>', 'Filter tests by regex pattern')
    .option('--fail-on-test-failure', 'Exit with code 1 if there are failed tests', false)
    .option('--token <token>', 'CircleCI Personal Token (defaults to CIRCLE_TOKEN env)')
    .option('--verbose', 'Show verbose output including debug information', false)
    .action(async (url: string) => {
      const opts = testsCommand.opts();

      // Get token from option or environment
      const token = opts.token ?? process.env.CIRCLE_TOKEN;
      if (!token) {
        console.error(
          chalk.red('Error: CIRCLE_TOKEN is required. Set environment variable or use --token.'),
        );
        process.exit(2);
      }

      try {
        // Parse CircleCI job URL
        const jobInfo = parseJobUrl(url);

        if (opts.verbose) {
          console.error(chalk.gray(`Parsed URL: ${JSON.stringify(jobInfo)}`));
          console.error(chalk.gray('Fetching test results from v2 API...'));
        }

        // Fetch test results
        const testResults = await fetchTestResults(jobInfo, token);

        if (opts.verbose) {
          console.error(chalk.gray(`Found ${testResults.length} test results`));
        }

        // Create test options
        const testOptions: TestOptions = {
          failedOnly: opts.failedOnly,
          grep: opts.grep ? new RegExp(opts.grep) : null,
        };

        // Filter and calculate summary
        const filteredTests = filterTestResults(testResults, testOptions);
        const summary = calculateTestSummary(filteredTests);

        // Output results
        if (opts.json) {
          printTestResultsJson(filteredTests, summary);
        } else {
          if (filteredTests.length === 0) {
            console.log(chalk.yellow('No test results found. This could mean:'));
            console.log('- The job has no test results stored');
            console.log('- Tests were not configured to store results in CircleCI');
            console.log('- All tests were filtered out (try without --failed-only)');
            console.log('\nMake sure your CircleCI config uses store_test_results');
          } else {
            printTestResults(filteredTests, summary, { failedOnly: opts.failedOnly });
          }
        }

        // Exit with error code if requested
        if (opts.failOnTestFailure && hasFailedTests(filteredTests)) {
          process.exit(1);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(chalk.red('Error:'), errorMessage);
        process.exit(1);
      }
    });

  return testsCommand;
}
