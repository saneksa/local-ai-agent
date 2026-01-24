import * as fs from "fs";
import * as path from "path";
import { spawn } from "child_process";
import * as readline from "readline";

export const tools = [
  {
    type: "function",
    function: {
      name: "list_files",
      description:
        "List files in the current directory or a specific subdirectory",
      parameters: {
        type: "object",
        properties: {
          dirPath: {
            type: "string",
            description:
              "The directory path to list files from (default is current directory '.')",
          },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "read_file",
      description: "Read the contents of a file",
      parameters: {
        type: "object",
        properties: {
          filePath: {
            type: "string",
            description: "The path to the file to read",
          },
        },
        required: ["filePath"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "write_file",
      description:
        "Write content to a file (creates it if it doesn't exist, overwrites if it does)",
      parameters: {
        type: "object",
        properties: {
          filePath: {
            type: "string",
            description: "The path to the file to write",
          },
          content: {
            type: "string",
            description: "The content to write to the file",
          },
        },
        required: ["filePath", "content"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "run_command",
      description:
        "Run a shell command. The user will be asked for confirmation before execution.",
      parameters: {
        type: "object",
        properties: {
          command: {
            type: "string",
            description: "The command to execute (e.g., 'npm run build')",
          },
        },
        required: ["command"],
      },
    },
  },
];

async function askConfirmation(
  command: string,
  rl: readline.Interface,
): Promise<boolean> {
  return new Promise((resolve) => {
    rl.question(
      `\n⚠️  Agent wants to execute command: "${command}"\nDo you allow this? (y/N): `,
      (answer) => {
        resolve(
          answer.trim().toLowerCase() === "y" ||
            answer.trim().toLowerCase() === "yes",
        );
      },
    );
  });
}

export async function executeTool(
  name: string,
  args: any,
  rl: readline.Interface,
): Promise<string> {
  try {
    switch (name) {
      case "list_files": {
        const dir = args.dirPath || ".";
        const files = await fs.promises.readdir(dir);
        return JSON.stringify(files);
      }
      case "read_file": {
        const content = await fs.promises.readFile(args.filePath, "utf-8");
        return content;
      }
      case "write_file": {
        const dir = path.dirname(args.filePath);
        if (!fs.existsSync(dir)) {
          await fs.promises.mkdir(dir, { recursive: true });
        }
        await fs.promises.writeFile(args.filePath, args.content, "utf-8");
        return `Successfully wrote to ${args.filePath}`;
      }
      case "run_command": {
        const command = args.command;
        const allowed = await askConfirmation(command, rl);
        if (!allowed) {
          return "Command execution cancelled by user.";
        }

        console.log(`\nRunning command: ${command}\n`);

        return new Promise((resolve) => {
          const child = spawn(command, { shell: true });
          let stdout = "";
          let stderr = "";

          child.stdout.on("data", (data) => {
            const output = data.toString();
            process.stdout.write(output);
            stdout += output;
          });

          child.stderr.on("data", (data) => {
            const output = data.toString();
            process.stderr.write(output);
            stderr += output;
          });

          child.on("close", (code) => {
            if (code === 0) {
              resolve(
                `Command executed successfully.\nStdout:\n${stdout}\nStderr:\n${stderr}`,
              );
            } else {
              resolve(
                `Command failed with exit code ${code}.\nStdout:\n${stdout}\nStderr:\n${stderr}`,
              );
            }
          });

          child.on("error", (error) => {
            resolve(`Error spawning command: ${error.message}`);
          });
        });
      }
      default:
        return `Error: Unknown tool ${name}`;
    }
  } catch (error: any) {
    return `Error executing ${name}: ${error.message}`;
  }
}
