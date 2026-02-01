import * as fs from "fs"
import * as path from "path"
import { spawn } from "child_process"

export const tools = [
  {
    type: "function",
    function: {
      name: "list_files",
      description: "List files in the current directory or a specific subdirectory",
      parameters: {
        type: "object",
        properties: {
          dirPath: {
            type: "string",
            description: "The directory path to list files from (default is current directory '.')",
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
      description: "Run a shell command. The user will be asked for confirmation before execution.",
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
]

const ALLOWED_ROOT = process.cwd()
const MAX_FILE_SIZE = 1024 * 1024 // 1MB

export function validatePath(requestedPath: string): string {
  const resolvedPath = path.resolve(ALLOWED_ROOT, requestedPath)
  if (!resolvedPath.startsWith(ALLOWED_ROOT)) {
    throw new Error(`Access denied: Path ${requestedPath} is outside the allowed directory.`)
  }
  return resolvedPath
}

export type ConfirmCallback = (message: string) => Promise<boolean>

export async function executeTool(
  name: string,
  args: any,
  confirm: ConfirmCallback,
): Promise<string> {
  try {
    switch (name) {
      case "list_files": {
        const dir = args.dirPath || "."
        const validatedDir = validatePath(dir)
        const files = await fs.promises.readdir(validatedDir)
        return JSON.stringify(files)
      }
      case "read_file": {
        const validatedPath = validatePath(args.filePath)
        const stats = await fs.promises.stat(validatedPath)
        if (stats.size > MAX_FILE_SIZE) {
          throw new Error("File is too large to read (max 1MB).")
        }
        const content = await fs.promises.readFile(validatedPath, "utf-8")
        return content
      }
      case "write_file": {
        const validatedPath = validatePath(args.filePath)
        const dir = path.dirname(validatedPath)

        if (!fs.existsSync(dir)) {
          await fs.promises.mkdir(dir, { recursive: true })
        }
        await fs.promises.writeFile(validatedPath, args.content, "utf-8")
        return `Successfully wrote to ${args.filePath}`
      }
      case "run_command": {
        const command = args.command
        const allowed = await confirm(
          `\n⚠️  Agent wants to execute command: "${command}"\nDo you allow this? (y/N): `,
        )
        if (!allowed) {
          return "Command execution cancelled by user."
        }

        console.log(`\nRunning command: ${command}\n`)

        return new Promise((resolve) => {
          const child = spawn(command, { shell: true })
          let stdout = ""
          let stderr = ""

          child.stdout.on("data", (data) => {
            const output = data.toString()
            process.stdout.write(output)
            stdout += output
          })

          child.stderr.on("data", (data) => {
            const output = data.toString()
            process.stderr.write(output)
            stderr += output
          })

          child.on("close", (code) => {
            if (code === 0) {
              resolve(`Command executed successfully.\nStdout:\n${stdout}\nStderr:\n${stderr}`)
            } else {
              resolve(
                `Command failed with exit code ${code}.\nStdout:\n${stdout}\nStderr:\n${stderr}`,
              )
            }
          })

          child.on("error", (error) => {
            resolve(`Error spawning command: ${error.message}`)
          })
        })
      }
      default:
        return `Error: Unknown tool ${name}`
    }
  } catch (error: unknown) {
    return `Error executing ${name}: ${(error as Error).message}`
  }
}
