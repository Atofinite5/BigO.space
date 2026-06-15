// ProcessingHelper.ts
import fs from "node:fs"
import path from "node:path"
import { ScreenshotHelper } from "./ScreenshotHelper"
import { IProcessingHelperDeps } from "./main"
import * as axios from "axios"
import { app, BrowserWindow, dialog } from "electron"
import { OpenAI } from "openai"
import { configHelper } from "./ConfigHelper"
import { authHelper } from "./AuthHelper"
import { bigoApi } from "./BigOApiClient"
import Anthropic from '@anthropic-ai/sdk';
import {
  initMemory,
  retrieveSimilar,
  storeMemory,
  findDirectAnswer,
  formatMemoryContext,
  detectPattern,
  isEnabled as isMemoryEnabled,
  RetrievedMemory
} from "./MemoryHelper"

// Interface for Gemini API requests
interface GeminiMessage {
  role: string;
  parts: Array<{
    text?: string;
    inlineData?: {
      mimeType: string;
      data: string;
    }
  }>;
}

interface GeminiResponse {
  candidates: Array<{
    content: {
      parts: Array<{
        text: string;
      }>;
    };
    finishReason: string;
  }>;
}
interface AnthropicMessage {
  role: 'user' | 'assistant';
  content: Array<{
    type: 'text' | 'image';
    text?: string;
    source?: {
      type: 'base64';
      media_type: string;
      data: string;
    };
  }>;
}
export class ProcessingHelper {
  private deps: IProcessingHelperDeps
  private screenshotHelper: ScreenshotHelper
  private openaiClient: OpenAI | null = null
  private geminiApiKey: string | null = null
  private anthropicClient: Anthropic | null = null
  private groqApiKey: string | null = null

  // AbortControllers for API requests
  private currentProcessingAbortController: AbortController | null = null
  private currentExtraProcessingAbortController: AbortController | null = null

  constructor(deps: IProcessingHelperDeps) {
    this.deps = deps
    this.screenshotHelper = deps.getScreenshotHelper()
    
    // Initialize AI client based on config
    this.initializeAIClient();
    this.initializeMemory();

    // Listen for config changes to re-initialize the AI client
    configHelper.on('config-updated', () => {
      this.initializeAIClient();
      this.initializeMemory();
    });
  }

  /**
   * Initialize the local pgvector memory store. Best-effort: any failure
   * disables memory but never blocks the rest of the app.
   */
  private initializeMemory(): void {
    const config = configHelper.loadConfig();
    initMemory({
      enabled: !!config.memoryEnabled,
      connectionString: config.memoryConnectionString
    }).catch((e) => {
      console.warn("[Memory] init error:", e?.message || e);
    });
  }
  
  /**
   * Initialize or reinitialize the AI client with current config
   */
  private initializeAIClient(): void {
    try {
      const config = configHelper.loadConfig();
      
      if (config.apiProvider === "openai") {
        if (config.apiKey) {
          this.openaiClient = new OpenAI({ 
            apiKey: config.apiKey,
            timeout: 60000, // 60 second timeout
            maxRetries: 2   // Retry up to 2 times
          });
          this.geminiApiKey = null;
          this.anthropicClient = null;
          console.log("OpenAI client initialized successfully");
        } else {
          this.openaiClient = null;
          this.geminiApiKey = null;
          this.anthropicClient = null;
          console.warn("No API key available, OpenAI client not initialized");
        }
      } else if (config.apiProvider === "xai") {
        if (config.apiKey) {
          this.openaiClient = new OpenAI({
            apiKey: config.apiKey,
            baseURL: "https://api.x.ai/v1",
            timeout: 60000,
            maxRetries: 2
          });
          this.geminiApiKey = null;
          this.anthropicClient = null;
          console.log("xAI client initialized successfully");
        } else {
          this.openaiClient = null;
          this.geminiApiKey = null;
          this.anthropicClient = null;
          console.warn("No API key available, xAI client not initialized");
        }
      } else if (config.apiProvider === "gemini"){
        // Gemini client initialization
        this.openaiClient = null;
        this.anthropicClient = null;
        if (config.apiKey) {
          this.geminiApiKey = config.apiKey;
          console.log("Gemini API key set successfully");
        } else {
          this.openaiClient = null;
          this.geminiApiKey = null;
          this.anthropicClient = null;
          console.warn("No API key available, Gemini client not initialized");
        }
      } else if (config.apiProvider === "anthropic") {
        // Reset other clients
        this.openaiClient = null;
        this.geminiApiKey = null;
        this.groqApiKey = null;
        if (config.apiKey) {
          this.anthropicClient = new Anthropic({
            apiKey: config.apiKey,
            timeout: 60000,
            maxRetries: 2
          });
          console.log("Anthropic client initialized successfully");
        } else {
          this.openaiClient = null;
          this.geminiApiKey = null;
          this.anthropicClient = null;
          this.groqApiKey = null;
          console.warn("No API key available, Anthropic client not initialized");
        }
      } else if (config.apiProvider === "groq") {
        // Groq client initialization
        this.openaiClient = null;
        this.anthropicClient = null;
        this.geminiApiKey = null;
        if (config.apiKey) {
          this.groqApiKey = config.apiKey;
          console.log("Groq API key set successfully");
        } else {
          this.openaiClient = null;
          this.geminiApiKey = null;
          this.anthropicClient = null;
          this.groqApiKey = null;
          console.warn("No API key available, Groq client not initialized");
        }
      } else if (config.apiProvider === "bigo-free") {
        // bigo-free: server-side Groq key proxied through BigO backend.
        // No user API key required — clears all local clients.
        this.openaiClient = null;
        this.geminiApiKey = null;
        this.anthropicClient = null;
        this.groqApiKey = null;
        console.log("bigo-free provider active — using backend Groq proxy");
      }
    } catch (error) {
      console.error("Failed to initialize AI client:", error);
      this.openaiClient = null;
      this.geminiApiKey = null;
      this.anthropicClient = null;
      this.groqApiKey = null;
    }
  }

  private async waitForInitialization(
    mainWindow: BrowserWindow
  ): Promise<void> {
    let attempts = 0
    const maxAttempts = 50 // 5 seconds total

    while (attempts < maxAttempts) {
      const isInitialized = await mainWindow.webContents.executeJavaScript(
        "window.__IS_INITIALIZED__"
      )
      if (isInitialized) return
      await new Promise((resolve) => setTimeout(resolve, 100))
      attempts++
    }
    throw new Error("App failed to initialize after 5 seconds")
  }

  private async getCredits(): Promise<number> {
    const mainWindow = this.deps.getMainWindow()
    if (!mainWindow) return 999 // Unlimited credits in this version

    try {
      await this.waitForInitialization(mainWindow)
      return 999 // Always return sufficient credits to work
    } catch (error) {
      console.error("Error getting credits:", error)
      return 999 // Unlimited credits as fallback
    }
  }

  /**
   * Build the structured PROBLEM / CONSTRAINTS / EXAMPLES / TOPIC block that
   * is injected into every coding-language solution prompt. Pulling these
   * fields out of the question text and labelling them explicitly lets the
   * solution model see constraints + examples as first-class inputs instead
   * of buried prose.
   */
  private formatProblemSection(problemInfo: any, defaultTopic = "Computer Science"): string {
    const lines: string[] = [];
    lines.push("PROBLEM:");
    lines.push(problemInfo?.question || problemInfo?.problem_statement || "(missing)");
    lines.push("");

    const constraintsText =
      problemInfo?.constraints && String(problemInfo.constraints).trim();
    lines.push("CONSTRAINTS:");
    if (constraintsText) {
      lines.push(String(constraintsText));
    } else {
      lines.push(
        "(Not stated — assume LeetCode-typical limits: arrays up to 1e5 elements, values within ±1e9, time limit ~1s.)"
      );
    }
    lines.push("");

    if (Array.isArray(problemInfo?.examples) && problemInfo.examples.length > 0) {
      lines.push(
        "EXAMPLES (your code MUST produce the listed output for each input — trace through them before answering):"
      );
      problemInfo.examples.forEach((ex: any, i: number) => {
        lines.push(`Example ${i + 1}:`);
        if (ex?.input !== undefined && ex.input !== null && String(ex.input) !== "") {
          lines.push(`  Input:  ${ex.input}`);
        }
        if (ex?.output !== undefined && ex.output !== null && String(ex.output) !== "") {
          lines.push(`  Output: ${ex.output}`);
        }
        if (ex?.explanation) {
          lines.push(`  Note:   ${ex.explanation}`);
        }
      });
    } else {
      lines.push("EXAMPLES: None visible in the screenshots.");
    }
    lines.push("");

    lines.push(`TOPIC: ${problemInfo?.topic || defaultTopic}`);
    return lines.join("\n");
  }

  private solutionFormatTemplate(markdownLang: string): string {
    return `
Output — use these EXACT section headers, in this EXACT order. Do not add any other headers.

Approach:
[2-3 sentence prose: name the algorithm/pattern, WHY it fits the stated constraints, WHY it is correct for ALL valid inputs — not just the examples]
• [Key insight 1 — the core algorithmic observation]
• [Key insight 2 — how the constraint size shaped the algorithm choice]
• [Key insight 3 — which edge cases are covered and why]

Code:
\`\`\`${markdownLang}
[complete, runnable, fully implemented code]
\`\`\`

Alternative Approaches:
1. [Alternative 1 — name + one sentence on its time/space trade-off vs the chosen approach]
2. [Alternative 2 — name + one sentence on when it would be better or worse]

Summary:
[One sentence: what the solution does and its overall complexity.]

Time complexity: O(...) — [reason tied to the constraint n ≤ X]
Space complexity: O(...) — [reason]
`;
  }

