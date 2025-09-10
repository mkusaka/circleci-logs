import { Command } from 'commander';
import { startMcpServer } from '../mcp/server.js';

export function createMcpCommand(): Command {
  const mcpCommand = new Command('mcp');

  mcpCommand
    .description('Start MCP (Model Context Protocol) server for AI assistant integration')
    .action(async () => {
      try {
        await startMcpServer();
      } catch (error) {
        console.error('Failed to start MCP server:', error);
        process.exit(1);
      }
    });

  return mcpCommand;
}
