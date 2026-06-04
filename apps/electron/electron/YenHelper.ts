// YenHelper.ts
// In-memory "Yen" buckets: capture screenshots, send to LLM, store the
// resulting Topics / Answers / Key Points block in one of 5 buckets.
// No persistence — buckets live only for this app session.

import fs from "node:fs"
import { BrowserWindow } from "electron"
import * as axios from "axios"
import { OpenAI } from "openai"
import Anthropic from "@anthropic-ai/sdk"
import { configHelper } from "./ConfigHelper"

export const YEN_BUCKET_COUNT = 5

export interface YenBucket {
  id: number
  content: string
  createdAt: number
  screenshotCount: number
}

export interface YenState {
  panelOpen: boolean
  capturing: boolean
  activeBucket: number | null
  captureQueue: string[]
  buckets: Array<YenBucket | null>
  processing: boolean
}

const YEN_PROMPT = `You will receive 1 or more screenshots that contain coding/quiz questions, paragraphs, or study material.

============================================================
STEP 1 — OCR PASS (silent, internal)
============================================================
Treat the screenshots like a strict OCR job. Read every visible character:
every line of code, every word of the question, every option of an MCQ,
every constraint, every example, every edge-case note.
Preserve EXACTLY:
  - punctuation, brackets, parentheses, braces
  - operators (==, !=, <=, >=, ->, =>, %, &&, ||, **, etc.)
  - indentation and line breaks (use spaces, not tabs, in your output)
  - variable / function / class names verbatim — do NOT paraphrase
  - constraint bounds (e.g. 1 <= n <= 10^5)
If text is partially cut off, include the visible portion and mark the cut
with [...]. If multiple screenshots are part of the same problem, stitch
them in reading order before answering. Do NOT skip or summarize the
constraints section — copy it verbatim.

============================================================
STEP 2 — CLASSIFY
============================================================
Decide CODING (a programming problem expecting code output) vs
NON-CODING (theory, MCQ, paragraph, study material).

============================================================
STEP 3 — IF CODING: SOLVE FROM CONSTRAINTS, NOT FROM EXAMPLES
============================================================
This is the most important rule. Examples in the question only show the
INPUT and OUTPUT FORMAT — they are NOT a guide to your algorithm.

  - Derive the algorithm from the QUESTION TEXT and the CONSTRAINTS.
  - Use the constraints to pick the right complexity (e.g. n <= 10^5 → no
    O(n^2); n <= 20 → bitmask is fine; values up to 10^18 → use 64-bit).
  - Mentally check your solution against the worst-case constraint values
    (max n, max value, min n=1, empty input, all duplicates, negatives,
    single element, sorted vs unsorted, integer overflow) BEFORE writing
    code. If any of those break your approach, fix it first.
  - The example I/O must validate, but DO NOT hardcode anything that
    happens to match an example. The solution must be UNIVERSAL — pass
    every valid test case the constraints permit, not just the shown ones.
  - If the question gives a function signature, use it exactly. If not,
    pick standard idiomatic naming.

============================================================
STEP 4 — RESPOND USING EXACTLY ONE TEMPLATE BELOW
============================================================
No preamble. No markdown fences around the whole output. No commentary
outside the block.

------------------------------------------------------------
TEMPLATE A — CODING
------------------------------------------------------------
# Topic
<one short line: the algorithm / data structure / language area>

## Question
<full coding question verbatim — problem statement, signature, constraints,
examples. Copy the constraints exactly as shown.>

## Answer
\`\`\`<language>
<complete, runnable, idiomatic solution that satisfies the constraints for
ALL valid inputs. Include necessary imports. No TODOs, no placeholders,
no print/debug statements unless the question asks for them. Use clear
variable names. Handle the edge cases noted in step 3.>
\`\`\`

## Approaches
- **Used**: <one short line — name the chosen approach + its time/space Big-O>
- **Alt 1**: <one short line — a real alternative + why it's worse here (slower, more memory, harder to write)>
- **Alt 2**: <one short line — another alternative + tradeoff>  (omit this bullet if there is no second meaningfully different approach)
- **Alt 3**: <one short line — another alternative + tradeoff>  (omit this bullet if not applicable)

## Explanation
<3–6 short sentences: approach, why it works, time + space complexity in
big-O. Briefly justify why the chosen complexity fits the constraints.>

## Key Points
- <edge case the solution handles correctly>
- <complexity reminder tied to the constraint bound>
- <pattern / variant to recognize next time>

------------------------------------------------------------
TEMPLATE B — NON-CODING
------------------------------------------------------------
# Topic
<one short line naming the subject>

## Question(s)
<the full question(s) verbatim, numbered if multiple>

## Answer(s)
<concise direct answers in plain text. For MCQs, name the chosen option
and give a one-sentence reason.>

## Key Points
- <takeaway 1>
- <takeaway 2>
- <takeaway 3 — short, exam-ready>

Pick exactly one template based on content. Do not mix the two.`

