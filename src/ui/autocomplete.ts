import * as readline from "readline"
import { FileRegistry, FileInfo } from "../file-registry"
import { CommandRegistry, CommandInfo } from "../command-registry"

export class AutocompletePrompt {
  private fileRegistry: FileRegistry
  private commandRegistry: CommandRegistry
  private input: string = ""
  private cursorPos: number = 0
  private isDropdownOpen: boolean = false
  private dropdownIndex: number = 0
  private searchResults: (FileInfo | CommandInfo)[] = []
  private searchStartPos: number = -1
  private promptText: string = ""
  private lastDropdownHeight: number = 0
  private resolve?: (value: string) => void
  private reject?: (reason: any) => void
  private isCommandMode: boolean = false

  constructor(fileRegistry: FileRegistry, commandRegistry: CommandRegistry) {
    this.fileRegistry = fileRegistry
    this.commandRegistry = commandRegistry
  }

  async ask(promptText: string): Promise<string> {
    this.promptText = promptText
    this.input = ""
    this.cursorPos = 0
    this.isDropdownOpen = false
    this.dropdownIndex = 0

    // Ensure files are loaded
    await this.fileRegistry.scan()

    return new Promise((resolve, reject) => {
      this.resolve = resolve
      this.reject = reject

      this.setupStdin()
      this.render()
    })
  }