  /**
   * Build the embedding query for pgvector memory retrieval. Combining the
   * question with the constraints lets cosine similarity match on
   * algorithmic shape (size limits, edge-case rules) and not just topic
   * keywords. Used for both retrieve and store so embeddings stay symmetric.
   */
  /**
   * Parse model JSON output that may be wrapped in markdown fences or
   * surrounded by stray prose ("Here's the JSON:", trailing notes, etc).
   * Strict parse first; fall back to extracting the first balanced {...}.
   */
  private parseLooseJSON(text: string): any {
    if (!text || !String(text).trim()) {
      throw new Error("Empty response from model");
    }
    const cleaned = String(text).replace(/```json\s*|```\s*/g, "").trim();
    try {
      return JSON.parse(cleaned);
    } catch {
      const start = cleaned.indexOf("{");
      const end = cleaned.lastIndexOf("}");
      if (start !== -1 && end > start) {
        try {
          return JSON.parse(cleaned.substring(start, end + 1));
        } catch {
          /* fall through */
        }
      }
      throw new Error("Could not parse JSON from model response");
    }
  }

  /**
   * POST helper for Groq (and any other axios-backed provider) with bounded
   * retry on transient failures. Retries 5xx and network errors with
   * exponential backoff. Does NOT retry 4xx (auth/payload — those are bugs)
   * or user-cancelled requests.
   */
  private async axiosPostWithRetry(
    url: string,
    body: any,
    options: { headers?: any; signal?: AbortSignal },
    maxRetries = 2
  ): Promise<any> {
    let lastError: any;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await axios.default.post(url, body, options);
      } catch (e: any) {
        lastError = e;
        if (axios.isCancel(e)) throw e;
        const status = e?.response?.status;
        const retryable =
          !status ||
          (status >= 500 && status < 600) ||
          e?.code === "ECONNRESET" ||
          e?.code === "ETIMEDOUT" ||
          e?.code === "ENOTFOUND";
        if (!retryable || attempt >= maxRetries) throw e;
        const delay = 500 * Math.pow(2, attempt);
        await new Promise((r) => setTimeout(r, delay));
      }
    }
    throw lastError;
  }

  /**
   * Human-readable label for the active provider. Used in error messages
   * so users see e.g. "Invalid Gemini API key" instead of a hardcoded
   * "Invalid OpenAI API key" regardless of which provider failed.
   */
  private providerLabel(): string {
    const config = configHelper.loadConfig();
    switch (config.apiProvider) {
      case "openai": return "OpenAI";
      case "xai": return "xAI";
      case "gemini": return "Gemini";
      case "anthropic": return "Anthropic";
      case "groq": return "Groq";
      case "bigo-free": return "BigO (Free)";
      default: return String(config.apiProvider || "AI");
    }
  }

  /**
   * True for providers that share the OpenAI Chat Completions wire format
   * (and reuse `this.openaiClient`). Currently: openai, xai.
   */
  private isOpenAIWireFormat(): boolean {
    const config = configHelper.loadConfig();
    return config.apiProvider === "openai" || config.apiProvider === "xai";
  }

  private buildMemoryQuery(problemInfo: any): string {
    const parts: string[] = [];
    const q = problemInfo?.question || problemInfo?.problem_statement || "";
    if (q) parts.push(q);
    if (problemInfo?.constraints && String(problemInfo.constraints).trim()) {
      parts.push(`Constraints: ${String(problemInfo.constraints).trim()}`);
    }
    return parts.join("\n\n");
  }

  private async getLanguage(): Promise<string> {
    try {
      // Get language from config
      const config = configHelper.loadConfig();
      if (config.language) {
        return config.language;
      }
      
      // Fallback to window variable if config doesn't have language
      const mainWindow = this.deps.getMainWindow()
      if (mainWindow) {
        try {
          await this.waitForInitialization(mainWindow)
          const language = await mainWindow.webContents.executeJavaScript(
            "window.__LANGUAGE__"
          )

          if (
            typeof language === "string" &&
            language !== undefined &&
            language !== null
          ) {
            return language;
          }
        } catch (err) {
          console.warn("Could not get language from window", err);
        }
      }
      
      // Default fallback
      return "python";
    } catch (error) {
      console.error("Error getting language:", error)
      return "python"
    }
  }

  public async processScreenshots(): Promise<void> {
    const mainWindow = this.deps.getMainWindow()
    if (!mainWindow) return

    const config = configHelper.loadConfig();
    
    // First verify we have a valid AI client / API key for the active provider.
    // Covers all five providers (openai, xai, gemini, anthropic, groq) so the
    // renderer reliably gets API_KEY_INVALID and opens the Settings dialog.
    // bigo-free is exempt — it uses the backend proxy, no local key needed.
    const provider = config.apiProvider;
    const needsOpenAIClient = provider === "openai" || provider === "xai";
    let providerKeyMissing = false;

    if (provider !== "bigo-free") {
      if (needsOpenAIClient && !this.openaiClient) {
        this.initializeAIClient();
        providerKeyMissing = !this.openaiClient;
      } else if (provider === "gemini" && !this.geminiApiKey) {
        this.initializeAIClient();
        providerKeyMissing = !this.geminiApiKey;
      } else if (provider === "anthropic" && !this.anthropicClient) {
        this.initializeAIClient();
        providerKeyMissing = !this.anthropicClient;
      } else if (provider === "groq" && !this.groqApiKey) {
        this.initializeAIClient();
        providerKeyMissing = !this.groqApiKey;
      }
    }

    if (providerKeyMissing) {
      console.error(`${this.providerLabel()} client/key not initialized`);
      mainWindow.webContents.send(
        this.deps.PROCESSING_EVENTS.API_KEY_INVALID
      );
      return;
    }

    const view = this.deps.getView()
    console.log("Processing screenshots in view:", view)

    if (view === "queue") {
      mainWindow.webContents.send(this.deps.PROCESSING_EVENTS.INITIAL_START)
      const screenshotQueue = this.screenshotHelper.getScreenshotQueue()
      console.log("Processing main queue screenshots:", screenshotQueue)
      
      // Check if the queue is empty
      if (!screenshotQueue || screenshotQueue.length === 0) {
        console.log("No screenshots found in queue");
        mainWindow.webContents.send(this.deps.PROCESSING_EVENTS.NO_SCREENSHOTS);
        return;
      }

      // Check that files actually exist
      const existingScreenshots = screenshotQueue.filter(path => fs.existsSync(path));
      if (existingScreenshots.length === 0) {
        console.log("Screenshot files don't exist on disk");
        mainWindow.webContents.send(this.deps.PROCESSING_EVENTS.NO_SCREENSHOTS);
        return;
      }

      // ── BigO quota gate ───────────────────────────────────────────────────
      // Enforce the daily free-tier limit. canSolve() tracks the solve against
      // the backend and flips auth state to "no_subscription" (which surfaces
      // the paywall in the renderer) when the quota is exhausted.
      const quota = await authHelper.canSolve();
      if (!quota.allowed) {
        console.log("[BigO] solve blocked — quota exhausted");
        mainWindow.webContents.send(
          this.deps.PROCESSING_EVENTS.INITIAL_SOLUTION_ERROR,
          quota.reason || "Daily solve limit reached. Upgrade to Pro for unlimited."
        );
        return;
      }

      try {
        // Initialize AbortController
        this.currentProcessingAbortController = new AbortController()
        const { signal } = this.currentProcessingAbortController

        const screenshots = await Promise.all(
          existingScreenshots.map(async (path) => {
            try {
              return {
                path,
                preview: await this.screenshotHelper.getImagePreview(path),
                data: fs.readFileSync(path).toString('base64')
              };
            } catch (err) {
              console.error(`Error reading screenshot ${path}:`, err);
              return null;
            }
          })
        )

        // Filter out any nulls from failed screenshots
        const validScreenshots = screenshots.filter(Boolean);
        
        if (validScreenshots.length === 0) {
          throw new Error("Failed to load screenshot data");
        }

        const result = await this.processScreenshotsHelper(validScreenshots, signal)

        if (!result.success) {
          console.log("Processing failed:", result.error)
          if (result.error?.includes("API Key") || result.error?.includes("OpenAI") || result.error?.includes("Gemini")) {
            mainWindow.webContents.send(
              this.deps.PROCESSING_EVENTS.API_KEY_INVALID
            )
          } else {
            mainWindow.webContents.send(
              this.deps.PROCESSING_EVENTS.INITIAL_SOLUTION_ERROR,
              result.error
            )
          }
          // Reset view back to queue on error
          console.log("Resetting view to queue due to error")
          this.deps.setView("queue")
          return
        }

        // Only set view to solutions if processing succeeded
        console.log("Setting view to solutions after successful processing")
        mainWindow.webContents.send(
          this.deps.PROCESSING_EVENTS.SOLUTION_SUCCESS,
          result.data
        )
        this.deps.setView("solutions")
      } catch (error: any) {
        mainWindow.webContents.send(
          this.deps.PROCESSING_EVENTS.INITIAL_SOLUTION_ERROR,
          error
        )
        console.error("Processing error:", error)
        if (axios.isCancel(error)) {
          mainWindow.webContents.send(
            this.deps.PROCESSING_EVENTS.INITIAL_SOLUTION_ERROR,
            "Processing was canceled by the user."
          )
        } else {
          mainWindow.webContents.send(
            this.deps.PROCESSING_EVENTS.INITIAL_SOLUTION_ERROR,
            error.message || "Server error. Please try again."
          )
        }
        // Reset view back to queue on error
        console.log("Resetting view to queue due to error")
        this.deps.setView("queue")
      } finally {
        this.currentProcessingAbortController = null
      }
    } else {
      // view == 'solutions'
      const extraScreenshotQueue =
        this.screenshotHelper.getExtraScreenshotQueue()
      console.log("Processing extra queue screenshots:", extraScreenshotQueue)
      
      // Check if the extra queue is empty
      if (!extraScreenshotQueue || extraScreenshotQueue.length === 0) {
        console.log("No extra screenshots found in queue");
        mainWindow.webContents.send(this.deps.PROCESSING_EVENTS.NO_SCREENSHOTS);
        
        return;
      }

      // Check that files actually exist
      const existingExtraScreenshots = extraScreenshotQueue.filter(path => fs.existsSync(path));
      if (existingExtraScreenshots.length === 0) {
        console.log("Extra screenshot files don't exist on disk");
        mainWindow.webContents.send(this.deps.PROCESSING_EVENTS.NO_SCREENSHOTS);
        return;
      }
      
      mainWindow.webContents.send(this.deps.PROCESSING_EVENTS.DEBUG_START)

      // Initialize AbortController
      this.currentExtraProcessingAbortController = new AbortController()
      const { signal } = this.currentExtraProcessingAbortController

      try {
        // Get all screenshots (both main and extra) for processing
        const allPaths = [
          ...this.screenshotHelper.getScreenshotQueue(),
          ...existingExtraScreenshots
        ];
        
        const screenshots = await Promise.all(
          allPaths.map(async (path) => {
            try {
              if (!fs.existsSync(path)) {
                console.warn(`Screenshot file does not exist: ${path}`);
                return null;
              }
              
              return {
                path,
                preview: await this.screenshotHelper.getImagePreview(path),
                data: fs.readFileSync(path).toString('base64')
              };
            } catch (err) {
              console.error(`Error reading screenshot ${path}:`, err);
              return null;
            }
          })
        )
        
        // Filter out any nulls from failed screenshots
        const validScreenshots = screenshots.filter(Boolean);
        
        if (validScreenshots.length === 0) {
          throw new Error("Failed to load screenshot data for debugging");
        }
        
        console.log(
          "Combined screenshots for processing:",
          validScreenshots.map((s) => s.path)
        )

        const result = await this.processExtraScreenshotsHelper(
          validScreenshots,
          signal
        )

        if (result.success) {
          this.deps.setHasDebugged(true)
          mainWindow.webContents.send(
            this.deps.PROCESSING_EVENTS.DEBUG_SUCCESS,
            result.data
          )
        } else {
          mainWindow.webContents.send(
            this.deps.PROCESSING_EVENTS.DEBUG_ERROR,
            result.error
          )
        }
      } catch (error: any) {
        if (axios.isCancel(error)) {
          mainWindow.webContents.send(
            this.deps.PROCESSING_EVENTS.DEBUG_ERROR,
            "Extra processing was canceled by the user."
          )
        } else {
          mainWindow.webContents.send(
            this.deps.PROCESSING_EVENTS.DEBUG_ERROR,
            error.message
          )
        }
      } finally {
        this.currentExtraProcessingAbortController = null
      }
    }
  }

  private async processScreenshotsHelper(
    screenshots: Array<{ path: string; data: string }>,
    signal: AbortSignal
  ) {
    try {
      const config = configHelper.loadConfig();
      const language = await this.getLanguage();
      const mainWindow = this.deps.getMainWindow();
      
      // Step 1: Extract problem info using AI Vision API (OpenAI or Gemini)
      const imageDataList = screenshots.map(screenshot => screenshot.data);
      
      // Update the user on progress
      if (mainWindow) {
        mainWindow.webContents.send("processing-status", {
          message: "Analyzing problem from screenshots...",
          progress: 20
        });
      }

      let problemInfo;

      if (this.isOpenAIWireFormat()) {
        // OpenAI / xAI — both share the OpenAI Chat Completions wire format
        // and reuse this.openaiClient (xAI is a baseURL override).
        // Verify OpenAI client
        if (!this.openaiClient) {
          this.initializeAIClient(); // Try to reinitialize
          
          if (!this.openaiClient) {
            return {
              success: false,
              error: "OpenAI API key not configured or invalid. Please check your settings."
            };
          }
        }

        // Use OpenAI for processing
        const messages = [
          {
            role: "system" as const,
            content: `Extract the coding/MCQ problem from the screenshot(s). If there are multiple images, combine them into one coherent problem. Return JSON ONLY (no markdown fences, no preamble) with this exact shape:
{
  "question": "full problem statement, cleaned up",
  "options": ["MCQ options if any, else []"],
  "topic": "1-3 word topic, e.g. 'graph traversal'",
  "type": "mcq" | "coding",
  "constraints": "input limits / value ranges / time-memory limits / special rules verbatim. Empty string if none.",
  "examples": [{"input": "verbatim", "output": "verbatim", "explanation": "optional"}]
}`
          },
          {
            role: "user" as const,
            content: [
              {
                type: "text" as const,
                text: `Extract the problem from these ${imageDataList.length} screenshot(s). Combine all images into one problem. User language: ${language}. Return ONLY the JSON object specified by the system message — include constraints and examples whenever the screenshots contain them.`
              },
              ...imageDataList.map(data => ({
                type: "image_url" as const,
                image_url: { url: `data:image/png;base64,${data}` }
              }))
            ]
          }
        ];

        // Send to OpenAI Vision API. `{ signal }` ensures Cmd+Shift+R cancels
        // an in-flight request (the SDK aborts the underlying fetch).
        const extractionResponse = await this.openaiClient.chat.completions.create({
          model: config.extractionModel || "gpt-4o",
          messages: messages,
          max_tokens: 4000,
          temperature: 0.2
        }, { signal });

        // Parse the response (tolerant of markdown fences and stray prose).
        try {
          const responseText = extractionResponse.choices[0].message.content;
          problemInfo = this.parseLooseJSON(responseText);
        } catch (error) {
          console.error("Error parsing OpenAI response:", error);
          return {
            success: false,
            error: "Failed to parse problem information. Please try again or use clearer screenshots."
          };
        }
      } else if (config.apiProvider === "gemini")  {
        // Use Gemini API
        if (!this.geminiApiKey) {
          return {
            success: false,
            error: "Gemini API key not configured. Please check your settings."
          };
        }

        try {
          // Create Gemini message structure
          const geminiMessages: GeminiMessage[] = [
            {
              role: "user",
              parts: [
                {
                  text: `Extract the problem from these ${imageDataList.length} screenshot(s). Combine all images into one coherent problem. User language: ${language}.

Return JSON ONLY (no markdown fences, no preamble) with this exact shape:
{
  "question": "full problem statement, cleaned up",
  "options": ["MCQ options if any, else []"],
  "topic": "1-3 word topic, e.g. 'graph traversal'",
  "type": "mcq" | "coding",
  "constraints": "input limits / value ranges / time-memory limits / special rules verbatim. Empty string if none stated.",
  "examples": [{"input": "verbatim", "output": "verbatim", "explanation": "optional"}]
}

Include constraints and examples whenever the screenshots contain them — they are critical for matching past memory and verifying the solution.`
                },
                ...imageDataList.map(data => ({
                  inlineData: {
                    mimeType: "image/png",
                    data: data
                  }
                }))
              ]
            }
          ];

          // Make API request to Gemini
          const response = await axios.default.post(
            `https://generativelanguage.googleapis.com/v1beta/models/${config.extractionModel || "gemini-2.0-flash"}:generateContent?key=${this.geminiApiKey}`,
            {
              contents: geminiMessages,
              generationConfig: {
                temperature: 0.2,
                maxOutputTokens: 4000
              }
            },
            { signal }
          );

          const responseData = response.data as GeminiResponse;
          
          if (!responseData.candidates || responseData.candidates.length === 0) {
            throw new Error("Empty response from Gemini API");
          }
          
          const responseText = responseData.candidates[0].content.parts[0].text;
          problemInfo = this.parseLooseJSON(responseText);
        } catch (error) {
          console.error("Error using Gemini API:", error);
          return {
            success: false,
            error: "Failed to process with Gemini API. Please check your API key or try again later."
          };
        }
      } else if (config.apiProvider === "anthropic") {
        if (!this.anthropicClient) {
          return {
            success: false,
            error: "Anthropic API key not configured. Please check your settings."
          };
        }

        try {
          const messages = [
            {
              role: "user" as const,
              content: [
                {
                  type: "text" as const,
                  text: `Analyze these ${imageDataList.length} screenshot(s). If multiple images, combine them into one coherent problem. Extract all relevant information. User language context: ${language}.

Return JSON ONLY (no markdown fences, no preamble) with this exact shape:
{
  "question": "full problem statement, cleaned up",
  "options": ["MCQ options if any, else []"],
  "topic": "1-3 word topic, e.g. 'graph traversal'",
  "type": "mcq" | "coding",
  "constraints": "input limits / value ranges / time-memory limits / special rules verbatim. Empty string if none stated.",
  "examples": [{"input": "verbatim", "output": "verbatim", "explanation": "optional"}]
}

Include constraints and examples whenever the screenshots contain them — they are critical for matching past memory and verifying the solution.`
                },
                ...imageDataList.map(data => ({
                  type: "image" as const,
                  source: {
                    type: "base64" as const,
                    media_type: "image/png" as const,
                    data: data
                  }
                }))
              ]
            }
          ];

          const response = await this.anthropicClient.messages.create({
            model: config.extractionModel || "claude-3-7-sonnet-20250219",
            max_tokens: 4000,
            messages: messages,
            temperature: 0.2
          }, { signal });

          const responseText = (response.content[0] as { type: 'text', text: string }).text;
          problemInfo = this.parseLooseJSON(responseText);
        } catch (error: any) {
          console.error("Error using Anthropic API:", error);

          // Add specific handling for Claude's limitations
          if (error.status === 429) {
            return {
              success: false,
              error: "Claude API rate limit exceeded. Please wait a few minutes before trying again."
            };
          } else if (error.status === 413 || (error.message && error.message.includes("token"))) {
            return {
              success: false,
              error: "Your screenshots contain too much information for Claude to process. Switch to OpenAI or Gemini in settings which can handle larger inputs."
            };
          }

          return {
            success: false,
            error: "Failed to process with Anthropic API. Please check your API key or try again later."
          };
        }
      } else if (config.apiProvider === "groq") {
        if (!this.groqApiKey) {
          return {
            success: false,
            error: "Groq API key not configured. Please check your settings."
          };
        }

        // Default to llama-4-scout (vision-capable). If the user picked a
        // non-vision model in settings, Groq will return a clear error which
        // surfaces to the renderer via the catch below — no need for a
        // string-matching guard here.
        const modelToUse = config.extractionModel || "meta-llama/llama-4-scout-17b-16e-instruct";

        try {
          const messages = [
            {
              role: "system",
              content: `Extract the coding/MCQ problem from the screenshot(s). If multiple images, combine them into one coherent problem. Return JSON ONLY (no markdown fences, no preamble) with this exact shape:
{
  "question": "full problem statement, cleaned up",
  "options": ["MCQ options if any, else []"],
  "topic": "1-3 word topic, e.g. 'graph traversal'",
  "type": "mcq" | "coding",
  "constraints": "input limits / value ranges / time-memory limits / special rules verbatim. Empty string if none.",
  "examples": [{"input": "verbatim", "output": "verbatim", "explanation": "optional"}]
}`
            },
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: `Extract the problem from these ${imageDataList.length} screenshot(s). Combine all images into one problem. User language: ${language}. Return ONLY the JSON object specified by the system message — include constraints and examples whenever the screenshots contain them.`
                },
                ...imageDataList.map(data => ({
                  type: "image_url",
                  image_url: { url: `data:image/png;base64,${data}` }
                }))
              ]
            }
          ];

          const response = await this.axiosPostWithRetry(
            "https://api.groq.com/openai/v1/chat/completions",
            {
              model: modelToUse,
              messages: messages,
              temperature: 0.2,
              max_completion_tokens: 4000,
              stream: false
            },
            {
              headers: {
                "Authorization": `Bearer ${this.groqApiKey}`,
                "Content-Type": "application/json"
              },
              signal
            }
          );

          const responseText = response.data.choices[0].message.content;
          problemInfo = this.parseLooseJSON(responseText);
        } catch (error: any) {
          console.error("Error using Groq API:", error);
          return {
            success: false,
            error: error.response?.data?.error?.message || "Failed to process with Groq API. Please check your API key or try again later."
          };
        }
      } else if (config.apiProvider === "bigo-free") {
        // ── bigo-free: extraction via backend Groq proxy (vision) ────────────
        try {
          const systemPrompt = `Extract the coding/MCQ problem from the screenshot(s). If multiple images, combine them into one coherent problem. Return JSON ONLY (no markdown fences, no preamble) with this exact shape:
{
  "question": "full problem statement, cleaned up",
  "options": ["MCQ options if any, else []"],
  "topic": "1-3 word topic, e.g. 'graph traversal'",
  "type": "mcq" | "coding",
  "constraints": "input limits / value ranges / time-memory limits / special rules verbatim. Empty string if none.",
  "examples": [{"input": "verbatim", "output": "verbatim", "explanation": "optional"}]
}`;
          const userPrompt = `Extract the problem from these ${imageDataList.length} screenshot(s). Combine all images into one problem. User language: ${language}. Return ONLY the JSON object specified by the system message — include constraints and examples whenever the screenshots contain them.`;

          const cfg = configHelper.loadConfig();
          const result = await bigoApi.solveWithAI({
            licenseKey: cfg.licenseKey ?? null,
            deviceId: authHelper.getDeviceId(),
            systemPrompt,
            userPrompt,
            screenshots: imageDataList,
            mimeType: "image/png",
          });

          problemInfo = this.parseLooseJSON(result.content);
        } catch (error: any) {
          console.error("[bigo-free] extraction error:", error);
          return {
            success: false,
            error: error.message?.includes("Rate limit")
              ? "Free tier rate limit reached. Try again in a moment."
              : "Failed to process screenshots via BigO free tier. Check your connection."
          };
        }
      }

      // Update the user on progress
      if (mainWindow) {
        mainWindow.webContents.send("processing-status", {
          message: "Problem analyzed successfully. Preparing to generate solution...",
          progress: 40
        });
      }

      // Store problem info in AppState
      this.deps.setProblemInfo(problemInfo);

      // Send first success event
      if (mainWindow) {
        mainWindow.webContents.send(
          this.deps.PROCESSING_EVENTS.PROBLEM_EXTRACTED,
          problemInfo
        );

        // Generate solutions after successful extraction
        const solutionsResult = await this.generateSolutionsHelper(signal);
        if (solutionsResult.success) {
          // Clear any existing extra screenshots before transitioning to solutions view
          this.screenshotHelper.clearExtraScreenshotQueue();
          
          // Final progress update
          mainWindow.webContents.send("processing-status", {
            message: "Solution generated successfully",
            progress: 100
          });
          
          mainWindow.webContents.send(
            this.deps.PROCESSING_EVENTS.SOLUTION_SUCCESS,
            solutionsResult.data
          );
          return { success: true, data: solutionsResult.data };
        } else {
          throw new Error(
            solutionsResult.error || "Failed to generate solutions"
          );
        }
      }

      return { success: false, error: "Failed to process screenshots" };
    } catch (error: any) {
      // If the request was cancelled, don't retry
      if (axios.isCancel(error)) {
        return {
          success: false,
          error: "Processing was canceled by the user."
        };
      }
      
      if (error?.response?.status === 401) {
        return {
          success: false,
          error: `Invalid ${this.providerLabel()} API key. Please check your settings.`
        };
      } else if (error?.response?.status === 429) {
        return {
          success: false,
          error: `${this.providerLabel()} API rate limit exceeded or insufficient credits. Please try again later.`
        };
      } else if (error?.response?.status === 500) {
        return {
          success: false,
          error: `${this.providerLabel()} server error. Please try again later.`
        };
      }

      console.error("API Error Details:", error);
      return { 
        success: false, 
        error: error.message || "Failed to process screenshots. Please try again." 
      };
    }
  }

  private async generateSolutionsHelper(signal: AbortSignal) {
    try {
      const problemInfo = this.deps.getProblemInfo();
      const language = await this.getLanguage();
      console.log(`Generating solution for language: ${language}`);
      const config = configHelper.loadConfig();
      const mainWindow = this.deps.getMainWindow();

      if (!problemInfo) {
        throw new Error("No problem info available");
      }

      // Update progress status
      if (mainWindow) {
        mainWindow.webContents.send("processing-status", {
          message: "Creating optimal solution with detailed explanations...",
          progress: 60
        });
      }

      // Create prompt for MCQ solution generation - simplified for accuracy
      const promptText = `Analyze this computer science MCQ question and provide ONLY the correct answer with a brief 2-line explanation. Be extremely accurate and precise.

QUESTION:
${problemInfo.question || problemInfo.problem_statement}

OPTIONS:
${problemInfo.options ? problemInfo.options.join('\n') : "Options not provided."}

TOPIC: ${problemInfo.topic || "Computer Science"}

Your response must follow this exact format:
Answer: [Option Letter]
Explanation: [Your 2-line explanation]

Do not include any other text, introductions, or additional explanations.`;

      let responseContent;

      // Prepare prompts based on language and problem type
      let systemPrompt = "";
      let userPrompt = "";
      
      // Determine markdown language
      let markdownLang = language || 'python';
      if (language === 'cpp' || language === 'c++') markdownLang = 'cpp';
      else if (language === 'csharp' || language === 'c#') markdownLang = 'csharp';
      else if (language === 'sqlite3') markdownLang = 'sql';
      else if (language === 'docker') markdownLang = 'dockerfile';
      else if (language === 'golang') markdownLang = 'go';

      // Routing rules:
      //   - language === 'subjective' (or legacy 'mcq') → subjective handler.
      //     The subjective bucket covers BOTH theory/essay questions AND
      //     multiple-choice questions; MCQ is auto-detected from options[].
      //   - any other language → ALWAYS coding handler. Never produce an
      //     MCQ-style answer when the user has chosen a coding language.
      const isSubjectiveContext = language === 'subjective' || language === 'mcq';
      const isCodingContext = !isSubjectiveContext;

      const hasOptions =
        Array.isArray(problemInfo.options) && problemInfo.options.length > 0;
      const isMCQQuestion = hasOptions || problemInfo.type === 'mcq';
      const isTheoryQuestion = !isMCQQuestion && (problemInfo.type === 'subjective' || problemInfo.type === 'essay');

      // Coding language selected but question is MCQ or pure theory → N/A
      if (isCodingContext && (isMCQQuestion || isTheoryQuestion)) {
        return {
          success: true,
          data: {
            code: 'N/A',
            thoughts: ['This question is multiple-choice or theory-based.', 'Switch to "Subjective (Theory / Essay)" mode to get the answer.'],
            steps: [],
            conclusion: '',
            time_complexity: 'N/A',
            space_complexity: 'N/A',
            memoryId: null,
            fromMemory: false
          }
        };
      }

      // ===== TRUE RAG: serve from memory directly if high confidence =====
      // similarity >= 0.95 → return immediately (very likely the exact same question)
      // similarity 0.92-0.95 AND liked = 1 → return immediately (user verified it)
      if (isMemoryEnabled() && isCodingContext) {
        try {
          const memQuery = this.buildMemoryQuery(problemInfo);
          const direct = await findDirectAnswer(memQuery, language, 0.92);
          if (direct) {
            const useDirectly = direct.similarity >= 0.95 || direct.liked === 1;
            if (useDirectly && direct.solutionCode) {
              console.log(`[Memory] Direct RAG hit — similarity=${direct.similarity.toFixed(3)} liked=${direct.liked}`);
              return {
                success: true,
                data: {
                  code: direct.solutionCode,
                  thoughts: direct.thoughts ? direct.thoughts.split('\n').filter(Boolean) : [],
                  steps: direct.alternativeApproaches
                    ? direct.alternativeApproaches.split('\n').filter(Boolean)
                    : [],
                  conclusion: direct.summaryText || '',
                  time_complexity: direct.timeComplexity || 'N/A',
                  space_complexity: direct.spaceComplexity || 'N/A',
                  memoryId: direct.id,
                  fromMemory: true
                }
              };
            }
          }
        } catch (e: any) {
          console.warn('[Memory] direct RAG skipped:', e?.message || e);
        }
      }
      // ===== END TRUE RAG =====

      if (isSubjectiveContext && isMCQQuestion) {
        // Subjective + MCQ-shaped question → direct answer + short explanation.
        systemPrompt = `You are an expert educator. Identify the single correct option and explain it in one short sentence.`;
        userPrompt = `Answer this multiple-choice question.

QUESTION:
${problemInfo.question || problemInfo.problem_statement}

OPTIONS:
${Array.isArray(problemInfo.options) && problemInfo.options.length > 0 ? problemInfo.options.join('\n') : "Options not provided."}

TOPIC: ${problemInfo.topic || "Computer Science"}

Output format — follow EXACTLY (no other text):

Answer: [Option letter] — [full text of the correct option]
Explanation: [One sentence, under 60 characters, stating why it is correct]

Time complexity: N/A
Space complexity: N/A
`;
      } else if (isSubjectiveContext) {
        // Subjective + theory/essay question → paragraph + steps + conclusion.
        systemPrompt = `You are a senior CS educator. Answer theory questions clearly and simply. NEVER write code unless explicitly asked.`;
        userPrompt = `Answer the following question.

QUESTION:
${problemInfo.question || problemInfo.problem_statement}

TOPIC: ${problemInfo.topic || "Computer Science"}

Output format — follow EXACTLY:

Paragraph:
[2-4 sentences introducing the concept and the key idea. Plain prose, no bullets.]

Steps:
1. [First key point — one sentence.]
2. [Second key point — one sentence.]
3. [Continue as needed, max 6 steps.]

Conclusion:
[One simple sentence summarising what the reader should remember.]

Time complexity: N/A
Space complexity: N/A
`;
      } else {
        // Coding context — language-specific code-writing branches.
        // No MCQ branch here, by design: in coding mode we ALWAYS produce code.
        if (language === 'sqlite3') {
             systemPrompt = `You are an expert SQLite database engineer. Write efficient, valid SQLite 3 queries.
IMPORTANT:
1. Use ONLY valid SQLite syntax (no T-SQL/PLSQL).
2. INFER schema intelligently if not provided.
3. Handle edge cases (NULLs, duplicates).
4. Ensure accuracy above all else.`;
             userPrompt = `Write a robust, accurate SQLite 3 query.

${this.formatProblemSection(problemInfo, "Database")}

Schema Assumptions: infer from the problem if not given.

${this.solutionFormatTemplate('sql')}
`;
        } else if (language === 'sql') {
             systemPrompt = `You are an expert database engineer. Write efficient, standard ANSI SQL queries.
IMPORTANT:
1. ANSI SQL compliant (works on Postgres/MySQL).
2. INFER schema intelligently if not provided.
3. Handle edge cases (NULLs, duplicates).
4. Ensure accuracy above all else.`;
             userPrompt = `Write a Standard SQL query.

${this.formatProblemSection(problemInfo, "Database")}

Schema Assumptions: infer from the problem if not given.

${this.solutionFormatTemplate('sql')}
`;
        } else if (language === 'javascript' || language === 'js' || language === 'node') {
             systemPrompt = `You are an expert JavaScript developer. Write clean, modern, efficient ES6+ code.
IMPORTANT:
1. Use modern syntax (const/let, arrow functions).
2. Handle async/await correctly if needed.
3. Focus on performance and readability.`;
             userPrompt = `Solve using JavaScript.

${this.formatProblemSection(problemInfo, "Web Development")}

${this.solutionFormatTemplate('javascript')}
`;
        } else if (language === 'ruby') {
             systemPrompt = `You are an expert Rubyist. Write idiomatic, efficient Ruby code.
IMPORTANT:
1. Use idiomatic Ruby (Enumerables, blocks).
2. Follow Ruby style guide.
3. Focus on readability and "The Ruby Way".`;
             userPrompt = `Solve using Ruby.

${this.formatProblemSection(problemInfo, "Scripting")}

${this.solutionFormatTemplate('ruby')}
`;
        } else if (language === 'python' || language === 'python3') {
             systemPrompt = `You are an expert Python developer. Write Pythonic, efficient code.
IMPORTANT:
1. Use Pythonic idioms (list comprehensions, generators).
2. Use standard library effectively.
3. Focus on clean, readable code.`;
             userPrompt = `Solve using Python 3.

${this.formatProblemSection(problemInfo)}

${this.solutionFormatTemplate('python')}
`;
        } else if (language === 'docker') {
             systemPrompt = `You are an expert DevOps engineer. Write efficient Dockerfiles/Compose files.`;
             userPrompt = `Solve using Docker.

${this.formatProblemSection(problemInfo, "DevOps")}

${this.solutionFormatTemplate(markdownLang)}
`;
        } else {
             systemPrompt = `You are an expert competitive programmer. Solve problems efficiently in ${language || 'Python'}.`;
             userPrompt = `Solve using ${language || 'Python'}.

${this.formatProblemSection(problemInfo)}

${this.solutionFormatTemplate(markdownLang)}
`;
        }
      }

      // ===== QUALITY PREAMBLE — applies to every coding solution =====
      // Forces: universal solutions, constraint-aware complexity, edge cases,
      // production-quality code. Independent of language. Skipped for the
      // subjective bucket (theory + MCQ) — different output format.
      if (isCodingContext) {
        const qualityPreamble =
`SOLUTION QUALITY REQUIREMENTS (apply to EVERY answer):

1. UNIVERSAL — your code must correctly handle EVERY input that satisfies the
   problem's constraints, not just the example test cases. Do NOT pattern-match
   the examples or hard-code their values.

2. CONSTRAINT-AWARE — read the CONSTRAINTS section above carefully. Choose an
   algorithm whose worst-case complexity fits the largest stated n:
     n ≤ 20         → exponential / backtracking is OK
     n ≤ 5,000      → O(n²) acceptable
     n ≤ 200,000    → require O(n log n) or better
     n ≤ 10,000,000 → require O(n) or O(log n)
   If constraints are not stated, assume LeetCode-typical limits.

3. VERIFY WITH PROVIDED EXAMPLES — if the EXAMPLES section above lists any
   input/output pairs, mentally trace your code through EACH example before
   answering. Confirm your code produces the listed output exactly. If even
   one example fails, the code is wrong — fix it before responding. Do NOT
   guess; do NOT skip the trace.

4. EDGE CASES — explicitly handle: empty input, single element, all duplicates,
   sorted/reverse-sorted, negative numbers, numeric overflow, the maximum
   allowed size. State which cases your code handles in the Approach section.

5. PRODUCTION-QUALITY CODE — descriptive variable names (no x/y/tmp/foo),
   no debug prints, no commented-out lines, no magic numbers, idiomatic for
   the language. The code MUST compile and run unmodified.

6. JUSTIFY COMPLEXITY — state achieved time AND space complexity, AND tie
   them to the constraints. Example: "O(n log n) — n can be 2·10⁵ so O(n²)
   would TLE."

7. RETRIEVED MEMORY = REFERENCE ONLY. If a "RETRIEVED SIMILAR PROBLEMS"
   section appears below, treat it as a hint, not the answer:
     - Reuse the validated APPROACH/PATTERN if it genuinely matches the new
       constraints; otherwise ignore it.
     - Never copy code blindly — past code may target different constraints,
       different edge cases, or contain bugs noted under "Past bugs to avoid".
     - The new problem's CONSTRAINTS and EXAMPLES override anything in memory.

8. HUMANIZED CODE — write code a senior engineer would be proud of:
   - Descriptive names: use \`left/right\` for two-pointer, \`slow/fast\` for Floyd's cycle,
     \`freq_map\` for frequency counts, \`result\` (not \`res\`), \`complement\` (not \`comp\`).
     Only use single-letter names for genuinely conventional loop indices (i, j, k in
     nested loops; r/c for row/column in matrices).
   - ZERO placeholder comments inside the code: absolutely no "# your code here",
     "// TODO", "# Step N:", "// insert logic", "# fill this in". Every line of code
     must be real, working code.
   - ZERO inline explanations inside the code: do not comment every line to explain
     what it does — the Steps section above the code already does this. Only add a
     comment when the WHY is non-obvious (a subtle invariant, a non-standard trick).
   - No \`pass\`, \`...\`, \`raise NotImplementedError\`, or stub bodies. Fully implement
     everything.
   - The code must compile and run unmodified, first try, on a standard interpreter
     with no extra setup.

Now solve the new problem with these requirements:

`;
        userPrompt = qualityPreamble + userPrompt;
      }
      // ===== END QUALITY PREAMBLE =====

      // ===== MEMORY: retrieve similar past problems and prepend to userPrompt =====
      let retrievedMemories: RetrievedMemory[] = [];
      if (isMemoryEnabled()) {
        try {
          // Enriched query: question + constraints. Embedding cosine similarity
          // then matches on algorithmic shape (size limits, edge-case rules),
          // not just topic keywords. Symmetric with what we store below.
          const memQuery = this.buildMemoryQuery(problemInfo);
          retrievedMemories = await retrieveSimilar(memQuery, language, 3);
          if (retrievedMemories.length > 0) {
            const memCtx = formatMemoryContext(retrievedMemories);
            userPrompt = `${memCtx}\n\nNEW PROBLEM:\n${userPrompt}`;
            console.log(
              `[Memory] injected ${retrievedMemories.length} similar memor${
                retrievedMemories.length === 1 ? "y" : "ies"
              } into prompt`
            );
          } else {
            console.log("[Memory] no similar memories above threshold");
          }
        } catch (e: any) {
          console.warn("[Memory] retrieval skipped:", e?.message || e);
        }
      }
      // ===== END MEMORY RETRIEVE =====

      if (this.isOpenAIWireFormat()) {
        // OpenAI / xAI processing (shared wire format + shared client).
        if (!this.openaiClient) {
          return {
            success: false,
            error: "OpenAI API key not configured. Please check your settings."
          };
        }
        
        // Send to OpenAI API
        const solutionResponse = await this.openaiClient.chat.completions.create({
          model: config.solutionModel || "gpt-4o",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt }
          ],
          max_tokens: 4000,
          temperature: 0.2
        }, { signal });

        responseContent = solutionResponse.choices[0].message.content;
      } else if (config.apiProvider === "gemini")  {
        // Gemini processing
        if (!this.geminiApiKey) {
          return {
            success: false,
            error: "Gemini API key not configured. Please check your settings."
          };
        }
        
        try {
          // Create Gemini message structure
          const geminiMessages = [
            {
              role: "user",
              parts: [
                {
                  text: `${systemPrompt}\n\n${userPrompt}`
                }
              ]
            }
          ];

          // Make API request to Gemini
          const response = await axios.default.post(
            `https://generativelanguage.googleapis.com/v1beta/models/${config.solutionModel || "gemini-2.0-flash"}:generateContent?key=${this.geminiApiKey}`,
            {
              contents: geminiMessages,
              generationConfig: {
                temperature: 0.2,
                maxOutputTokens: 4000
              }
            },
            { signal }
          );

          const responseData = response.data as GeminiResponse;
          
          if (!responseData.candidates || responseData.candidates.length === 0) {
            throw new Error("Empty response from Gemini API");
          }
          
          responseContent = responseData.candidates[0].content.parts[0].text;
        } catch (error) {
          console.error("Error using Gemini API for solution:", error);
          return {
            success: false,
            error: "Failed to generate solution with Gemini API. Please check your API key or try again later."
          };
        }
      } else if (config.apiProvider === "anthropic") {
        // Anthropic processing
        if (!this.anthropicClient) {
          return {
            success: false,
            error: "Anthropic API key not configured. Please check your settings."
          };
        }
        
        try {
          const messages = [
            {
              role: "user" as const,
              content: [
                {
                  type: "text" as const,
                  text: `${systemPrompt}\n\n${userPrompt}`
                }
              ]
            }
          ];

          // Send to Anthropic API
          const response = await this.anthropicClient.messages.create({
            model: config.solutionModel || "claude-3-7-sonnet-20250219",
            max_tokens: 4000,
            messages: messages,
            temperature: 0.2
          }, { signal });

          responseContent = (response.content[0] as { type: 'text', text: string }).text;
        } catch (error: any) {
          console.error("Error using Anthropic API for solution:", error);

          // Add specific handling for Claude's limitations
          if (error.status === 429) {
            return {
              success: false,
              error: "Claude API rate limit exceeded. Please wait a few minutes before trying again."
            };
          } else if (error.status === 413 || (error.message && error.message.includes("token"))) {
            return {
              success: false,
              error: "Your screenshots contain too much information for Claude to process. Switch to OpenAI or Gemini in settings which can handle larger inputs."
            };
          }

          return {
            success: false,
            error: "Failed to generate solution with Anthropic API. Please check your API key or try again later."
          };
        }
      } else if (config.apiProvider === "groq") {
        if (!this.groqApiKey) {
          return {
            success: false,
            error: "Groq API key not configured. Please check your settings."
          };
        }

        try {
          const messages = [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt }
          ];

          const response = await this.axiosPostWithRetry(
            "https://api.groq.com/openai/v1/chat/completions",
            {
              model: config.solutionModel || "llama-3.3-70b-versatile",
              messages: messages,
              temperature: 0.2,
              max_completion_tokens: 4000,
              stream: false
            },
            {
              headers: {
                "Authorization": `Bearer ${this.groqApiKey}`,
                "Content-Type": "application/json"
              },
              signal
            }
          );

          responseContent = response.data.choices[0].message.content;
        } catch (error: any) {
          console.error("Error using Groq API for solution:", error);
          return {
            success: false,
            error: error.response?.data?.error?.message || "Failed to generate solution with Groq API. Please check your API key or try again later."
          };
        }
      } else if (config.apiProvider === "bigo-free") {
        // ── bigo-free: solution via backend Groq proxy (text) ────────────────
        try {
          const cfg = configHelper.loadConfig();
          const result = await bigoApi.solveWithAI({
            licenseKey: cfg.licenseKey ?? null,
            deviceId: authHelper.getDeviceId(),
            systemPrompt,
            userPrompt,
            // No screenshots for solution step — problem already extracted
          });
          responseContent = result.content;
        } catch (error: any) {
          console.error("[bigo-free] solution error:", error);
          return {
            success: false,
            error: error.message?.includes("Rate limit")
              ? "Free tier rate limit reached. Try again in a moment."
              : "Failed to generate solution via BigO free tier. Check your connection."
          };
        }
      }

      // ---- Parse structured response -----------------------------------------

      let code: string;
      let thoughts: string[];
      let steps: string[];
      let conclusion = '';

      if (isSubjectiveContext) {
        if (isMCQQuestion) {
          // MCQ: whole response rendered as prose
          code = responseContent.trim();
          thoughts = [];
          steps = [];
        } else {
          // Theory: extract Paragraph:, Steps:, Conclusion:
          const paragraphMatch = responseContent.match(
            /Paragraph:([\s\S]*?)(?=\n\s*(?:Steps:|Conclusion:|Time complexity:|Space complexity:)|$)/i
          );
          code = paragraphMatch ? paragraphMatch[1].trim() : responseContent.trim();

          const stepsBlockMatch = responseContent.match(
            /Steps:([\s\S]*?)(?=\n\s*(?:Conclusion:|Time complexity:|Space complexity:)|$)/i
          );
          const stepsRaw = stepsBlockMatch ? stepsBlockMatch[1] : '';
          steps = (stepsRaw.match(/(?:^|\n)\s*\d+\.\s*([^\n]+)/g) ?? [])
            .map((l: string) => l.replace(/^\s*\d+\.\s*/, '').trim())
            .filter(Boolean);

          const conclusionMatch = responseContent.match(
            /Conclusion:([\s\S]*?)(?=\n\s*(?:Time complexity:|Space complexity:)|$)/i
          );
          conclusion = conclusionMatch ? conclusionMatch[1].trim() : '';

          thoughts = [];
        }
      } else {
        // Coding context: Approach: → Code:```...``` → Steps: → Time/Space

        // 1. Approach section — everything between "Approach:" and the first code fence
        const approachBlock = (() => {
          const m = responseContent.match(/Approach:([\s\S]*?)(?:```|Code:)/i);
          return m ? m[1].trim() : '';
        })();

        thoughts = approachBlock
          .split('\n')
          .map((l: string) => l.replace(/^[•\-*]\s*/, '').trim())
          .filter(Boolean);

        // 2. Code block — first fenced block in the response
        const codeMatch = responseContent.match(/```(?:\w+)?\s*([\s\S]*?)```/);
        code = codeMatch ? codeMatch[1].trim() : responseContent.trim();

        // 3. Alternative Approaches — numbered items between "Alternative Approaches:" and "Summary:" or complexity
        const altBlockMatch = responseContent.match(
          /Alternative Approaches:([\s\S]*?)(?=\n\s*(?:Summary:|Steps:|Time complexity:|Space complexity:)|$)/i
        );
        const altRaw = altBlockMatch ? altBlockMatch[1] : '';
        steps = (altRaw.match(/(?:^|\n)\s*\d+\.\s*([^\n]+)/g) ?? [])
          .map((l: string) => l.replace(/^\s*\d+\.\s*/, '').trim())
          .filter(Boolean);

        // 4. Summary — one sentence after "Summary:"
        const summaryMatch = responseContent.match(
          /Summary:([\s\S]*?)(?=\n\s*(?:Time complexity:|Space complexity:)|$)/i
        );
        conclusion = summaryMatch ? summaryMatch[1].trim() : '';
      }

      // 4. Complexity — extract with neutral fallbacks
      const timeComplexityPattern = /Time complexity:?\s*([^\n]+(?:\n[^\n]+)*?)(?=\n\s*(?:Space complexity|$))/i;
      const spaceComplexityPattern = /Space complexity:?\s*([^\n]+(?:\n[^\n]+)*?)(?=\n\s*(?:[A-Z]|$))/i;

      let timeComplexity = "Not specified by the model.";
      let spaceComplexity = "Not specified by the model.";

      const timeMatch = responseContent.match(timeComplexityPattern);
      if (timeMatch?.[1]) {
        timeComplexity = timeMatch[1].trim();
        if (timeComplexity.match(/O\([^)]+\)/i) && !timeComplexity.includes('-') && !timeComplexity.includes('because')) {
          const n = timeComplexity.match(/O\([^)]+\)/i)![0];
          const rest = timeComplexity.replace(n, '').trim();
          if (rest) timeComplexity = `${n} - ${rest}`;
        }
      }

      const spaceMatch = responseContent.match(spaceComplexityPattern);
      if (spaceMatch?.[1]) {
        spaceComplexity = spaceMatch[1].trim();
        if (spaceComplexity.match(/O\([^)]+\)/i) && !spaceComplexity.includes('-') && !spaceComplexity.includes('because')) {
          const n = spaceComplexity.match(/O\([^)]+\)/i)![0];
          const rest = spaceComplexity.replace(n, '').trim();
          if (rest) spaceComplexity = `${n} - ${rest}`;
        }
      }

      const formattedResponse = {
        code,
        thoughts,
        steps,
        conclusion,
        time_complexity: timeComplexity,
        space_complexity: spaceComplexity,
        memoryId: null as number | null,
        fromMemory: false
      };

      // ===== MEMORY: persist this problem + solution for future retrieval =====
      if (isMemoryEnabled() && isCodingContext) {
        const patternHint = detectPattern(
          `${formattedResponse.thoughts.join(" ")} ${formattedResponse.code}`
        );
        const enrichedQuestion =
          this.buildMemoryQuery(problemInfo) ||
          problemInfo.question ||
          problemInfo.problem_statement ||
          "";
        // Await so we can return the memory ID to the renderer for like/dislike.
        formattedResponse.memoryId = await storeMemory({
          question: enrichedQuestion,
          topic: problemInfo.topic ?? null,
          pattern: patternHint,
          language,
          solutionCode: formattedResponse.code,
          thoughts: formattedResponse.thoughts.join("\n"),
          timeComplexity: formattedResponse.time_complexity,
          spaceComplexity: formattedResponse.space_complexity,
          alternativeApproaches: formattedResponse.steps.join("\n"),
          summaryText: formattedResponse.conclusion
        }).catch((e) => {
          console.warn("[Memory] store skipped:", e?.message || e);
          return null;
        });
      }
      // ===== END MEMORY STORE =====

      return { success: true, data: formattedResponse };
    } catch (error: any) {
      if (axios.isCancel(error)) {
        return {
          success: false,
          error: "Processing was canceled by the user."
        };
      }
      
      if (error?.response?.status === 401) {
        return {
          success: false,
          error: `Invalid ${this.providerLabel()} API key. Please check your settings.`
        };
      } else if (error?.response?.status === 429) {
        return {
          success: false,
          error: `${this.providerLabel()} API rate limit exceeded or insufficient credits. Please try again later.`
        };
      }

      console.error("Solution generation error:", error);
      return { success: false, error: error.message || "Failed to generate solution" };
    }
  }

  private async processExtraScreenshotsHelper(
    screenshots: Array<{ path: string; data: string }>,
    signal: AbortSignal
  ) {
    try {
      const problemInfo = this.deps.getProblemInfo();
      const language = await this.getLanguage();
      console.log(`Processing extra screenshots for language: ${language}`);
      const config = configHelper.loadConfig();
      const mainWindow = this.deps.getMainWindow();

      let languageSpecificInstructions = "";
      if (language === 'sqlite3') {
        languageSpecificInstructions = `
IMPORTANT SQLITE 3 INSTRUCTIONS:
1. Use ONLY valid SQLite syntax. Avoid features not supported by SQLite (e.g., RIGHT JOIN, FULL OUTER JOIN, stored procedures).
2. If the table schema is not explicitly provided, INFER the most logical schema based on the problem description and define it in comments.
3. Handle edge cases (e.g., NULL values, empty tables).
4. Use Common Table Expressions (CTEs) for readability where appropriate.
`;
      } else if (language === 'sql') {
        languageSpecificInstructions = `
IMPORTANT SQL INSTRUCTIONS:
1. Write ANSI SQL compliant code.
2. If the table schema is not explicitly provided, INFER the most logical schema based on the problem description and define it in comments.
3. Handle edge cases (e.g., NULL values, duplicate rows).
4. Use window functions or CTEs if they simplify the logic and are standard.
`;
      }

      if (!problemInfo) {
        throw new Error("No problem info available");
      }

      // Update progress status
      if (mainWindow) {
        mainWindow.webContents.send("processing-status", {
          message: "Processing debug screenshots...",
          progress: 30
        });
      }

      // Prepare the images for the API call
      const imageDataList = screenshots.map(screenshot => screenshot.data);
      
      let debugContent;

      if (this.isOpenAIWireFormat()) {
        // OpenAI / xAI — shared wire format and shared client.
        if (!this.openaiClient) {
          return {
            success: false,
            error: "OpenAI API key not configured. Please check your settings."
          };
        }
        
        const messages = [
          {
            role: "system" as const, 
            content: `You are a coding interview assistant helping debug and improve solutions. Analyze these screenshots which include either error messages, incorrect outputs, or test cases, and provide detailed debugging help.
${languageSpecificInstructions}
Your response MUST follow this exact structure with these section headers (use ### for headers):
### Issues Identified
- List each issue as a bullet point with clear explanation

### Specific Improvements and Corrections
- List specific code changes needed as bullet points

### Optimizations
- List any performance optimizations if applicable

### Explanation of Changes Needed
Here provide a clear explanation of why the changes are needed

### Key Points
- Summary bullet points of the most important takeaways

If you include code examples, use proper markdown code blocks with language specification (e.g. \`\`\`java).`
          },
          {
            role: "user" as const,
            content: [
              {
                type: "text" as const, 
                text: `I'm solving this coding problem: "${problemInfo.question || problemInfo.problem_statement || "(see screenshots)"}" in ${language}. I need help with debugging or improving my solution. Here are screenshots of my code, the errors or test cases. Please provide a detailed analysis with:
1. What issues you found in my code
2. Specific improvements and corrections
3. Any optimizations that would make the solution better
4. A clear explanation of the changes needed` 
              },
              ...imageDataList.map(data => ({
                type: "image_url" as const,
                image_url: { url: `data:image/png;base64,${data}` }
              }))
            ]
          }
        ];

        if (mainWindow) {
          mainWindow.webContents.send("processing-status", {
            message: "Analyzing code and generating debug feedback...",
            progress: 60
          });
        }

        const debugResponse = await this.openaiClient.chat.completions.create({
          model: config.debuggingModel || "gpt-4o",
          messages: messages,
          max_tokens: 4000,
          temperature: 0.2
        }, { signal });
        
        debugContent = debugResponse.choices[0].message.content;
      } else if (config.apiProvider === "gemini")  {
        if (!this.geminiApiKey) {
          return {
            success: false,
            error: "Gemini API key not configured. Please check your settings."
          };
        }
        
        try {
          const debugPrompt = `
You are a coding interview assistant helping debug and improve solutions. Analyze these screenshots which include either error messages, incorrect outputs, or test cases, and provide detailed debugging help.
${languageSpecificInstructions}
I'm solving this coding problem: "${problemInfo.question || problemInfo.problem_statement || "(see screenshots)"}" in ${language}. I need help with debugging or improving my solution.

YOUR RESPONSE MUST FOLLOW THIS EXACT STRUCTURE WITH THESE SECTION HEADERS:
### Issues Identified
- List each issue as a bullet point with clear explanation

### Specific Improvements and Corrections
- List specific code changes needed as bullet points

### Optimizations
- List any performance optimizations if applicable

### Explanation of Changes Needed
Here provide a clear explanation of why the changes are needed

### Key Points
- Summary bullet points of the most important takeaways

If you include code examples, use proper markdown code blocks with language specification (e.g. \`\`\`java).
`;

          const geminiMessages = [
            {
              role: "user",
              parts: [
                { text: debugPrompt },
                ...imageDataList.map(data => ({
                  inlineData: {
                    mimeType: "image/png",
                    data: data
                  }
                }))
              ]
            }
          ];

          if (mainWindow) {
            mainWindow.webContents.send("processing-status", {
              message: "Analyzing code and generating debug feedback with Gemini...",
              progress: 60
            });
          }

          const response = await axios.default.post(
            `https://generativelanguage.googleapis.com/v1beta/models/${config.debuggingModel || "gemini-2.0-flash"}:generateContent?key=${this.geminiApiKey}`,
            {
              contents: geminiMessages,
              generationConfig: {
                temperature: 0.2,
                maxOutputTokens: 4000
              }
            },
            { signal }
          );

          const responseData = response.data as GeminiResponse;
          
          if (!responseData.candidates || responseData.candidates.length === 0) {
            throw new Error("Empty response from Gemini API");
          }
          
          debugContent = responseData.candidates[0].content.parts[0].text;
        } catch (error) {
          console.error("Error using Gemini API for debugging:", error);
          return {
            success: false,
            error: "Failed to process debug request with Gemini API. Please check your API key or try again later."
          };
        }
      } else if (config.apiProvider === "anthropic") {
        if (!this.anthropicClient) {
          return {
            success: false,
            error: "Anthropic API key not configured. Please check your settings."
          };
        }
        
        try {
          const debugPrompt = `
You are a coding interview assistant helping debug and improve solutions. Analyze these screenshots which include either error messages, incorrect outputs, or test cases, and provide detailed debugging help.
${languageSpecificInstructions}
I'm solving this coding problem: "${problemInfo.question || problemInfo.problem_statement || "(see screenshots)"}" in ${language}. I need help with debugging or improving my solution.

YOUR RESPONSE MUST FOLLOW THIS EXACT STRUCTURE WITH THESE SECTION HEADERS:
### Issues Identified
- List each issue as a bullet point with clear explanation

### Specific Improvements and Corrections
- List specific code changes needed as bullet points

### Optimizations
- List any performance optimizations if applicable

### Explanation of Changes Needed
Here provide a clear explanation of why the changes are needed

### Key Points
- Summary bullet points of the most important takeaways

If you include code examples, use proper markdown code blocks with language specification.
`;

          const messages = [
            {
              role: "user" as const,
              content: [
                {
                  type: "text" as const,
                  text: debugPrompt
                },
                ...imageDataList.map(data => ({
                  type: "image" as const,
                  source: {
                    type: "base64" as const,
                    media_type: "image/png" as const, 
                    data: data
                  }
                }))
              ]
            }
          ];

          if (mainWindow) {
            mainWindow.webContents.send("processing-status", {
              message: "Analyzing code and generating debug feedback with Claude...",
              progress: 60
            });
          }

          const response = await this.anthropicClient.messages.create({
            model: config.debuggingModel || "claude-3-7-sonnet-20250219",
            max_tokens: 4000,
            messages: messages,
            temperature: 0.2
          }, { signal });

          debugContent = (response.content[0] as { type: 'text', text: string }).text;
        } catch (error: any) {
          console.error("Error using Anthropic API for debugging:", error);
          
          // Add specific handling for Claude's limitations
          if (error.status === 429) {
            return {
              success: false,
              error: "Claude API rate limit exceeded. Please wait a few minutes before trying again."
            };
          } else if (error.status === 413 || (error.message && error.message.includes("token"))) {
            return {
              success: false,
              error: "Your screenshots contain too much information for Claude to process. Switch to OpenAI or Gemini in settings which can handle larger inputs."
            };
          }
          
          return {
            success: false,
            error: "Failed to process debug request with Anthropic API. Please check your API key or try again later."
          };
        }
      } else if (config.apiProvider === "groq") {
        if (!this.groqApiKey) {
          return {
            success: false,
            error: "Groq API key not configured. Please check your settings."
          };
        }

        try {
          const debugPrompt = `
You are a coding interview assistant helping debug and improve solutions. Analyze these screenshots which include either error messages, incorrect outputs, or test cases, and provide detailed debugging help.
${languageSpecificInstructions}
I'm solving this coding problem: "${problemInfo.question || problemInfo.problem_statement || "(see screenshots)"}" in ${language}. I need help with debugging or improving my solution.

YOUR RESPONSE MUST FOLLOW THIS EXACT STRUCTURE WITH THESE SECTION HEADERS:
### Issues Identified
- List each issue as a bullet point with clear explanation

### Specific Improvements and Corrections
- List specific code changes needed as bullet points

### Optimizations
- List any performance optimizations if applicable

### Explanation of Changes Needed
Here provide a clear explanation of why the changes are needed

### Key Points
- Summary bullet points of the most important takeaways

If you include code examples, use proper markdown code blocks with language specification.
`;

          const messages = [
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: debugPrompt
                },
                ...imageDataList.map(data => ({
                  type: "image_url",
                  image_url: {
                    url: `data:image/png;base64,${data}`
                  }
                }))
              ]
            }
          ];

          if (mainWindow) {
            mainWindow.webContents.send("processing-status", {
              message: "Analyzing code and generating debug feedback with Groq...",
              progress: 60
            });
          }

          const response = await this.axiosPostWithRetry(
            "https://api.groq.com/openai/v1/chat/completions",
            {
              model: config.debuggingModel || "meta-llama/llama-4-scout-17b-16e-instruct",
              messages: messages,
              temperature: 0.2,
              max_completion_tokens: 4000,
              stream: false
            },
            {
              headers: {
                "Authorization": `Bearer ${this.groqApiKey}`,
                "Content-Type": "application/json"
              },
              signal
            }
          );

          debugContent = response.data.choices[0].message.content;
        } catch (error: any) {
          console.error("Error using Groq API for debugging:", error);
          return {
            success: false,
            error: error.response?.data?.error?.message || "Failed to process debug request with Groq API. Please check your API key or try again later."
          };
        }
      } else if (config.apiProvider === "bigo-free") {
        // ── bigo-free: debug via backend Groq proxy (vision) ─────────────────
        try {
          const debugSystemPrompt = `You are a coding interview assistant. Analyze the provided screenshots which show error messages, incorrect outputs, or test cases. Provide structured debugging help.`;
          const debugUserPrompt = `
I'm solving: "${problemInfo.question || problemInfo.problem_statement || "(see screenshots)"}" in ${language}.
Analyze these ${imageDataList.length} screenshot(s) showing my error or failed test cases and provide:

### Issues Identified
- List each issue clearly

### Specific Improvements and Corrections
- List specific code changes needed

### Optimizations
- Performance improvements if applicable

### Explanation of Changes Needed
Clear explanation of why changes are needed

### Key Points
- Summary of the most important takeaways

Use proper markdown code blocks with language specification for any code examples.`;

          if (mainWindow) {
            mainWindow.webContents.send("processing-status", {
              message: "Analyzing code and generating debug feedback...",
              progress: 60
            });
          }

          const cfg = configHelper.loadConfig();
          const result = await bigoApi.solveWithAI({
            licenseKey: cfg.licenseKey ?? null,
            deviceId: authHelper.getDeviceId(),
            systemPrompt: debugSystemPrompt,
            userPrompt: debugUserPrompt,
            screenshots: imageDataList,
            mimeType: "image/png",
          });
          debugContent = result.content;
        } catch (error: any) {
          console.error("[bigo-free] debug error:", error);
          return {
            success: false,
            error: error.message?.includes("Rate limit")
              ? "Free tier rate limit reached. Try again in a moment."
              : "Failed to process debug request via BigO free tier. Check your connection."
          };
        }
      }


      if (mainWindow) {
        mainWindow.webContents.send("processing-status", {
          message: "Debug analysis complete",
          progress: 100
        });
      }

      let extractedCode = "// Debug mode - see analysis below";
      const codeMatch = debugContent.match(/```(?:[a-zA-Z]+)?([\s\S]*?)```/);
      if (codeMatch && codeMatch[1]) {
        extractedCode = codeMatch[1].trim();
      }

      let formattedDebugContent = debugContent;
      
      if (!debugContent.includes('# ') && !debugContent.includes('## ')) {
        formattedDebugContent = debugContent
          .replace(/issues identified|problems found|bugs found/i, '## Issues Identified')
          .replace(/code improvements|improvements|suggested changes/i, '## Code Improvements')
          .replace(/optimizations|performance improvements/i, '## Optimizations')
          .replace(/explanation|detailed analysis/i, '## Explanation');
      }

      const bulletPoints = formattedDebugContent.match(/(?:^|\n)[ ]*(?:[-*•]|\d+\.)[ ]+([^\n]+)/g);
      const thoughts = bulletPoints 
        ? bulletPoints.map(point => point.replace(/^[ ]*(?:[-*•]|\d+\.)[ ]+/, '').trim()).slice(0, 5)
        : ["Debug analysis based on your screenshots"];
      
      const response = {
        code: extractedCode,
        debug_analysis: formattedDebugContent,
        thoughts: thoughts,
        time_complexity: "N/A - Debug mode",
        space_complexity: "N/A - Debug mode"
      };

      return { success: true, data: response };
    } catch (error: any) {
      console.error("Debug processing error:", error);
      return { success: false, error: error.message || "Failed to process debug request" };
    }
  }

  public cancelOngoingRequests(): void {
    let wasCancelled = false

    if (this.currentProcessingAbortController) {
      this.currentProcessingAbortController.abort()
      this.currentProcessingAbortController = null
      wasCancelled = true
    }

    if (this.currentExtraProcessingAbortController) {
      this.currentExtraProcessingAbortController.abort()
      this.currentExtraProcessingAbortController = null
      wasCancelled = true
    }

    this.deps.setHasDebugged(false)

    this.deps.setProblemInfo(null)

    const mainWindow = this.deps.getMainWindow()
    if (wasCancelled && mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send(this.deps.PROCESSING_EVENTS.NO_SCREENSHOTS)
    }
  }
}
