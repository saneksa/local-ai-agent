export interface CommandInfo {
  name: string
  description: string
  action?: () => void
}

export class CommandRegistry {
  private commands: CommandInfo[] = []

  constructor() {
    this.register({
      name: "reset",
      description: "Reset the agent context",
    })
    this.register({
        name: "exit",
        description: "Exit the application"
    })
  }

  register(command: CommandInfo) {
    this.commands.push(command)
  }

  search(query: string): CommandInfo[] {
    return this.commands.filter((cmd) => cmd.name.startsWith(query))
  }
}
