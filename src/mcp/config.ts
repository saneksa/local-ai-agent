import { z } from "zod"

export const McpServerConfigSchema = z.object({
  id: z.string().describe("Unique identifier for the server"),
  name: z.string().describe("Human readable name"),
  transport: z.union([
    z.object({
      type: z.literal("stdio"),
      command: z.string(),
      args: z.array(z.string()).default([]),
      env: z.record(z.string(), z.string()).optional(),
    }),
    z.object({
      type: z.literal("sse"),
      url: z.url(),
      headers: z.record(z.string(), z.string()).optional(), // For Auth
    }),
  ]),
  enabled: z.boolean().default(true),
})

export const McpConfigSchema = z.object({
  servers: z.array(McpServerConfigSchema),
})

export type McpServerConfig = z.infer<typeof McpServerConfigSchema>
export type McpConfig = z.infer<typeof McpConfigSchema>
