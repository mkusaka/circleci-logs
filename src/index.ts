import { Command } from 'commander';
import packageJson from '../package.json' with { type: 'json' };
import { createTestsCommand } from './commands/tests.js';
import { createLogsCommand } from './commands/logs.js';

export const program = new Command();

program
  .name('circleci-logs')
  .description('Fetch CircleCI job logs and test results')
  .version(packageJson.version)
  .allowUnknownOption(true);

// Add subcommands
program.addCommand(createLogsCommand());
program.addCommand(createTestsCommand());

// For backward compatibility: support direct URL as first argument
// Check if first argument is a URL before commander processes it
const firstArg = process.argv[2];
if (firstArg && (firstArg.startsWith('http') || firstArg.includes('circleci'))) {
  // Insert 'logs' before the URL for backward compatibility
  const originalArgs = process.argv.slice(2);
  const newArgs = ['logs', ...originalArgs];
  // Override process.argv for commander to parse
  process.argv = [...process.argv.slice(0, 2), ...newArgs];
}
