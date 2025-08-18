import chalk from 'chalk';
import { LogSegment } from './types.js';
import { getLineMessage } from './filters.js';

export function printHuman(segments: LogSegment[]): void {
  for (const segment of segments) {
    const stepName = segment.step || '(no step name)';
    const actionName = segment.action?.name || '(no action name)';
    const status = segment.action?.status || 'unknown';

    // Format status with colors
    const formattedStatus = formatStatus(status);

    console.log(
      chalk.bold.blue('## ') +
        chalk.cyan(`[${stepName}] `) +
        chalk.white(actionName) +
        '  ' +
        formattedStatus,
    );

    if (!segment.lines || segment.lines.length === 0) {
      console.log(chalk.gray('(no output)'));
      console.log();
      continue;
    }

    for (const line of segment.lines) {
      const message = getLineMessage(line);
      process.stdout.write(message.endsWith('\n') ? message : message + '\n');
    }
    console.log();
  }
}

export function printJson(segments: LogSegment[]): void {
  console.log(JSON.stringify(segments, null, 2));
}

function formatStatus(status: string): string {
  const lowerStatus = status.toLowerCase();

  switch (lowerStatus) {
    case 'success':
      return chalk.green(`[${status}]`);
    case 'failed':
    case 'failure':
    case 'error':
      return chalk.red(`[${status}]`);
    case 'timedout':
    case 'timeout':
      return chalk.yellow(`[${status}]`);
    case 'canceled':
    case 'cancelled':
      return chalk.gray(`[${status}]`);
    case 'running':
    case 'in_progress':
      return chalk.blue(`[${status}]`);
    default:
      return chalk.white(`[${status}]`);
  }
}

export function checkForErrors(segments: LogSegment[]): boolean {
  return segments.some((segment) => {
    const status = segment.action?.status?.toLowerCase() ?? '';
    return status !== 'success' && status !== '';
  });
}