import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { ListToolsResultSchema, CallToolResultSchema } from '@modelcontextprotocol/sdk/types.js';
import { createMcpServer } from './server.js';
import * as circleci from '../circleci.js';
import * as filters from '../filters.js';

// Mock the CircleCI modules
vi.mock('../circleci.js', () => ({
  parseJobUrl: vi.fn(),
  fetchJobDetails: vi.fn(),
  fetchActionOutput: vi.fn(),
}));

vi.mock('../filters.js', () => ({
  filterActions: vi.fn(),
  filterLines: vi.fn(),
}));

describe('MCP Server E2E Tests', () => {
  let mcpServer: ReturnType<typeof createMcpServer>;
  let client: Client;
  let clientTransport: ReturnType<typeof InMemoryTransport.createLinkedPair>[0];
  let serverTransport: ReturnType<typeof InMemoryTransport.createLinkedPair>[1];

  beforeEach(async () => {
    // Create server instance
    mcpServer = createMcpServer();

    // Create client
    client = new Client({ name: 'test-client', version: '1.0.0' });

    // Create linked transport pair
    [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

    // Connect both sides
    await Promise.all([mcpServer.connect(serverTransport), client.connect(clientTransport)]);
  });

  describe('tools/list', () => {
    it('should return all registered tools', async () => {
      const response = await client.request(
        { method: 'tools/list', params: {} },
        ListToolsResultSchema,
      );

      expect(response.tools).toBeDefined();
      expect(Array.isArray(response.tools)).toBe(true);
      expect(response.tools.length).toBe(3);

      const toolNames = response.tools.map((tool) => tool.name);
      expect(toolNames).toContain('fetch_logs');
      expect(toolNames).toContain('search_pr_checks');
      expect(toolNames).toContain('get_failed_checks');
    });

    it('should include proper descriptions for fetch_logs tool', async () => {
      const response = await client.request(
        { method: 'tools/list', params: {} },
        ListToolsResultSchema,
      );

      const fetchLogsTool = response.tools.find((tool) => tool.name === 'fetch_logs');
      expect(fetchLogsTool).toBeDefined();
      expect(fetchLogsTool?.description).toContain('Fetch CircleCI job logs');
    });
  });

  describe('tools/call - fetch_logs', () => {
    it('should return error when CIRCLE_TOKEN is not set', async () => {
      // Temporarily remove CIRCLE_TOKEN
      const originalToken = process.env.CIRCLE_TOKEN;
      delete process.env.CIRCLE_TOKEN;

      const response = await client.request(
        {
          method: 'tools/call',
          params: {
            name: 'fetch_logs',
            arguments: {
              url: 'https://circleci.com/gh/org/repo/123',
              errors_only: false,
              format: 'text',
            },
          },
        },
        CallToolResultSchema,
      );

      expect(response.content).toBeDefined();
      expect(response.content[0]?.type).toBe('text');
      expect(response.content[0]?.text).toContain('CIRCLE_TOKEN environment variable is required');
      expect(response.isError).toBe(true);

      // Restore token
      if (originalToken) {
        process.env.CIRCLE_TOKEN = originalToken;
      }
    });

    it('should fetch and return logs successfully', async () => {
      // Set up environment
      process.env.CIRCLE_TOKEN = 'test-token';

      // Mock implementations
      vi.mocked(circleci.parseJobUrl).mockReturnValue({
        vcsAbbrev: 'gh',
        org: 'org',
        repo: 'repo',
        jobNumber: '123',
      });

      vi.mocked(circleci.fetchJobDetails).mockResolvedValue({
        steps: [
          {
            name: 'Setup',
            actions: [
              {
                name: 'Setup',
                status: 'success',
                output_url: 'https://circleci.com/api/v1.1/action/0/output',
              },
            ],
          },
          {
            name: 'Build',
            actions: [
              {
                name: 'Build',
                status: 'success',
                output_url: 'https://circleci.com/api/v1.1/action/1/output',
              },
            ],
          },
        ],
      });

      vi.mocked(circleci.fetchActionOutput).mockImplementation(async (outputUrl) => {
        if (outputUrl.includes('action/0')) {
          return [
            { message: 'Setting up environment', time: '2024-01-01T10:00:00Z', type: 'out' },
            { message: 'Environment ready', time: '2024-01-01T10:00:01Z', type: 'out' },
          ];
        } else {
          return [
            { message: 'Building project', time: '2024-01-01T10:00:02Z', type: 'out' },
            { message: 'Build complete', time: '2024-01-01T10:00:03Z', type: 'out' },
          ];
        }
      });

      const response = await client.request(
        {
          method: 'tools/call',
          params: {
            name: 'fetch_logs',
            arguments: {
              url: 'https://circleci.com/gh/org/repo/123',
              errors_only: false,
              format: 'text',
            },
          },
        },
        CallToolResultSchema,
      );

      expect(response.content).toBeDefined();
      expect(response.content[0]?.type).toBe('text');
      expect(response.content[0]?.text).toContain('Setup');
      expect(response.content[0]?.text).toContain('Build');
      expect(response.content[0]?.text).toContain('Setting up environment');
      expect(response.content[0]?.text).toContain('Building project');
      expect(response.isError).toBeUndefined();
    });

    it('should filter errors when errors_only is true', async () => {
      process.env.CIRCLE_TOKEN = 'test-token';

      vi.mocked(circleci.parseJobUrl).mockReturnValue({
        vcsAbbrev: 'gh',
        org: 'org',
        repo: 'repo',
        jobNumber: '123',
      });

      vi.mocked(circleci.fetchJobDetails).mockResolvedValue({
        steps: [
          {
            name: 'Setup',
            actions: [
              {
                name: 'Setup',
                status: 'success',
                output_url: 'https://circleci.com/api/v1.1/action/0/output',
              },
            ],
          },
          {
            name: 'Build',
            actions: [
              {
                name: 'Build',
                status: 'failed',
                output_url: 'https://circleci.com/api/v1.1/action/1/output',
              },
            ],
          },
        ],
      });

      vi.mocked(filters.filterActions).mockReturnValue([
        {
          name: 'Build',
          status: 'failed',
          output_url: 'https://circleci.com/api/v1.1/action/1/output',
        },
      ]);

      vi.mocked(circleci.fetchActionOutput).mockResolvedValue([
        { message: 'Build failed with error', time: '2024-01-01T10:00:00Z', type: 'err' },
      ]);

      const response = await client.request(
        {
          method: 'tools/call',
          params: {
            name: 'fetch_logs',
            arguments: {
              url: 'https://circleci.com/gh/org/repo/123',
              errors_only: true,
              format: 'text',
            },
          },
        },
        CallToolResultSchema,
      );

      expect(response.content[0]?.text).toContain('Build');
      expect(response.content[0]?.text).toContain('failed');
      expect(response.content[0]?.text).toContain('Build failed with error');
      expect(response.content[0]?.text).not.toContain('Setup');
    });

    it('should return JSON format when requested', async () => {
      process.env.CIRCLE_TOKEN = 'test-token';

      vi.mocked(circleci.parseJobUrl).mockReturnValue({
        vcsAbbrev: 'gh',
        org: 'org',
        repo: 'repo',
        jobNumber: '123',
      });

      vi.mocked(circleci.fetchJobDetails).mockResolvedValue({
        steps: [
          {
            name: 'Test',
            actions: [
              {
                name: 'Test',
                status: 'success',
                output_url: 'https://circleci.com/api/v1.1/action/0/output',
              },
            ],
          },
        ],
      });

      vi.mocked(circleci.fetchActionOutput).mockResolvedValue([
        { message: 'Running tests', time: '2024-01-01T10:00:00Z', type: 'out' },
      ]);

      const response = await client.request(
        {
          method: 'tools/call',
          params: {
            name: 'fetch_logs',
            arguments: {
              url: 'https://circleci.com/gh/org/repo/123',
              format: 'json',
            },
          },
        },
        CallToolResultSchema,
      );

      const jsonContent = JSON.parse((response.content[0] as any)?.text || '[]');
      expect(Array.isArray(jsonContent)).toBe(true);
      expect(jsonContent[0]).toHaveProperty('step', 'Test');
      expect(jsonContent[0]).toHaveProperty('action');
      expect(jsonContent[0].action).toHaveProperty('status', 'success');
      expect(jsonContent[0]).toHaveProperty('lines');
      expect(jsonContent[0].lines[0]).toHaveProperty('message', 'Running tests');
    });

    it('should apply grep filter when provided', async () => {
      process.env.CIRCLE_TOKEN = 'test-token';

      vi.mocked(circleci.parseJobUrl).mockReturnValue({
        vcsAbbrev: 'gh',
        org: 'org',
        repo: 'repo',
        jobNumber: '123',
      });

      vi.mocked(circleci.fetchJobDetails).mockResolvedValue({
        steps: [
          {
            name: 'Test',
            actions: [
              {
                name: 'Test',
                status: 'success',
                output_url: 'https://circleci.com/api/v1.1/action/0/output',
              },
            ],
          },
        ],
      });

      const allLines = [
        { message: 'Starting tests', time: '2024-01-01T10:00:00Z', type: 'out' },
        { message: 'Test failed: connection error', time: '2024-01-01T10:00:01Z', type: 'err' },
        { message: 'Retrying...', time: '2024-01-01T10:00:02Z', type: 'out' },
      ];

      vi.mocked(circleci.fetchActionOutput).mockResolvedValue(allLines);
      vi.mocked(filters.filterLines).mockReturnValue([
        allLines[1] || { message: '', time: '', type: '' },
      ]); // Only return the line with "failed"

      const response = await client.request(
        {
          method: 'tools/call',
          params: {
            name: 'fetch_logs',
            arguments: {
              url: 'https://circleci.com/gh/org/repo/123',
              grep: 'failed',
              format: 'text',
            },
          },
        },
        CallToolResultSchema,
      );

      expect(filters.filterLines).toHaveBeenCalledWith(allLines, expect.any(RegExp));
      expect(response.content[0]?.text).toContain('Test failed: connection error');
      expect(response.content[0]?.text).not.toContain('Starting tests');
      expect(response.content[0]?.text).not.toContain('Retrying');
    });

    it('should handle errors gracefully', async () => {
      process.env.CIRCLE_TOKEN = 'test-token';

      vi.mocked(circleci.parseJobUrl).mockImplementation(() => {
        throw new Error('Invalid URL format');
      });

      const response = await client.request(
        {
          method: 'tools/call',
          params: {
            name: 'fetch_logs',
            arguments: {
              url: 'invalid-url',
              format: 'text',
            },
          },
        },
        CallToolResultSchema,
      );

      expect(response.content[0]?.text).toContain('Error fetching logs');
      expect(response.content[0]?.text).toContain('Invalid URL format');
      expect(response.isError).toBe(true);
    });
  });

  describe('tools/call - placeholder tools', () => {
    it('should return not implemented message for search_pr_checks', async () => {
      const response = await client.request(
        {
          method: 'tools/call',
          params: {
            name: 'search_pr_checks',
            arguments: {
              pr_number: 123,
              repo: 'org/repo',
              failed_only: false,
            },
          },
        },
        CallToolResultSchema,
      );

      expect(response.content[0]?.text).toContain('not yet implemented');
      expect(response.content[0]?.text).toContain('Phase 2');
    });

    it('should return not implemented message for get_failed_checks', async () => {
      const response = await client.request(
        {
          method: 'tools/call',
          params: {
            name: 'get_failed_checks',
            arguments: {
              fetch_logs: true,
            },
          },
        },
        CallToolResultSchema,
      );

      expect(response.content[0]?.text).toContain('not yet implemented');
      expect(response.content[0]?.text).toContain('Phase 2');
    });
  });
});
