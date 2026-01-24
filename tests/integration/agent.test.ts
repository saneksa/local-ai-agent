import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Agent } from '../../src/agent';

const mockCreate = vi.fn();

vi.mock('openai', () => {
  return {
    default: class {
      chat = {
        completions: {
          create: mockCreate,
        },
      };
    },
  };
});

describe('Agent Integration', () => {
  let agent: Agent;
  const mockIO = {
    log: vi.fn(),
    confirm: vi.fn().mockResolvedValue(true),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    agent = new Agent({}, mockIO);
  });

  it('should handle simple text response', async () => {
    mockCreate.mockResolvedValueOnce({
      choices: [
        {
          message: {
            content: 'Hello there!',
            tool_calls: [],
          },
        },
      ],
    });

    const response = await agent.chat('Hello');
    expect(response).toBe('Hello there!');
    expect(mockCreate).toHaveBeenCalledTimes(1);
  });

  it('should execute tool and return result', async () => {
    // First call returns a tool call
    mockCreate.mockResolvedValueOnce({
      choices: [
        {
          message: {
            content: null,
            tool_calls: [
              {
                id: 'call_123',
                type: 'function',
                function: {
                  name: 'list_files',
                  arguments: JSON.stringify({ dirPath: '.' }),
                },
              },
            ],
          },
        },
      ],
    });

    // Second call returns the final answer after tool execution
    mockCreate.mockResolvedValueOnce({
      choices: [
        {
          message: {
            content: 'Here are the files.',
            tool_calls: [],
          },
        },
      ],
    });

    const response = await agent.chat('List files');
    
    expect(mockCreate).toHaveBeenCalledTimes(2);
    expect(mockIO.log).toHaveBeenCalledWith(expect.stringContaining('Executing list_files'));
    expect(response).toBe('Here are the files.');
  });
});
