import { beforeAll, afterEach, afterAll } from 'vitest';
import { server } from './src/mocks/server.js';

// Start MSW before all tests; fail on unhandled requests
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));

// Reset any runtime request handlers between tests
afterEach(() => server.resetHandlers());

// Clean up and restore native request handling
afterAll(() => server.close());