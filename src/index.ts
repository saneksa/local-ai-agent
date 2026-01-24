import { Agent } from "./agent"
import * as dotenv from "dotenv"
import * as readline from "readline"
import { FileRegistry } from "./file-registry"
import { AutocompletePrompt } from "./ui/autocomplete"
import { CommandRegistry } from "./command-registry"

dotenv.config()

const fileRegistry = new FileRegistry(process.cwd())
const commandRegistry = new CommandRegistry()
const prompt = new AutocompletePrompt(fileRegistry, commandRegistry)

const io = {
  log: (msg: string) => console.log(msg),
  confirm: (msg: string) =>
    new Promise<boolean>((resolve) => {
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
      })
      rl.question(msg, (answer) => {
        rl.close()
        resolve(answer.trim().toLowerCase() === "y" || answer.trim().toLowerCase() === "yes")
      })
    }),
}

const agent = new Agent(
  {
    baseURL: process.env.OPENAI_BASE_URL,
    apiKey: process.env.OPENAI_API_KEY,
  },
  io,
)

console.log("Local Agent Initialized. Type 'exit' to quit.")
console.log("Tip: Type '#' to link files, '/' to run commands.")

async function mainLoop() {
  // Initial scan
  await fileRegistry.scan()
  
  while (true) {
    try {
      console.log("")
      const input = await prompt.ask("You: ")
      
      if (input.toLowerCase() === "exit") {
        process.exit(0)
      }

      if (!input.trim()) continue

      // Check if it's a command
      if (input.startsWith("/")) {
          const commandName = input.slice(1).trim()
          if (commandName === "reset") {
              agent.reset()
              continue
          } else if (commandName === "exit") {
              process.exit(0)
          }
          // We can also look up in commandRegistry for generic execution if we add action handlers there
          // For now, hardcoded handling for reset is fine as requested.
      }

      const response = await agent.chat(input)
      console.log("\nAgent:", response)
    } catch (error) {
      console.error("Error:", error)
    }
  }
}

mainLoop()
