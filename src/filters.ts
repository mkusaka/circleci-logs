import { CircleCIAction, LogLine } from './types.js';

export function filterActions(actions: CircleCIAction[], errorsOnly: boolean): CircleCIAction[] {
  if (!errorsOnly) {
    return actions;
  }

  return actions.filter((action) => {
    const status = action.status?.toLowerCase();
    return status !== 'success' && status !== undefined;
  });
}

export function filterLines(lines: LogLine[], grep: RegExp | null): LogLine[] {
  if (!grep) {
    return lines;
  }

  return lines.filter((line) => {
    const message = line.message ?? '';
    return grep.test(message);
  });
}

export function getLineMessage(line: LogLine | string): string {
  if (typeof line === 'string') {
    return line;
  }
  return line.message ?? '';
}
