import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { parseJobUrl, fetchJobDetails, fetchActionOutput } from '../circleci.js';
import { filterActions, filterLines } from '../filters.js';
import type { LogSegment, CircleCIAction } from '../types.js';

/**
 * Create and configure the MCP server with CircleCI tools
 */
export function createMcpServer() {
  const server = new McpServer({
    name: 'circleci-logs',
    version: '1.0.0',
  });

  // Register the fetch_logs tool
  server.tool(
    'fetch_logs',
    'Fetch CircleCI job logs from a URL',
    {
      url: z.string(),
      errors_only: z.boolean().optional(),
      grep: z.string().optional(),
      format: z.enum(['text', 'json']).optional(),
    },
    async ({ url, errors_only = false, grep, format = 'text' }) => {
      // Get token from environment
      const token = process.env.CIRCLE_TOKEN;
      if (!token) {
        return {
          content: [
            {
              type: 'text',
              text: 'Error: CIRCLE_TOKEN environment variable is required',
            },
          ],
          isError: true,
        };
      }

      try {
        // Parse CircleCI job URL
        const jobInfo = parseJobUrl(url);

        // Fetch job details from CircleCI API
        const job = await fetchJobDetails(jobInfo, token);

        // Extract actions from steps
        const actions: CircleCIAction[] = [];
        if (job.steps) {
          for (const step of job.steps) {
            if (step.actions) {
              actions.push(...step.actions);
            }
          }
        }

        // Filter actions if needed
        const filteredActions = errors_only ? filterActions(actions, true) : actions;

        if (filteredActions.length === 0) {
          return {
            content: [
              {
                type: 'text',
                text: errors_only
                  ? 'No error actions found. All steps completed successfully.'
                  : 'No actions found in this job.',
              },
            ],
          };
        }

        // Fetch logs for each action
        const segments: LogSegment[] = await Promise.all(
          filteredActions.map(async (action) => {
            if (!action.output_url) {
              return {
                step: action.name || 'Unknown',
                action,
                lines: [],
              };
            }
            const lines = await fetchActionOutput(action.output_url);
            const filteredLines = grep ? filterLines(lines, new RegExp(grep)) : lines;
            return {
              step: action.name || 'Unknown',
              action,
              lines: filteredLines,
            };
          }),
        );

        // Format output
        if (format === 'json') {
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(segments, null, 2),
              },
            ],
          };
        } else {
          // Format as text
          const output = segments
            .map((segment) => {
              const header = `## [${segment.step}] ${segment.step}  [${segment.action.status || 'unknown'}]`;
              const body = segment.lines.map((line) => line.message || '').join('\n');
              return `${header}\n${body}`;
            })
            .join('\n\n');

          return {
            content: [
              {
                type: 'text',
                text: output,
              },
            ],
          };
        }
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error fetching logs: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );

  // Register search_pr_checks tool (placeholder for Phase 2)
  server.tool(
    'search_pr_checks',
    'Search CircleCI checks for a GitHub PR',
    {
      pr_number: z.number(),
      repo: z.string(),
      failed_only: z.boolean().optional(),
    },
    async (/* { pr_number, repo, failed_only } */) => {
      return {
        content: [
          {
            type: 'text',
            text: 'search_pr_checks tool is not yet implemented (Phase 2)',
          },
        ],
      };
    },
  );

  // Register get_failed_checks tool (placeholder for Phase 2)
  server.tool(
    'get_failed_checks',
    'Get all failed CircleCI checks from current PR',
    {
      fetch_logs: z.boolean().optional(),
    },
    async (/* { fetch_logs } */) => {
      return {
        content: [
          {
            type: 'text',
            text: 'get_failed_checks tool is not yet implemented (Phase 2)',
          },
        ],
      };
    },
  );

  return server;
}

/**
 * Start the MCP server with stdio transport
 */
export async function startMcpServer() {
  const server = createMcpServer();
  const transport = new StdioServerTransport();

  await server.connect(transport);
  console.error('MCP server started successfully');
}
