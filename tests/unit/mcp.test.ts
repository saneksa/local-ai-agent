import { describe, it, expect, vi, beforeEach } from "vitest"
import { McpManager } from "../../src/mcp/McpManager"
import * as fs from "fs"

// Mock fs
vi.mock("fs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("fs")>()
  return {
    ...actual,
    existsSync: vi.fn(),
    readFileSync: vi.fn(),
  }
})

// Mock Client
vi.mock("@modelcontextprotocol/sdk/client/index.js", () => {
  class MockClient {
    constructor() {}
    connect = vi.fn().mockResolvedValue(undefined)
    listTools = vi.fn().mockResolvedValue({
      tools: [
        {
          name: "remote_tool",
          description: "A remote tool",
          inputSchema: { type: "object" },
        },
      ],
    })
    callTool = vi.fn().mockResolvedValue({
      content: [{ type: "text", text: "Tool output" }],
      isError: false,
    })
    close = vi.fn().mockResolvedValue(undefined)
  }
  return {
    Client: MockClient,
  }
})

// Mock Transports
vi.mock("@modelcontextprotocol/sdk/client/stdio.js", () => {
  class MockStdioClientTransport {
    constructor() {}
    close = vi.fn().mockResolvedValue(undefined)
  }
  return {
    StdioClientTransport: MockStdioClientTransport,
  }
})

vi.mock("@modelcontextprotocol/sdk/client/streamableHttp.js", () => {
  class MockStreamableHTTPClientTransport {
    constructor() {}
    close = vi.fn().mockResolvedValue(undefined)
  }
  return {
    StreamableHTTPClientTransport: MockStreamableHTTPClientTransport,
  }
})

describe("McpManager", () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    await McpManager.getInstance().resetForTests()
  })

  it("should load config and initialize clients", async () => {
    const config = {
      servers: [
        {
          id: "test-server",
          name: "Test Server",
          transport: {
            type: "stdio",
            command: "echo",
            args: [],
          },
        },
      ],
    }

    vi.mocked(fs.existsSync).mockReturnValue(true)
    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(config))

    const manager = McpManager.getInstance()
    await manager.ensureInitialized()

    const tools = await manager.getTools()
    expect(tools).toHaveLength(1)
    expect(tools[0].function.name).toBe("remote_tool")
    expect(tools[0].function.description).toBe("A remote tool")
  })

  it("should execute tool successfully", async () => {
    const config = {
      servers: [
        {
          id: "test-server",
          name: "Test Server",
          transport: {
            type: "stdio",
            command: "echo",
            args: [],
          },
        },
      ],
    }

    vi.mocked(fs.existsSync).mockReturnValue(true)
    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(config))

    const manager = McpManager.getInstance()
    await manager.ensureInitialized()
    await manager.getTools() // Populate map

    const result = await manager.executeTool("remote_tool", {})
    expect(result).toBe("Tool output")
  })
})
