import * as readline from "readline";
import { Agent } from "./agent";

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const agent = new Agent(undefined, undefined, rl);

console.log("Local Agent Initialized. Type 'exit' to quit.");

function askQuestion() {
  rl.question("\nYou: ", async (input) => {
    if (input.toLowerCase() === "exit") {
      rl.close();
      return;
    }

    try {
      const response = await agent.chat(input);
      console.log("\nAgent:", response);
    } catch (error) {
      console.error("Error:", error);
    }

    askQuestion();
  });
}

askQuestion();
