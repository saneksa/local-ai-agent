import { describe, it, expect, vi } from "vitest"
import { executeTool, validatePath } from "../../src/tools"

describe("Path Validation", () => {
  it("should allow paths within the current working directory", () => {
    expect(() => validatePath("test.txt")).not.toThrow()
    expect(() => validatePath("src/index.ts")).not.toThrow()
  })

  it("should deny paths outside the current working directory", () => {
    expect(() => validatePath("../outside.txt")).toThrow(/Access denied/)
    expect(() => validatePath("/etc/passwd")).toThrow(/Access denied/)
  })

  it("should deny path traversal attacks", () => {
    expect(() => validatePath("./src/../../outside.txt")).toThrow(/Access denied/)
  })
})

describe("executeTool", () => {
  const mockConfirm = vi.fn().mockResolvedValue(true)

  it("should return error for unknown tool", async () => {
    const result = await executeTool("unknown_tool", {}, mockConfirm)
    expect(result).toMatch(/Error: Unknown tool/)
  })

  it("should return error for invalid path in read_file", async () => {
    const result = await executeTool("read_file", { filePath: "../secret.txt" }, mockConfirm)
    expect(result).toMatch(/Access denied/)
  })
})
