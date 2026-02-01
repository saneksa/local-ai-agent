import * as fs from "fs"
import * as path from "path"

export interface FileInfo {
  name: string
  path: string
  type: string
}

export class FileRegistry {
  private files: FileInfo[] = []
  private rootDir: string
  private ignorePatterns: string[] = ["node_modules", ".git", "dist", ".DS_Store", "coverage"]

  constructor(rootDir: string) {
    this.rootDir = rootDir
  }

  async scan(): Promise<void> {
    this.files = []
    await this.scanRecursively(this.rootDir)
  }

  private async scanRecursively(dir: string): Promise<void> {
    const entries = await fs.promises.readdir(dir, { withFileTypes: true })

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name)
      const relativePath = path.relative(this.rootDir, fullPath)

      if (this.shouldIgnore(relativePath)) {
        continue
      }

      if (entry.isDirectory()) {
        await this.scanRecursively(fullPath)
      } else {
        this.files.push({
          name: entry.name,
          path: relativePath,
          type: path.extname(entry.name).substring(1) || "txt",
        })
      }
    }
  }

  private shouldIgnore(filePath: string): boolean {
    return this.ignorePatterns.some((pattern) => filePath.split(path.sep).includes(pattern))
  }

  search(query: string): FileInfo[] {
    const lowerQuery = query.toLowerCase()
    return this.files
      .filter((file) => file.path.toLowerCase().includes(lowerQuery))
      .sort((a, b) => {
        // Prioritize exact filename matches
        const aName = a.name.toLowerCase()
        const bName = b.name.toLowerCase()
        if (aName.startsWith(lowerQuery) && !bName.startsWith(lowerQuery)) return -1
        if (!aName.startsWith(lowerQuery) && bName.startsWith(lowerQuery)) return 1
        return 0
      })
      .slice(0, 10) // Limit results
  }

  getFiles(): FileInfo[] {
    return this.files
  }
}
