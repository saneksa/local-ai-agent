import * as fs from "fs"
import * as path from "path"
import { McpConfigSchema } from "./config"
import { McpClientWrapper } from "./McpClientWrapper"

export class McpManager {
  private clients: McpClientWrapper[] = []
  private toolServerMap: Map<string, McpClientWrapper> = new Map()
  private static instance: McpManager
  private initialized = false

  private constructor() {}

  static getInstance(): McpManager {
    if (!McpManager.instance) {
      McpManager.instance = new McpManager()
    }
    return McpManager.instance
  }

  async ensureInitialized(configPath: string = "mcp.config.json") {
    if (this.initialized) return
    await this.loadConfig(configPath)
    await this.connectAll()
    this.initialized = true
  }

  async loadConfig(configPath: string = "mcp.config.json") {
    const absolutePath = path.resolve(process.cwd(), configPath)
    if (!fs.existsSync(absolutePath)) {
      return
    }

    try {
      const content = fs.readFileSync(absolutePath, "utf-8")
      const json = JSON.parse(content)
      const config = McpConfigSchema.parse(json)

      for (const serverConfig of config.servers) {
        if (serverConfig.enabled !== false) {
          const client = new McpClientWrapper(serverConfig)
          this.clients.push(client)
        }
      }
      console.log(`[MCP] Loaded ${this.clients.length} servers from config.`)
    } catch (error) {
      console.error(`[MCP] Error loading config:`, error)
    }
  }

  async connectAll() {
    await Promise.all(
      this.clients.map((c) =>
        c.connect().catch((e) => {
          // Log handled in client
        }),
      ),
    )
  }

  async getTools() {
    this.toolServerMap.clear()
    const allTools: any[] = []

    for (const client of this.clients) {
      const result = await client.listTools()
      if (result && result.tools) {
        for (const tool of result.tools) {
          if (this.toolServerMap.has(tool.name)) {
            console.warn(
              `[MCP] Duplicate tool name ${tool.name} from ${client.config.name}. Overwriting.`,
            )
          }
          this.toolServerMap.set(tool.name, client)

          allTools.push({
            type: "function",
            function: {
              name: tool.name,
              description: tool.description,
              parameters: tool.inputSchema,
            },
          })
        }
      }
    }
    return allTools
  }

  async executeTool(name: string, args: any): Promise<string | null> {
    const client = this.toolServerMap.get(name)
    if (!client) {
      return null
    }

    try {
      const result: any = await client.callTool(name, args)

      if (result.isError) {
        const errorText = result.content
          .map((c: any) => (c.type === "text" ? c.text : ""))
          .join("\n")
        throw new Error(`MCP Tool Error: ${errorText}`)
      }

      return result.content
        .map((c: any) => {
          if (c.type === "text") return c.text
          if (c.type === "image") return `[Image: ${c.mimeType}]`
          if (c.type === "resource") return `[Resource: ${c.resource.uri}]`
          return ""
        })
        .join("\n")
    } catch (error: any) {
      throw new Error(`Failed to execute MCP tool ${name}: ${error.message}`)
    }
  }

  async cleanup() {
    await Promise.all(this.clients.map((c) => c.close()))
  }

  // For testing
  async resetForTests() {
    await this.cleanup()
    this.clients = []
    this.toolServerMap.clear()
    this.initialized = false
  }
}
