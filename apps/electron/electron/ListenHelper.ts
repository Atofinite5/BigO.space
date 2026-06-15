// ListenHelper.ts
// "Listen & Answer" — transcribe a captured audio clip (the interviewer's
// question) and produce a concise bullet-point answer the candidate can read.
// Reuses the same multi-provider config as the rest of BigO.

import { BrowserWindow } from "electron"
import { OpenAI } from "openai"
import Anthropic from "@anthropic-ai/sdk"
import * as axios from "axios"
import { configHelper } from "./ConfigHelper"
import { bigoApi } from "./BigOApiClient"
import { authHelper } from "./AuthHelper"

type Config = ReturnType<typeof configHelper.loadConfig>

export interface ListenExchange {
  q: string
  a: string
  at: number
}

export interface ListenState {
  listening: boolean
  processing: boolean
  transcript: string
  answer: string
  history: ListenExchange[]
}

const ANSWER_PROMPT = `You are assisting a candidate in a LIVE technical interview. You receive a running transcript of what the INTERVIEWER has been saying (it may be noisy, partial, or contain earlier context). Identify the MOST RECENT question or prompt and answer THAT.

Reply with a concise, skimmable answer the candidate can read aloud or paraphrase:
- First line: a one-sentence direct answer.
- Then 3–6 tight bullet points (use "• ") with the real substance — definitions, trade-offs, steps, complexity, a tiny example.
- For coding questions: give the approach + time/space Big-O in bullets (no full code unless it's a one-liner).
- No preamble, no "great question", no markdown headers. Plain text only.

If the transcript is clearly NOT a question (greeting, small talk, silence), reply with exactly: (no question detected)`

export class ListenHelper {
  private state: ListenState = {
    listening: false,
    processing: false,
    transcript: "",
    answer: "",
    history: [],
  }

  // Rolling transcript accumulated across audio chunks (capped).
  private rollingTranscript = ""
  private static readonly TRANSCRIPT_CAP = 2000

  private getMainWindow: () => BrowserWindow | null

  constructor(getMainWindow: () => BrowserWindow | null) {
    this.getMainWindow = getMainWindow
  }

  public getState(): ListenState {
    return { ...this.state, history: [...this.state.history] }
  }

  public isListening(): boolean {
    return this.state.listening
  }

  public setListening(on: boolean): void {
    this.state.listening = on
    if (on) {
      // Fresh session — reset accumulated context.
      this.rollingTranscript = ""
      this.state.transcript = ""
      this.state.answer = ""
    } else {
      this.state.processing = false
    }
    this.broadcast()
  }

  public toggleListening(): boolean {
    this.setListening(!this.state.listening)
    return this.state.listening
  }

  public clear(): void {
    this.rollingTranscript = ""
    this.state.transcript = ""
    this.state.answer = ""
    this.state.history = []
    this.broadcast()
  }

  // ── Core: transcribe a clip → answer ──────────────────────────────────────

  public async processAudio(
    audioBase64: string,
    mimeType: string
  ): Promise<{ ok: boolean; transcript?: string; answer?: string; error?: string }> {
    if (this.state.processing) return { ok: false, error: "Already processing — one moment." }

    const config = configHelper.loadConfig()
    const isFree = config.apiProvider === "bigo-free"
    if (!isFree && !config.apiKey) return { ok: false, error: "No API key configured. Open Settings first." }

    this.state.processing = true
    this.broadcast()

    try {
      // 1. Transcribe this chunk (Groq Whisper).
      const chunkText = (await this.transcribe(audioBase64, mimeType, config)).trim()
      if (!chunkText) {
        return { ok: false, error: "No speech in this chunk." }
      }

      // 2. Append to the rolling transcript (the running conversation), capped.
      this.rollingTranscript = `${this.rollingTranscript} ${chunkText}`.trim()
      if (this.rollingTranscript.length > ListenHelper.TRANSCRIPT_CAP) {
        this.rollingTranscript = this.rollingTranscript.slice(-ListenHelper.TRANSCRIPT_CAP)
      }
      this.state.transcript = this.rollingTranscript
      this.broadcast()

      // 3. Answer the most recent question from the accumulated transcript.
      const answer = (await this.answer(this.rollingTranscript, config)).trim()
      if (/^\(no question detected\)/i.test(answer)) {
        // Keep the transcript visible, no answer change.
        return { ok: false, error: "No question detected.", transcript: this.rollingTranscript }
      }

      this.state.answer = answer
      this.state.history.unshift({ q: chunkText, a: answer, at: Date.now() })
      this.state.history = this.state.history.slice(0, 20)
      return { ok: true, transcript: this.rollingTranscript, answer }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error("[Listen] processAudio failed:", msg)
      return { ok: false, error: msg || "Listen failed." }
    } finally {
      this.state.processing = false
      this.broadcast()
    }
  }

  // ── Transcription ─────────────────────────────────────────────────────────

