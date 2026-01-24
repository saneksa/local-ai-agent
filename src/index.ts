import { Agent } from "./agent"
import * as dotenv from "dotenv"
import * as readline from "readline"
import { FileRegistry } from "./file-registry"
import { AutocompletePrompt } from "./ui/autocomplete"

dotenv.config()

const fileRegistry = new FileRegistry(process.cwd())
const prompt = new AutocompletePrompt(fileRegistry)

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
console.log("Tip: Type '#' to link files.")

async function mainLoop() {
  // Initial scan
  await fileRegistry.scan()
  
  while (true) {
    try {
      console.log("")
      const input = await prompt.ask("You: ")
      
      if (input.toLowerCase() === "exit") {
        break
      }

      if (!input.trim()) continue

      const response = await agent.chat(input)
      console.log("\nAgent:", response)
    } catch (error) {
      console.error("Error:", error)
    }
  }
}

mainLoop()
