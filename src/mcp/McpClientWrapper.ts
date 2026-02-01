import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js"
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js"
import { McpServerConfig } from "./config"

export class McpClientWrapper {
  private client: Client
  private transport: StdioClientTransport | StreamableHTTPClientTransport | null = null
  private isConnected: boolean = false

  constructor(public readonly config: McpServerConfig) {
    this.client = new Client(
      {
        name: "local-agent-client",
        version: "1.0.0",
      },
      {
        capabilities: {},
      },
    )
  }

  async connect() {
    if (this.isConnected) return

    console.log(
      `[MCP] Connecting to server: ${this.config.name} (${this.config.transport.type})...`,
    )

    try {
      if (this.config.transport.type === "stdio") {
        const env: Record<string, string> = {}
        const rawEnv = { ...process.env, ...this.config.transport.env }
        for (const key in rawEnv) {
          const value = rawEnv[key]
          if (value !== undefined) {
            env[key] = value
          }
        }
        this.transport = new StdioClientTransport({
          command: this.config.transport.command,
          args: this.config.transport.args,
          env,
        })
      } else {
        this.transport = new StreamableHTTPClientTransport(new URL(this.config.transport.url), {
          requestInit: {
            headers: this.config.transport.headers,
          },
        })
      }

      await this.client.connect(this.transport)
      this.isConnected = true
      console.log(`[MCP] Connected to ${this.config.name}`)
    } catch (error) {
      console.error(`[MCP] Failed to connect to ${this.config.name}:`, error)
      throw error
    }
  }

  async listTools() {
    if (!this.isConnected) {
      try {
        await this.connect()
      } catch (e) {
        console.warn(`[MCP] Could not connect to ${this.config.name} to list tools.`)
        return { tools: [] }
      }
    }

    try {
      return await this.client.listTools()
    } catch (error) {
      console.error(`[MCP] Error listing tools from ${this.config.name}:`, error)
      return { tools: [] }
    }
  }

  async callTool(name: string, args: any) {
    if (!this.isConnected) {
      await this.connect()
    }
    return await this.client.callTool({
      name,
      arguments: args,
    })
  }

  async close() {
    if (this.transport) {
      await this.transport.close()
    }
    this.isConnected = false
  }
}
