import * as readline from "readline"
import { FileRegistry, FileInfo } from "../file-registry"

export class AutocompletePrompt {
  private fileRegistry: FileRegistry
  private input: string = ""
  private cursorPos: number = 0
  private isDropdownOpen: boolean = false
  private dropdownIndex: number = 0
  private searchResults: FileInfo[] = []
  private searchStartPos: number = -1
  private promptText: string = ""
  private lastDropdownHeight: number = 0
  private resolve?: (value: string) => void
  private reject?: (reason: any) => void

  constructor(fileRegistry: FileRegistry) {
    this.fileRegistry = fileRegistry
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
  }

  private handleKeypress = (str: string, key: readline.Key) => {
    if (key.ctrl && key.name === "c") {
      this.cleanup()
      process.exit(0)
    }

    if (key.name === "return") {
      if (this.isDropdownOpen) {
        this.selectFile()
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
    // Check if we are currently editing a #hashtag
    // We look backwards from cursor to find the last #
    const textBeforeCursor = this.input.slice(0, this.cursorPos)
    const lastHashIndex = textBeforeCursor.lastIndexOf("#")

    if (lastHashIndex !== -1) {
      // Ensure there are no spaces between # and cursor (simple implementation)
      // Or allow spaces if we want "multi word" file search? usually filenames don't have spaces or we stop at space.
      // Let's assume filenames might have spaces but usually we stop searching on newline or some chars.
      // For now: search until space.
      const query = textBeforeCursor.slice(lastHashIndex + 1)
      
      // If there is a space after #, we might close dropdown or continue. 
      // Convention: #filename triggers. If I type "#file name", usually spaces break the tag unless escaped.
      // Let's close dropdown if there's a space.
      if (query.includes(" ")) {
        this.isDropdownOpen = false
        return
      }

      this.searchStartPos = lastHashIndex
      this.searchResults = this.fileRegistry.search(query)
      this.isDropdownOpen = this.searchResults.length > 0
      this.dropdownIndex = 0
    } else {
      this.isDropdownOpen = false
    }
  }

  private selectFile() {
    if (!this.searchResults[this.dropdownIndex]) return

    const file = this.searchResults[this.dropdownIndex]
    // Format: [filename](path)
    const textToInsert = `[${file.name}](${file.path}) `
    
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
        const file = this.searchResults[i]
        const isSelected = i === this.dropdownIndex
        const icon = this.getFileIcon(file.type)
        const prefix = isSelected ? "> " : "  "
        const style = isSelected ? "\x1b[36m" : "\x1b[37m" // Cyan for selected, White for others
        const reset = "\x1b[0m"
        
        process.stdout.write(ERASE_LINE + `${style}${prefix}${icon} ${file.path}${reset}\n`)
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
