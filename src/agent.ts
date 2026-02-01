import OpenAI from "openai"
import * as fs from "fs"
import { tools, executeTool, ConfirmCallback } from "./tools"
import { McpManager } from "./mcp/McpManager"

export interface AgentConfig {
  baseURL?: string
  apiKey?: string
  model?: string
}

export interface IOHandler {
  log: (message: string) => void
  confirm: ConfirmCallback
}

export class Agent {
  private client: OpenAI
  private messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = []
  private io: IOHandler
  private config: AgentConfig

  constructor(config: AgentConfig, io: IOHandler) {
    this.config = config
    this.io = io
    this.client = new OpenAI({
      baseURL: config.baseURL || "http://localhost:1234/v1",
      apiKey: config.apiKey || "lm-studio",
    })
    this.reset()
  }

  reset() {
    this.messages = [
      {
        role: "system",
        content:
          "You are a helpful assistant capable of reading and writing files. When asked to create or modify files, always use the provided tools. If you need to explore the directory first, use list_files.",
      },
    ]
    this.io.log("Context reset.")
  }

  async chat(userInput: string): Promise<string> {
    await McpManager.getInstance().ensureInitialized()
    const augmentedInput = await this.resolveFileReferences(userInput)
    this.messages.push({ role: "user", content: augmentedInput })

    let loopCount = 0
    const MAX_LOOPS = 50

    while (loopCount < MAX_LOOPS) {
      this.io.log(`Sending request to LLM (Loop ${loopCount + 1})...`)

      try {
        const mcpTools = await McpManager.getInstance().getTools()
        const allTools = [...tools, ...mcpTools]

        const response = await this.client.chat.completions.create({
          model: this.config.model || "local-model",
          messages: this.messages,
          tools: allTools.length > 0 ? allTools : undefined,
          tool_choice: allTools.length > 0 ? "auto" : undefined,
        })

        const responseMessage = response.choices[0].message
        this.messages.push(responseMessage)

        // Check if the model wants to call a tool
        if (responseMessage.tool_calls && responseMessage.tool_calls.length > 0) {
          this.io.log(`Tool call detected: ${responseMessage.tool_calls[0].id}`)

          for (const toolCall of responseMessage.tool_calls) {
            if (toolCall.type !== "function") continue

            const functionName = toolCall.function.name
            const functionArgs = JSON.parse(toolCall.function.arguments)

            this.io.log(`Executing ${functionName} with args: ${JSON.stringify(functionArgs)}`)

            let toolResult = ""
            const isLocal = tools.some((t) => t.function.name === functionName)

            if (isLocal) {
              toolResult = await executeTool(functionName, functionArgs, this.io.confirm)
            } else {
              try {
                const mcpResult = await McpManager.getInstance().executeTool(
                  functionName,
                  functionArgs,
                )
                if (mcpResult !== null) {
                  toolResult = mcpResult
                } else {
                  toolResult = `Error: Unknown tool ${functionName}`
                }
              } catch (e: unknown) {
                toolResult = `Error executing MCP tool ${functionName}: ${(e as Error).message}`
              }
            }

            this.messages.push({
              role: "tool",
              tool_call_id: toolCall.id,
              content: toolResult,
            })
          }
        } else {
          // No tool calls, just a text response
          return responseMessage.content || "No content returned."
        }
      } catch (error: unknown) {
        console.error("Error during LLM interaction:", error)
        return `An error occurred while communicating with the LLM: ${(error as Error).message}`
      }

      loopCount++
    }

    return "Error: Maximum loop count reached."
  }

  private async resolveFileReferences(input: string): Promise<string> {
    const fileRegex = /\[.*?\]\((.*?)\)/g
    let match
    let content = input
    const filesToRead: string[] = []

    while ((match = fileRegex.exec(input)) !== null) {
      filesToRead.push(match[1])
    }

    if (filesToRead.length > 0) {
      content += "\n\nContext Files:"
      for (const filePath of filesToRead) {
        try {
          // Check if file exists and is readable
          if (fs.existsSync(filePath)) {
            const fileContent = await fs.promises.readFile(filePath, "utf-8")
            content += `\n\n--- ${filePath} ---\n${fileContent}\n--- End of ${filePath} ---`
          }
        } catch (e: unknown) {
          // Ignore errors, maybe the link is not a local file
          console.warn(`Could not read referenced file ${filePath}: ${(e as Error).message}`)
        }
      }
    }
    return content
  }
}
