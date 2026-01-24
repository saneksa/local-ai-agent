import * as readline from "readline"
import { Agent } from "./agent"
import * as dotenv from "dotenv"

dotenv.config()

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
})

const io = {
  log: (msg: string) => console.log(msg),
  confirm: (msg: string) =>
    new Promise<boolean>((resolve) => {
      rl.question(msg, (answer) => {
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

function askQuestion() {
  rl.question("\nYou: ", async (input) => {
    if (input.toLowerCase() === "exit") {
      rl.close()
      return
    }

    try {
      const response = await agent.chat(input)
      console.log("\nAgent:", response)
    } catch (error) {
      console.error("Error:", error)
    }

    askQuestion()
  })
}

askQuestion()
