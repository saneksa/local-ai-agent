import OpenAI from "openai"
import { tools, executeTool, ConfirmCallback } from "./tools"

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
  private messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[]
  private io: IOHandler
  private config: AgentConfig

  constructor(config: AgentConfig, io: IOHandler) {
    this.config = config
    this.io = io
    this.client = new OpenAI({
      baseURL: config.baseURL || "http://localhost:1234/v1",
      apiKey: config.apiKey || "lm-studio",
    })
    this.messages = [
      {
        role: "system",
        content:
          "You are a helpful assistant capable of reading and writing files. When asked to create or modify files, always use the provided tools. If you need to explore the directory first, use list_files.",
      },
    ]
  }

  async chat(userInput: string): Promise<string> {
    this.messages.push({ role: "user", content: userInput })

    let loopCount = 0
    const MAX_LOOPS = 50

    while (loopCount < MAX_LOOPS) {
      this.io.log(`Sending request to LLM (Loop ${loopCount + 1})...`)

      try {
        const response = await this.client.chat.completions.create({
          model: this.config.model || "local-model",
          messages: this.messages,
          tools: tools as any,
          tool_choice: "auto",
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
            const toolResult = await executeTool(functionName, functionArgs, this.io.confirm)

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
      } catch (error: any) {
        console.error("Error during LLM interaction:", error)
        return `An error occurred while communicating with the LLM: ${error.message}`
      }

      loopCount++
    }

    return "Error: Maximum loop count reached."
  }
}
