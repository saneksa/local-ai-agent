import * as readline from "readline";
import OpenAI from "openai";
import { tools, executeTool } from "./tools";

export class Agent {
  private client: OpenAI;
  private messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[];
  private rl: readline.Interface;

  constructor(
    baseURL: string = "http://localhost:1234/v1",
    apiKey: string = "lm-studio",
    rl: readline.Interface,
  ) {
    this.client = new OpenAI({
      baseURL,
      apiKey,
    });
    this.messages = [
      {
        role: "system",
        content:
          "You are a helpful assistant capable of reading and writing files. When asked to create or modify files, always use the provided tools. If you need to explore the directory first, use list_files.",
      },
    ];

    this.rl = rl;
  }

  async chat(userInput: string): Promise<string> {
    this.messages.push({ role: "user", content: userInput });

    let loopCount = 0;
    const MAX_LOOPS = 20;

    while (loopCount < MAX_LOOPS) {
      console.log(`Sending request to LLM (Loop ${loopCount + 1})...`);

      try {
        const response = await this.client.chat.completions.create({
          model: "local-model", // LM Studio usually ignores this, but it's required
          messages: this.messages,
          tools: tools as any,
          tool_choice: "auto",
        });

        const responseMessage = response.choices[0].message;
        this.messages.push(responseMessage);

        // Check if the model wants to call a tool
        if (
          responseMessage.tool_calls &&
          responseMessage.tool_calls.length > 0
        ) {
          console.log("Tool call detected:", responseMessage.tool_calls[0].id);

          for (const toolCall of responseMessage.tool_calls) {
            if (toolCall.type !== "function") continue;

            const functionName = toolCall.function.name;
            const functionArgs = JSON.parse(toolCall.function.arguments);

            console.log(`Executing ${functionName} with args:`, functionArgs);
            const toolResult = await executeTool(
              functionName,
              functionArgs,
              this.rl,
            );

            this.messages.push({
              role: "tool",
              tool_call_id: toolCall.id,
              content: toolResult,
            });
          }
        } else {
          // No tool calls, just a text response
          return responseMessage.content || "No content returned.";
        }
      } catch (error) {
        console.error("Error during LLM interaction:", error);
        return "An error occurred while communicating with the LLM.";
      }

      loopCount++;
    }

    return "Error: Maximum loop count reached.";
  }
}