  private setupStdin() {
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(true)
    }
    readline.emitKeypressEvents(process.stdin)
    process.stdin.on("keypress", this.handleKeypress)
    process.stdin.resume()
  }

  private cleanup() {
    process.stdin.removeListener("keypress", this.handleKeypress)
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(false)
    }
    // Clear dropdown if any
    if (this.isDropdownOpen) {
      this.clearDropdown()
    }
    process.stdout.write("\n")
    process.stdin.pause()
  }

  private handleKeypress = (str: string, key: readline.Key) => {
    if (key.ctrl && key.name === "c") {
      this.cleanup()
      process.exit(0)
    }

    if (key.name === "return") {
      if (this.isDropdownOpen) {
        this.selectItem()
      } else {
        this.cleanup()
        this.resolve?.(this.input)
      }
      return
    }

    if (this.isDropdownOpen) {
      if (key.name === "up") {
        this.dropdownIndex = Math.max(0, this.dropdownIndex - 1)
        this.render()
        return
      }
      if (key.name === "down") {
        this.dropdownIndex = Math.min(this.searchResults.length - 1, this.dropdownIndex + 1)
        this.render()
        return
      }
      if (key.name === "escape") {
        this.isDropdownOpen = false
        this.render()
        return
      }
      // Continue to default handling to allow typing while dropdown is open (filtering)
    }

    if (key.name === "backspace") {
      if (this.cursorPos > 0) {
        this.input = this.input.slice(0, this.cursorPos - 1) + this.input.slice(this.cursorPos)
        this.cursorPos--
        this.updateDropdownState()
        this.render()
      }
      return
    }

    if (key.name === "left") {
      if (this.cursorPos > 0) {
        this.cursorPos--
        // Check if we moved out of a search context? Maybe later.
        this.render()
      }
      return
    }

    if (key.name === "right") {
      if (this.cursorPos < this.input.length) {
        this.cursorPos++
        this.render()
      }
      return
    }

    // Regular character input
    if (str) {
      this.input = this.input.slice(0, this.cursorPos) + str + this.input.slice(this.cursorPos)
      this.cursorPos += str.length
      this.updateDropdownState()
      this.render()
    }
  }

  private updateDropdownState() {
    // Check if we are currently editing a #hashtag or /command
    const textBeforeCursor = this.input.slice(0, this.cursorPos)
    const lastHashIndex = textBeforeCursor.lastIndexOf("#")
    const lastSlashIndex = textBeforeCursor.lastIndexOf("/")

    // Determine which trigger is closer to the end/active
    // Commands usually start at the beginning of line or maybe anywhere? 
    // User requirement: "launch commands with /, autocomplete available commands when inputting /"
    // Usually commands are at the start, but let's support them anywhere for now or restrict to start if needed.
    // For simplicity, let's treat them like tags but with / prefix.

    // We prioritize the one closest to cursor that doesn't have a space after it
    
    let triggerChar = ""
    let triggerIndex = -1

    if (lastHashIndex > lastSlashIndex) {
        triggerChar = "#"
        triggerIndex = lastHashIndex
    } else {
        triggerChar = "/"
        triggerIndex = lastSlashIndex
    }

    if (triggerIndex !== -1) {
      const query = textBeforeCursor.slice(triggerIndex + 1)
      
      if (query.includes(" ")) {
        this.isDropdownOpen = false
        this.isCommandMode = false
        return
      }

      this.searchStartPos = triggerIndex
      
      if (triggerChar === "#") {
          this.isCommandMode = false
          this.searchResults = this.fileRegistry.search(query)
      } else {
          this.isCommandMode = true
          this.searchResults = this.commandRegistry.search(query)
      }

      this.isDropdownOpen = this.searchResults.length > 0
      this.dropdownIndex = 0
    } else {
      this.isDropdownOpen = false
      this.isCommandMode = false
    }
  }

  private selectItem() {
    if (!this.searchResults[this.dropdownIndex]) return

    const item = this.searchResults[this.dropdownIndex]
    let textToInsert = ""

    if (this.isCommandMode) {
        // Command
        textToInsert = `/${item.name}` 
        // If it was a partial command typed, we replace from searchStartPos
    } else {
        // File
        const file = item as FileInfo
        textToInsert = `[${file.name}](${file.path}) `
    }
    
    const beforeHash = this.input.slice(0, this.searchStartPos)
    const afterCursor = this.input.slice(this.cursorPos)
    
    this.input = beforeHash + textToInsert + afterCursor
    this.cursorPos = beforeHash.length + textToInsert.length
    this.isDropdownOpen = false
    this.render()
  }

  private render() {
    // ANSI codes
    const ERASE_LINE = "\x1b[2K"
    const MOVE_LEFT = "\x1b[1000D" // Move all the way left
    const HIDE_CURSOR = "\x1b[?25l"
    const SHOW_CURSOR = "\x1b[?25h"
    const UP = "\x1b[A"
    const DOWN = "\x1b[B"

    // 1. Hide cursor during render
    process.stdout.write(HIDE_CURSOR)

    // 2. Clear current line and write prompt + input
    // If we had a dropdown rendered previously, we need to clear it.
    this.clearDropdown()
    
    // We assume the terminal cursor is at the input line.
    
    // Actually, properly clearing the dropdown is tricky if we don't know how many lines it took.
    // We can assume we clear N lines down.
    // Let's rely on standard output behavior:
    // Move to start of line, clear line, write prompt.
    process.stdout.write(MOVE_LEFT + ERASE_LINE + this.promptText + this.input)

    // 3. Render Dropdown if open
    if (this.isDropdownOpen) {
      // Move to next line
      process.stdout.write("\n")
      
      const maxItems = 5
      const start = Math.max(0, Math.min(this.dropdownIndex - 2, this.searchResults.length - maxItems))
      const end = Math.min(start + maxItems, this.searchResults.length)
      
      for (let i = start; i < end; i++) {
        const item = this.searchResults[i]
        const isSelected = i === this.dropdownIndex
        
        let icon = ""
        let text = ""
        
        if (this.isCommandMode) {
             const cmd = item as CommandInfo
             icon = "🔧"
             text = `${cmd.name} - ${cmd.description}`
        } else {
             const file = item as FileInfo
             icon = this.getFileIcon(file.type)
             text = file.path
        }

        const prefix = isSelected ? "> " : "  "
        const style = isSelected ? "\x1b[36m" : "\x1b[37m" // Cyan for selected, White for others
        const reset = "\x1b[0m"
        
        process.stdout.write(ERASE_LINE + `${style}${prefix}${icon} ${text}${reset}\n`)
      }
      
      // Calculate new height
      // 1 for initial newline + (end - start) items
      const newHeight = 1 + (end - start)
      this.lastDropdownHeight = newHeight
      
      // Move cursor back up to the input line
      for (let i = 0; i < newHeight; i++) {
        process.stdout.write(UP)
      }
    }

    // 4. Position cursor
    process.stdout.write(MOVE_LEFT) // Go to start
    // Move right by prompt length + cursor pos
    // We can use "\x1b[<N>C" to move right N times
    const pos = this.promptText.length + this.cursorPos
    if (pos > 0) {
        process.stdout.write(`\x1b[${pos}C`)
    }

    // 5. Show cursor
    process.stdout.write(SHOW_CURSOR)
  }
  
  private clearDropdown() {
      if (this.lastDropdownHeight > 0) {
        const ERASE_LINE = "\x1b[2K"
        const UP = "\x1b[A"
        const DOWN = "\x1b[B"
        
        // Move down and clear each line
        for (let i = 0; i < this.lastDropdownHeight; i++) {
          process.stdout.write(DOWN + ERASE_LINE)
        }
        
        // Move back up
        for (let i = 0; i < this.lastDropdownHeight; i++) {
          process.stdout.write(UP)
        }
        
        this.lastDropdownHeight = 0
      }
  }

  private getFileIcon(type: string): string {
    const icons: Record<string, string> = {
      ts: "📘",
      js: "📒",
      json: "📦",
      md: "📝",
      txt: "📄",
    }
    return icons[type] || "📄"
  }
}
