import { describe, it, expect, vi } from 'vitest';
import { createMcpCommand } from './mcp.js';

// Mock the MCP server module
vi.mock('../mcp/server.js', () => ({
  startMcpServer: vi.fn(),
}));

describe('MCP Command', () => {
  it('should create mcp command with correct configuration', () => {
    const command = createMcpCommand();

    expect(command.name()).toBe('mcp');
    expect(command.description()).toContain('MCP');
    expect(command.description()).toContain('Model Context Protocol');
    expect(command.description()).toContain('AI assistant');
  });

  it('should have no additional options', () => {
    const command = createMcpCommand();

    // MCP command should have no custom options (only default help)
    expect(command.options.filter((opt) => opt.long !== '--help')).toHaveLength(0);
  });
});