export class YenHelper {
  private state: YenState = {
    panelOpen: false,
    capturing: false,
    activeBucket: null,
    captureQueue: [],
    buckets: Array(YEN_BUCKET_COUNT).fill(null),
    processing: false
  }

  private getMainWindow: () => BrowserWindow | null

  constructor(getMainWindow: () => BrowserWindow | null) {
    this.getMainWindow = getMainWindow
  }

  // --- state queries ----------------------------------------------------

  public getState(): YenState {
    return {
      panelOpen: this.state.panelOpen,
      capturing: this.state.capturing,
      activeBucket: this.state.activeBucket,
      captureQueue: [...this.state.captureQueue],
      buckets: this.state.buckets.map(b => (b ? { ...b } : null)),
      processing: this.state.processing
    }
  }

  public isCapturing(): boolean {
    return this.state.capturing
  }

  public isPanelOpen(): boolean {
    return this.state.panelOpen
  }

  // --- panel + capture mode --------------------------------------------

  public togglePanel(): void {
    this.state.panelOpen = !this.state.panelOpen
    // Opening the panel auto-enters capture mode so Cmd+H / Cmd+Enter
    // are routed to Yen until the panel closes.
    this.state.capturing = this.state.panelOpen
    if (!this.state.panelOpen) {
      this.state.captureQueue = []
      this.state.activeBucket = null
    }
    this.broadcast()
  }

  public openBucket(bucketIndex: number): void {
    if (bucketIndex < 1 || bucketIndex > YEN_BUCKET_COUNT) return
    this.state.panelOpen = true
    this.state.capturing = true
    this.state.activeBucket = bucketIndex
    this.broadcast()
  }

  public closePanel(): void {
    this.state.panelOpen = false
    this.state.capturing = false
    this.state.captureQueue = []
    this.state.activeBucket = null
    this.broadcast()
  }

  // --- capture queue ----------------------------------------------------

  public addCapture(screenshotPath: string): void {
    if (!this.state.capturing) return
    this.state.captureQueue.push(screenshotPath)
    this.broadcast()
  }

  public removeLastCapture(): string | null {
    const last = this.state.captureQueue.pop() || null
    this.broadcast()
    return last
  }

  public clearCaptureQueue(): void {
    this.state.captureQueue = []
    this.broadcast()
  }

  // --- buckets ----------------------------------------------------------

  public deleteBucket(bucketIndex: number): boolean {
    const idx = bucketIndex - 1
    if (idx < 0 || idx >= YEN_BUCKET_COUNT) return false
    this.state.buckets[idx] = null
    this.broadcast()
    return true
  }

  public clearAll(): void {
    this.state.buckets = Array(YEN_BUCKET_COUNT).fill(null)
    this.state.captureQueue = []
    this.state.activeBucket = null
    this.broadcast()
  }

  private firstEmptyBucketIndex(): number {
    for (let i = 0; i < YEN_BUCKET_COUNT; i++) {
      if (!this.state.buckets[i]) return i
    }
    return -1
  }

  // --- processing -------------------------------------------------------

  public async processCaptures(): Promise<{ ok: boolean; error?: string; bucketIndex?: number }> {
    if (this.state.processing) {
      return { ok: false, error: "Already processing — wait a moment." }
    }
    if (!this.state.captureQueue.length) {
      return { ok: false, error: "No screenshots captured. Press Cmd+H first." }
    }

    // Always save into the next empty bucket (1→2→3→4→5).
    // activeBucket is purely a viewing pointer — it does not gate where we
    // save, so consecutive Cmd+Enter saves never overwrite a filled bucket.
    const targetIdx = this.firstEmptyBucketIndex()

    if (targetIdx < 0) {
      return {
        ok: false,
        error: "All 5 buckets are full. Delete one before saving a new Yen."
      }
    }

    const config = configHelper.loadConfig()
    if (!config.apiKey) {
      return { ok: false, error: "No API key configured. Open Settings first." }
    }

    this.state.processing = true
    this.broadcast()

    try {
      const imageDataList = this.state.captureQueue
        .filter(p => fs.existsSync(p))
        .map(p => fs.readFileSync(p).toString("base64"))

      if (!imageDataList.length) {
        return { ok: false, error: "Capture files no longer exist on disk." }
      }

      const content = await this.callLLM(imageDataList, config)
      if (!content || !content.trim()) {
        return { ok: false, error: "LLM returned an empty response. Try again." }
      }

      const bucket: YenBucket = {
        id: targetIdx + 1,
        content: content.trim(),
        createdAt: Date.now(),
        screenshotCount: this.state.captureQueue.length
      }
      this.state.buckets[targetIdx] = bucket
      // Once the summary is stored, the source screenshots are no longer
      // needed — wipe them from disk so the temp dir doesn't grow forever.
      for (const p of this.state.captureQueue) {
        try {
          if (fs.existsSync(p)) fs.unlinkSync(p)
        } catch (e) {
          console.warn("[Yen] failed to delete capture:", p, e)
        }
      }
      this.state.captureQueue = []
      this.state.activeBucket = targetIdx + 1
      return { ok: true, bucketIndex: targetIdx + 1 }
    } catch (err) {
      console.error("[Yen] processing failed:", err)
      const msg = err instanceof Error ? err.message : String(err)
      return {
        ok: false,
        error: msg || "Failed to summarize screenshots."
      }
    } finally {
      this.state.processing = false
      this.broadcast()
    }
  }

