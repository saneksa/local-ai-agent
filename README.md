# Local Agent 🤖

**A terminal-based AI agent that runs locally and interacts with your file system and shell.**

## 🚀 What is this?

**Local Agent** is a lightweight TypeScript tool that gives your LLM (Large Language Model) "hands". Instead of just chatting, this agent can:

1.  **Read and Write files** in your project.
2.  **Execute Shell Commands** (like `npm install`, `git status`, etc.).
3.  **Reason autonomously** to solve complex tasks.

It is designed to work out-of-the-box with **local LLMs** (like those running in [LM Studio](https://lmstudio.ai/)), keeping your data private and your costs zero.

## ✨ Key Features

- 🧠 **Local LLM Integration**: Connects to any OpenAI-compatible API (defaults to LM Studio at `http://localhost:1234/v1`).
- 📂 **File System Tools**: The agent can `list_files`, `read_file`, and `write_file` to navigate and modify your codebase.
- 💻 **Shell Command Execution**: The agent can run terminal commands using `run_command`.
- 🛡️ **Human-in-the-loop Safety**: Dangerous actions (like running shell commands) require your explicit confirmation (Y/N).
- 🔒 **Security**: Path traversal protection and environment variable configuration.
- ⚡ **TypeScript & Extensible**: Built with modern TypeScript, easy to extend with your own custom tools.

## 🛠️ Prerequisites

1.  **Node.js** (v18 or higher)
2.  **LM Studio** (or any other OpenAI-compatible local server)
    - Start the local server.
    - Ensure it's listening on `http://localhost:1234/v1`.

## 📦 Installation & Usage

1.  **Clone the repository:**

    ```bash
    git clone https://github.com/saneksa/local-agent.git
    cd local-agent
    ```

2.  **Install dependencies:**

    ```bash
    npm install
    ```

3.  **Configuration:**

    Copy `.env.example` to `.env`:
    ```bash
    cp .env.example .env
    ```
    Edit `.env` if you need to change the API URL or Key.

4.  **Start the Agent (Development Mode):**

    ```bash
    npm start
    ```

5.  **Start the Agent (Production Mode):**
    ```bash
    npm run build
    node dist/index.js
    ```

## 🧪 Testing

The project uses **Vitest** for testing.

```bash
# Run tests
npm test

# Run tests with coverage
npm run test:coverage
```

## ⚙️ Development

- **Linting**: `npm run lint`
- **Formatting**: `npm run format`

## 💡 Example Scenario

Once started, you can ask the agent to perform tasks:

```text
You: Create a simple Express server in a file named server.ts
```

**The Agent will:**

1.  Think about the task.
2.  Call the `write_file` tool to create `server.ts` with the code.
3.  Confirm to you that the file was created.

```text
You: Now install the necessary dependencies for it.
```

**The Agent will:**

1.  Call the `run_command` tool with `npm install express @types/express`.
2.  **Ask for your permission**: `⚠️ Agent wants to execute command: "..." Do you allow this? (y/N)`
3.  Execute the command upon approval.

## 🤝 Contributing

Contributions are welcome! If you want to add new tools (e.g., web search, database access), check out `src/tools.ts`.

## 📄 License

MIT
