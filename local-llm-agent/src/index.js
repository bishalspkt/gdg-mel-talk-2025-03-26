import { tool } from "@langchain/core/tools";
import { ChatOllama } from "@langchain/ollama";
import { z } from "zod";
import { HumanMessage, ToolMessage, SystemMessage } from "@langchain/core/messages";
import * as fs from "fs";
import * as path from "path";
import * as readline from 'readline';

// Define the list files tool
const listDirectoryTool = tool((input) => {
  try {
    const entries = fs.readdirSync(input.directory);
    const detailedEntries = entries.map(entry => {
      const fullPath = path.resolve(input.directory, entry);
      const stats = fs.statSync(fullPath);
      
      return {
        name: entry,
        absolutePath: fullPath,
        type: stats.isDirectory() ? 'directory' : 'file',
        size: stats.size,
        created: stats.birthtime,
        modified: stats.mtime,
        isHidden: entry.startsWith('.'),
        extension: path.extname(entry) || null
      };
    });
    
    return JSON.stringify(detailedEntries, null, 2);
  } catch (error) {
    return `Error listing files: ${error.message}`;
  }
}, {
  name: "list_directory",
  description: "List all files in the specified directory with detailed information including absolute paths, type, size, and timestamps",
  schema: z.object({
    directory: z.string().describe("The directory path to list files from"),
  }),
});

// Define the read file tool
const readFileTool = tool((input) => {
  try {
    const content = fs.readFileSync(path.resolve(input.filepath), 'utf-8');
    return content;
  } catch (error) {
    return `Error reading file: ${error.message}`;
  }
}, {
  name: "read_file",
  description: "Read the contents of a specified file",
  schema: z.object({
    filepath: z.string().describe("The file path to read"),
  }),
});

async function main(modelName) {
  // Initialize readline interface
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  // Initialize LLM with tools
  const model = new ChatOllama({
    model: modelName,
  });
  const modelWithTools = model.bindTools([listDirectoryTool, readFileTool]);
  
  // Initialize conversation history
  const history = [
    new SystemMessage("You are a helpful assistant that can use tools to list directory and read files. Your base directory is ./data/. Answer users questions by using the files in the directory. If unspecified, use the list_directory tool to get the files in the directory.")
  ];

  // Function to process a single query
  async function processQuery(query) {
    history.push(new HumanMessage(query));
    
    // Process conversation until completion
    let conversationComplete = false;
    
    while (!conversationComplete) {
      // Get AI response
      const aiResponse = await modelWithTools.invoke(history);
      console.log("\nAI:", aiResponse.content);
      history.push(aiResponse);
      
      // Check if the AI response contains tool calls
      if (!aiResponse.tool_calls || aiResponse.tool_calls.length === 0) {
        console.log("\n--- Final Answer ---");
        conversationComplete = true;
        continue;
      }
      
      // Process all tool calls
      console.log("\n--- Processing Tool Calls ---");
      await processToolCalls(aiResponse.tool_calls, history);
    }
  }

  // Function to ask for user input
  function askQuestion() {
    rl.question('\nEnter your question (or type "exit" to quit): ', async (input) => {
      if (input.toLowerCase() === 'exit') {
        rl.close();
        return;
      }
      await processQuery(input);
      askQuestion();
    });
  }

  // Start the conversation
  console.log('Welcome! Ask me questions about the files in the ./data/ directory.');
  askQuestion();
}

/**
 * Process tool calls and add results to conversation history
 * @param {Array} toolCalls - Array of tool calls from the AI
 * @param {Array} history - Conversation history array
 */
async function processToolCalls(toolCalls, history) {
  for (const toolCall of toolCalls) {
    const { name, args, id } = toolCall;
    console.log(`Executing: ${name}`);
    
    // Execute the appropriate tool
    let result;
    try {
      if (name === "list_directory") {
        result = await listDirectoryTool.invoke({ directory: args.directory });
        console.log(`Listed files in: ${args.directory}`);
      } else if (name === "read_file") {
        result = await readFileTool.invoke({ filepath: args.filepath });
        console.log(`Read file: ${args.filepath}`);
      } else {
        result = `Unknown tool: ${name}`;
        console.log(`Error: ${result}`);
      }
    } catch (error) {
      result = `Error executing ${name}: ${error.message}`;
      console.log(`Error: ${result}`);
    }
    
    // Add tool result to history
    const toolMessage = new ToolMessage({
      tool_call_id: id ?? "",
      content: result,
    });
    history.push(toolMessage);
  }
}

main("qwen2.5:32b").catch(error => {
  console.error("Error in main process:", error);
});