  private async callLLM(imageDataList: string[], config: ReturnType<typeof configHelper.loadConfig>): Promise<string> {
    const provider = config.apiProvider

    if (provider === "openai") {
      const openai = new OpenAI({ apiKey: config.apiKey, timeout: 60000, maxRetries: 2 })
      const resp = await openai.chat.completions.create({
        model: config.extractionModel || "gpt-4o",
        messages: [
          { role: "system", content: YEN_PROMPT },
          {
            role: "user",
            content: [
              { type: "text", text: YEN_PROMPT },
              ...imageDataList.map(data => ({
                type: "image_url" as const,
                image_url: { url: `data:image/png;base64,${data}` }
              }))
            ]
          }
        ],
        max_tokens: 2000,
        temperature: 0.2
      })
      return resp.choices[0]?.message?.content || ""
    }

    if (provider === "gemini") {
      const model = config.extractionModel || "gemini-2.0-flash"
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${config.apiKey}`
      const resp = await axios.default.post(url, {
        contents: [
          {
            role: "user",
            parts: [
              { text: YEN_PROMPT },
              ...imageDataList.map(data => ({
                inlineData: { mimeType: "image/png", data }
              }))
            ]
          }
        ],
        generationConfig: { temperature: 0.2, maxOutputTokens: 2000 }
      })
      return resp.data?.candidates?.[0]?.content?.parts?.[0]?.text || ""
    }

    if (provider === "anthropic") {
      const anthropic = new Anthropic({ apiKey: config.apiKey })
      const resp = await anthropic.messages.create({
        model: config.extractionModel || "claude-3-7-sonnet-20250219",
        max_tokens: 2000,
        temperature: 0.2,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: YEN_PROMPT },
              ...imageDataList.map(data => ({
                type: "image" as const,
                source: { type: "base64" as const, media_type: "image/png" as const, data }
              }))
            ]
          }
        ]
      })
      const block = resp.content[0]
      return block && block.type === "text" ? block.text : ""
    }

    if (provider === "xai") {
      const xai = new OpenAI({ apiKey: config.apiKey, baseURL: "https://api.x.ai/v1" })
      const resp = await xai.chat.completions.create({
        model: config.extractionModel || "grok-vision-beta",
        messages: [
          { role: "system", content: YEN_PROMPT },
          {
            role: "user",
            content: [
              { type: "text", text: YEN_PROMPT },
              ...imageDataList.map(data => ({
                type: "image_url" as const,
                image_url: { url: `data:image/png;base64,${data}` }
              }))
            ]
          }
        ],
        max_tokens: 2000,
        temperature: 0.2
      })
      return resp.choices[0]?.message?.content || ""
    }

    if (provider === "groq") {
      const model = config.extractionModel || "meta-llama/llama-4-scout-17b-16e-instruct"
      const resp = await axios.default.post(
        "https://api.groq.com/openai/v1/chat/completions",
        {
          model,
          messages: [
            { role: "system", content: YEN_PROMPT },
            {
              role: "user",
              content: [
                { type: "text", text: YEN_PROMPT },
                ...imageDataList.map(data => ({
                  type: "image_url",
                  image_url: { url: `data:image/png;base64,${data}` }
                }))
              ]
            }
          ],
          temperature: 0.2,
          max_completion_tokens: 2000,
          stream: false
        },
        {
          headers: {
            Authorization: `Bearer ${config.apiKey}`,
            "Content-Type": "application/json"
          }
        }
      )
      return resp.data?.choices?.[0]?.message?.content || ""
    }

    throw new Error(`Unsupported provider: ${provider}`)
  }

  // --- broadcast --------------------------------------------------------

  private broadcast(): void {
    const win = this.getMainWindow()
    if (win && !win.isDestroyed()) {
      // Force the window out of click-through whenever the bucket panel is
      // open. The renderer also tries to manage this, but a missed wheel/
      // mousemove event can leave the window stuck in ignore mode and the
      // user has to Cmd+B to recover. Asserting here from the main process
      // makes it bulletproof.
      try {
        win.setIgnoreMouseEvents(!this.state.panelOpen, { forward: true })
      } catch {
        // ignore — window may be in a transient state
      }
      win.webContents.send("yen-state", this.getState())
    }
  }
}
