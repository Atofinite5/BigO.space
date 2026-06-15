import { useEffect, useRef, useState } from "react"
import { useToast } from "../../contexts/toast"

interface ListenExchange { q: string; a: string; at: number }
interface ListenState {
  listening: boolean
  processing: boolean
  transcript: string
  answer: string
  history: ListenExchange[]
}

// Standard chunking: record back-to-back complete clips of this length and
// send each to Groq Whisper. Short enough to feel live, long enough to carry
// a question fragment.
const CHUNK_MS = 7000
const MIN_BLOB_BYTES = 2400

export function ListenView() {
  const { showToast } = useToast()
  const [state, setState] = useState<ListenState | null>(null)
  const [status, setStatus] = useState<string>("")

  const streamRef = useRef<MediaStream | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const chunkTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const listeningRef = useRef(false)

  // ── subscribe to main-process state ─────────────────────────────────────
  useEffect(() => {
    let alive = true
    window.electronAPI.listenGetState?.().then((s: ListenState | null) => {
      if (alive && s) { setState(s); listeningRef.current = s.listening; if (s.listening) startCapture() }
    })
    const offState = window.electronAPI.onListenState?.((s: ListenState) => {
      setState(s)
      if (s.listening && !listeningRef.current) { listeningRef.current = true; startCapture() }
      else if (!s.listening && listeningRef.current) { listeningRef.current = false; stopCapture() }
    })
    const offResult = window.electronAPI.onListenResult?.((r) => {
      if (!r.ok && r.error && !/no question detected|no speech/i.test(r.error)) {
        showToast("Listen", r.error, "error")
      }
    })
    return () => { alive = false; offState?.(); offResult?.(); stopCapture() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── system-audio capture ─────────────────────────────────────────────────
  async function startCapture() {
    if (streamRef.current) return
    setStatus("Connecting to system audio…")
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true })
      stream.getVideoTracks().forEach((t) => t.stop())
      const audioTracks = stream.getAudioTracks()
      if (!audioTracks.length) {
        setStatus("No system audio. Grant Screen Recording permission to BigO in System Settings → Privacy & Security.")
        stream.getTracks().forEach((t) => t.stop())
        return
      }
      streamRef.current = new MediaStream(audioTracks)
      setStatus("Listening…")
      recordChunk()
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setStatus(`Couldn't start audio capture: ${msg}. Check Screen Recording permission.`)
    }
  }

  // Record one complete CHUNK_MS clip, send it, then queue the next.
  function recordChunk() {
    const stream = streamRef.current
    if (!stream || !listeningRef.current) return
    try {
      const mime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : "audio/webm"
      const mr = new MediaRecorder(stream, { mimeType: mime })
      chunksRef.current = []
      mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      mr.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: mime })
        chunksRef.current = []
        recorderRef.current = null
        if (blob.size >= MIN_BLOB_BYTES) {
          const b64 = await blobToBase64(blob)
          window.electronAPI.listenProcessAudio?.(b64, mime)
        }
        // chain the next chunk immediately
        if (listeningRef.current) recordChunk()
      }
      mr.start()
      recorderRef.current = mr
      chunkTimerRef.current = setTimeout(() => {
        try { mr.state !== "inactive" && mr.stop() } catch { /* noop */ }
      }, CHUNK_MS)
    } catch {
      /* retry shortly */
      if (listeningRef.current) chunkTimerRef.current = setTimeout(recordChunk, 500)
    }
  }

  function stopCapture() {
    if (chunkTimerRef.current) clearTimeout(chunkTimerRef.current)
    chunkTimerRef.current = null
    try { recorderRef.current && recorderRef.current.state !== "inactive" && recorderRef.current.stop() } catch { /* noop */ }
    recorderRef.current = null
    chunksRef.current = []
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    setStatus("")
  }

  const toggle = () => window.electronAPI.listenToggle?.()
  const clear = () => window.electronAPI.listenClear?.()

  if (!state || !state.listening) return null

  const answerLines = (state.answer || "").split("\n").filter((l) => l.trim())

  return (
    <div className="answer-card listen-card" data-interactive="true"
      onMouseEnter={() => window.electronAPI.setIgnoreMouseEvents?.(false)}>
      <div className="listen-card__header" data-interactive="true">
        <div className="listen-card__title">
          <span className={`listen-dot ${state.processing ? "is-busy" : "is-live"}`} />
          Listen {state.processing ? "· thinking…" : "· live"}
        </div>
        <div className="listen-card__actions">
          <button type="button" className="listen-btn" onClick={clear} data-interactive="true">Clear</button>
          <button type="button" className="listen-btn listen-btn--stop" onClick={toggle} data-interactive="true">Stop</button>
        </div>
      </div>

      {status && <div className="listen-card__status" data-interactive="true">{status}</div>}

      {state.answer && (
        <div className="listen-card__a" data-interactive="true">
          {answerLines.map((line, i) => (
            <p key={i} className={line.trim().startsWith("•") ? "listen-bullet" : "listen-lead"}>{line}</p>
          ))}
        </div>
      )}

      {state.transcript && (
        <div className="listen-card__q" data-interactive="true">
          <span className="listen-card__q-label">Transcript</span>
          {state.transcript.length > 240 ? "…" + state.transcript.slice(-240) : state.transcript}
        </div>
      )}

      {!state.transcript && !state.answer && (
        <div className="listen-card__empty" data-interactive="true">
          Waiting for the interviewer to speak… answers appear here automatically every few seconds.
        </div>
      )}
    </div>
  )
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => {
      const s = String(reader.result)
      resolve(s.slice(s.indexOf(",") + 1))
    }
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}
