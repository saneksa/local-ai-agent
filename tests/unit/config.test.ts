import { describe, it, expect } from "vitest";
import { McpConfigSchema } from "../../src/mcp/config";
import { z } from "zod";

describe("McpConfigSchema", () => {
  it("should validate stdio transport", () => {
    const config = {
      servers: [
        {
          id: "local",
          name: "Local",
          transport: {
            type: "stdio",
            command: "echo",
            args: ["hello"],
            env: { VAR: "value" }
          },
        },
      ],
    };

    const parsed = McpConfigSchema.parse(config);
    expect(parsed.servers[0].transport.type).toBe("stdio");
    if (parsed.servers[0].transport.type === "stdio") {
        expect(parsed.servers[0].transport.env).toEqual({ VAR: "value" });
    }
  });

  it("should validate sse transport", () => {
    const config = {
      servers: [
        {
          id: "remote",
          name: "Remote",
          transport: {
            type: "sse",
            url: "http://localhost:8000/sse",
            headers: { Authorization: "Bearer token" }
          },
        },
      ],
    };

    const parsed = McpConfigSchema.parse(config);
    expect(parsed.servers[0].transport.type).toBe("sse");
    if (parsed.servers[0].transport.type === "sse") {
        expect(parsed.servers[0].transport.url).toBe("http://localhost:8000/sse");
        expect(parsed.servers[0].transport.headers).toEqual({ Authorization: "Bearer token" });
    }
  });

  it("should fail on invalid url", () => {
    const config = {
      servers: [
        {
          id: "remote",
          name: "Remote",
          transport: {
            type: "sse",
            url: "not-a-url",
          },
        },
      ],
    };

    expect(() => McpConfigSchema.parse(config)).toThrow(z.ZodError);
  });
});
