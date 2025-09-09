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
program
  .argument('[command]', 'Command or URL')
  .argument('[url]', 'URL for subcommand')
  .action((commandOrUrl, _url) => {
    // If first argument looks like a URL, treat it as logs command
    if (commandOrUrl && (commandOrUrl.startsWith('http') || commandOrUrl.includes('circleci'))) {
      // Get all original arguments after the program name
      const originalArgs = process.argv.slice(2);
      // Insert 'logs' before the URL
      const newArgs = ['logs', ...originalArgs];
      // Re-parse with logs subcommand
      program.parse(newArgs, { from: 'user' });
    } else if (!commandOrUrl) {
      // No arguments provided, show help
      program.outputHelp();
    }
    // Otherwise, let commander handle it normally (it's a subcommand)
  });
