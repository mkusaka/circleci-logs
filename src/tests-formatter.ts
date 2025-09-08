import chalk from 'chalk';
import { TestResult, TestSummary } from './tests-api.js';

/**
 * Format test results in human-readable format
 */
export function printTestResults(
  tests: TestResult[],
  summary: TestSummary,
  options: { failedOnly?: boolean },
): void {
  // Header
  const status = summary.failed > 0 || summary.errors > 0 ? 'failed' : 'success';
  const statusColor = status === 'failed' ? chalk.red : chalk.green;

  console.log(
    chalk.bold.blue('## ') +
      chalk.cyan('[Test Results] ') +
      chalk.white('Test Suite') +
      '  ' +
      statusColor(`[${status}]`),
  );
  console.log();

  // Show failed/error tests first
  const failedTests = tests.filter((t) => t.result === 'failure' || t.result === 'error');
  const passedTests = tests.filter((t) => t.result === 'success');
  const skippedTests = tests.filter((t) => t.result === 'skipped');

  // Display failed tests with details
  for (const test of failedTests) {
    printFailedTest(test);
  }

  // Display passed tests (only if not --failed-only)
  if (!options.failedOnly && passedTests.length > 0) {
    console.log(chalk.green('\n✓ Passed Tests:'));
    for (const test of passedTests) {
      printPassedTest(test);
    }
  }

  // Display skipped tests (only if not --failed-only)
  if (!options.failedOnly && skippedTests.length > 0) {
    console.log(chalk.gray('\n⊘ Skipped Tests:'));
    for (const test of skippedTests) {
      printSkippedTest(test);
    }
  }

  // Summary
  console.log();
  printSummary(summary);
}

function printFailedTest(test: TestResult): void {
  console.log(chalk.red(`✗ FAIL: ${test.file || 'unknown'}`));

  if (test.classname) {
    console.log(`  ${chalk.gray('Class:')} ${test.classname}`);
  }

  console.log(`  ${chalk.gray('Test:')}  ${test.name}`);

  if (test.run_time !== undefined) {
    console.log(`  ${chalk.gray('Time:')}  ${test.run_time.toFixed(3)}s`);
  }

  if (test.message) {
    console.log();
    // Format the error message with proper indentation
    const lines = test.message.split('\n');
    for (const line of lines) {
      console.log(`  ${line}`);
    }
  }

  console.log();
}

function printPassedTest(test: TestResult): void {
  const fileName = test.file ? test.file.split('/').pop() : 'unknown';
  const time = test.run_time ? ` (${test.run_time.toFixed(3)}s)` : '';
  console.log(`  ✓ ${fileName}: ${test.name}${time}`);
}

function printSkippedTest(test: TestResult): void {
  const fileName = test.file ? test.file.split('/').pop() : 'unknown';
  console.log(`  ⊘ ${fileName}: ${test.name}`);
}

function printSummary(summary: TestSummary): void {
  const parts: string[] = [];

  if (summary.passed > 0) {
    parts.push(chalk.green(`${summary.passed} passed`));
  }

  if (summary.failed > 0) {
    parts.push(chalk.red(`${summary.failed} failed`));
  }

  if (summary.errors > 0) {
    parts.push(chalk.red(`${summary.errors} errors`));
  }

  if (summary.skipped > 0) {
    parts.push(chalk.gray(`${summary.skipped} skipped`));
  }

  const summaryText = parts.join(', ');
  const duration = `(${summary.duration.toFixed(3)}s)`;

  console.log(chalk.bold(`Summary: ${summaryText} ${chalk.gray(duration)}`));
}

/**
 * Output test results as JSON
 */
export function printTestResultsJson(tests: TestResult[], summary: TestSummary): void {
  console.log(
    JSON.stringify(
      {
        tests,
        summary,
      },
      null,
      2,
    ),
  );
}