  private async transcribe(audioBase64: string, mimeType: string, config: Config): Promise<string> {
    const buf = Buffer.from(audioBase64, "base64")
    const provider = config.apiProvider

    if (provider === "bigo-free") {
      // Route through backend Groq Whisper proxy — no user API key needed
      const cfg = configHelper.loadConfig()
      const result = await bigoApi.transcribeAudio({
        licenseKey: cfg.licenseKey ?? null,
        deviceId: authHelper.getDeviceId(),
        audioBase64,
        filename: `audio.${mimeType?.includes("mp4") ? "mp4" : "webm"}`,
        language: "en",
      })
      return result.transcript
    }
    if (provider === "groq") {
      return this.whisper(buf, mimeType, "https://api.groq.com/openai/v1/audio/transcriptions", config.apiKey, "whisper-large-v3")
    }
    if (provider === "gemini") {
      return this.geminiTranscribe(buf, mimeType, config)
    }
    // openai (and any OpenAI-key fallback). xAI has no transcription endpoint;
    // best effort with OpenAI Whisper (works if the key is an OpenAI key).
    return this.whisper(buf, mimeType, "https://api.openai.com/v1/audio/transcriptions", config.apiKey, "whisper-1")
  }

  private async whisper(buf: Buffer, mimeType: string, url: string, apiKey: string, model: string): Promise<string> {
    const form = new FormData()
    form.append("file", new Blob([new Uint8Array(buf)], { type: mimeType || "audio/webm" }), "audio.webm")
    form.append("model", model)
    form.append("response_format", "text")
    const res = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
    })
    if (!res.ok) {
      const t = await res.text()
      throw new Error(`Transcription failed (${res.status}): ${t.slice(0, 200)}`)
    }
    return await res.text()
  }

  private async geminiTranscribe(buf: Buffer, mimeType: string, config: Config): Promise<string> {
    const model = "gemini-2.0-flash"
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${config.apiKey}`
    const resp = await axios.default.post(url, {
      contents: [
        {
          role: "user",
          parts: [
            { text: "Transcribe this audio verbatim. Output only the transcribed words." },
            { inlineData: { mimeType: mimeType || "audio/webm", data: buf.toString("base64") } },
          ],
        },
      ],
      generationConfig: { temperature: 0 },
    })
    return resp.data?.candidates?.[0]?.content?.parts?.[0]?.text || ""
  }

  // ── Answer ────────────────────────────────────────────────────────────────

  private async answer(question: string, config: Config): Promise<string> {
    const provider = config.apiProvider
    const model = config.solutionModel

    if (provider === "openai" || provider === "xai") {
      const openai = new OpenAI({
        apiKey: config.apiKey,
        baseURL: provider === "xai" ? "https://api.x.ai/v1" : undefined,
      })
      const resp = await openai.chat.completions.create({
        model: model || (provider === "xai" ? "grok-beta" : "gpt-4o"),
        messages: [
          { role: "system", content: ANSWER_PROMPT },
          { role: "user", content: `INTERVIEWER:\n${question}` },
        ],
        temperature: 0.3,
        max_tokens: 600,
      })
      return resp.choices[0]?.message?.content || ""
    }

    if (provider === "anthropic") {
      const anthropic = new Anthropic({ apiKey: config.apiKey })
      const resp = await anthropic.messages.create({
        model: model || "claude-3-7-sonnet-20250219",
        max_tokens: 600,
        temperature: 0.3,
        system: ANSWER_PROMPT,
        messages: [{ role: "user", content: `INTERVIEWER:\n${question}` }],
      })
      const block = resp.content[0]
      return block && block.type === "text" ? block.text : ""
    }

    if (provider === "gemini") {
      const m = model || "gemini-2.0-flash"
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${config.apiKey}`
      const resp = await axios.default.post(url, {
        contents: [{ role: "user", parts: [{ text: `${ANSWER_PROMPT}\n\nINTERVIEWER:\n${question}` }] }],
        generationConfig: { temperature: 0.3, maxOutputTokens: 600 },
      })
      return resp.data?.candidates?.[0]?.content?.parts?.[0]?.text || ""
    }

    if (provider === "groq") {
      const resp = await axios.default.post(
        "https://api.groq.com/openai/v1/chat/completions",
        {
          model: model || "llama-3.3-70b-versatile",
          messages: [
            { role: "system", content: ANSWER_PROMPT },
            { role: "user", content: `INTERVIEWER:\n${question}` },
          ],
          temperature: 0.3,
          max_completion_tokens: 600,
        },
        { headers: { Authorization: `Bearer ${config.apiKey}`, "Content-Type": "application/json" } }
      )
      return resp.data?.choices?.[0]?.message?.content || ""
    }

    if (provider === "bigo-free") {
      // Route through backend Groq proxy — llama-3.3-70b-versatile
      const result = await bigoApi.solveWithAI({
        licenseKey: config.licenseKey ?? null,
        deviceId: authHelper.getDeviceId(),
        systemPrompt: ANSWER_PROMPT,
        userPrompt: `INTERVIEWER:\n${question}`,
        // No screenshots — text-only for live answering
      })
      return result.content
    }

    throw new Error(`Unsupported provider: ${provider}`)
  }

  // ── Broadcast ─────────────────────────────────────────────────────────────

  private broadcast(): void {
    const win = this.getMainWindow()
    if (win && !win.isDestroyed()) {
      win.webContents.send("listen-state", this.getState())
    }
  }
}
