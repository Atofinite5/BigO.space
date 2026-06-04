import { useEffect, useMemo, useRef, useState } from "react"
import { useToast } from "../../contexts/toast"

interface YenBucket {
  id: number
  content: string
  createdAt: number
  screenshotCount: number
}

interface YenState {
  panelOpen: boolean
  capturing: boolean
  activeBucket: number | null
  captureQueue: string[]
  buckets: Array<YenBucket | null>
  processing: boolean
}

const BUCKET_COUNT = 5

interface ParsedBucket {
  before: string
  code: string | null
  language: string
  after: string
}

// Pull the first fenced code block out of the LLM response so it can be
// rendered in its own styled card with a dedicated Copy-code button. The
// rest of the response (Topic / Question / Approaches / Explanation /
// Key Points) is rendered as plain pre, naturally splitting summary text
// from runnable code.
function parseBucketContent(raw: string): ParsedBucket {
  const m = raw.match(/```([A-Za-z0-9_+-]*)\n([\s\S]*?)```/)
  if (!m || m.index === undefined) {
    return { before: raw, code: null, language: "", after: "" }
  }
  return {
    before: raw.slice(0, m.index).trimEnd(),
    code: m[2].replace(/\s+$/, ""),
    language: m[1] || "",
    after: raw.slice(m.index + m[0].length).trimStart()
  }
}

export function YenView() {
  const { showToast } = useToast()
  const [state, setState] = useState<YenState | null>(null)
  const cardRefs = useRef<Array<HTMLDivElement | null>>([])
  const lastAssertRef = useRef(0)

  // Pull initial state, subscribe to updates.
  useEffect(() => {
    let alive = true
    window.electronAPI.yenGetState().then((s: YenState | null) => {
      if (alive) setState(s)
    })
    const off = window.electronAPI.onYenState((s: YenState) => setState(s))
    const offResult = window.electronAPI.onYenProcessResult(
      (r: { ok: boolean; error?: string; bucketIndex?: number }) => {
        if (r.ok) {
          showToast("BigO saved", `Stored in bucket ${r.bucketIndex}`, "success")
        } else if (r.error) {
          showToast("BigO failed", r.error, "error")
        }
      }
    )
    return () => {
      alive = false
      off()
      offResult()
    }
  }, [showToast])

  // Scroll the active bucket into view whenever it changes.
  useEffect(() => {
    if (!state?.activeBucket) return
    const el = cardRefs.current[state.activeBucket - 1]
    if (el) el.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" })
  }, [state?.activeBucket])

  // Click-through heartbeat: while the panel is open re-assert mouse
  // capture every second. Defends against a missed mousemove or stale
  // renderer cache leaving the window in ignore-mode (scroll passes
  // through to the desktop, clicks stop registering).
  useEffect(() => {
    if (!state?.panelOpen) return
    const id = window.setInterval(() => {
      window.electronAPI.setIgnoreMouseEvents?.(false)
    }, 1000)
    return () => window.clearInterval(id)
  }, [state?.panelOpen])

  if (!state || !state.panelOpen) return null

  // Throttled re-assert for inline event handlers. Wheel can fire dozens
  // of times per second; cap to 4 IPC calls/sec.
  const forceInteractive = () => {
    const now = Date.now()
    if (now - lastAssertRef.current > 250) {
      lastAssertRef.current = now
      window.electronAPI.setIgnoreMouseEvents?.(false)
    }
  }

  const copyViaIpc = async (text: string, successTitle: string, successMsg: string) => {
    const res = await window.electronAPI.yenCopyText(text)
    if (res?.ok) {
      showToast(successTitle, successMsg, "success")
    } else {
      showToast("Copy failed", res?.error || "Clipboard unavailable", "error")
    }
  }

  const handleCopy = (text: string) => copyViaIpc(text, "Copied", "BigO copied to clipboard")
  const handleCopyCode = (code: string) =>
    copyViaIpc(code, "Code copied", "Code block copied to clipboard")

  const handleDelete = async (bucketIndex: number) => {
    await window.electronAPI.yenDeleteBucket(bucketIndex)
    showToast("Deleted", `Bucket ${bucketIndex} cleared`, "neutral")
  }

  const handleSelectBucket = async (bucketIndex: number) => {
    await window.electronAPI.yenOpenBucket(bucketIndex)
  }

  const handleClearCaptures = async () => {
    await window.electronAPI.yenClearCaptures()
  }

  const filledCount = state.buckets.filter(Boolean).length

  return (
    <div
      className="answer-card yen-card"
      data-interactive="true"
      onMouseEnter={forceInteractive}
      onMouseMove={forceInteractive}
      onWheelCapture={forceInteractive}
    >
      <div className="yen-card__header" data-interactive="true">
        <div className="yen-card__title">
          Yen
          <span className="yen-card__subtle">
            {filledCount}/{BUCKET_COUNT} filled
          </span>
        </div>
      </div>

      <div className="yen-card__capture-bar" data-interactive="true">
        {state.processing ? (
          <span className="yen-card__capture-status">
            <span className="yen-card__chevron" aria-hidden="true">&gt;</span>
            Summarizing {state.captureQueue.length} screenshot
            {state.captureQueue.length === 1 ? "" : "s"}…
          </span>
        ) : state.captureQueue.length > 0 ? (
          <>
            <span className="yen-card__capture-status">
              <span className="yen-card__chevron" aria-hidden="true">&gt;</span>
              {state.captureQueue.length} captured · press <kbd>Cmd+Enter</kbd> to save
            </span>
            <button
              type="button"
              className="yen-card__minor-btn"
              onClick={handleClearCaptures}
              data-interactive="true"
            >
              Clear
            </button>
          </>
        ) : (
          <span className="yen-card__capture-status yen-card__capture-status--muted">
            <span className="yen-card__chevron" aria-hidden="true">&gt;</span>
            <kbd>Cmd+H</kbd> capture · <kbd>Cmd+Enter</kbd> save · <kbd>Cmd+P</kbd> then <kbd>0</kbd>+<kbd>1</kbd>–<kbd>5</kbd> jump
          </span>
        )}
      </div>

      <div className="yen-card__rail" data-interactive="true">
        {Array.from({ length: BUCKET_COUNT }, (_, i) => {
          const idx = i + 1
          const bucket = state.buckets[i]
          const isActive = state.activeBucket === idx
          return (
            <div
              key={idx}
              ref={(el) => (cardRefs.current[i] = el)}
              className={
                "yen-bucket" +
                (isActive ? " yen-bucket--active" : "") +
                (!bucket ? " yen-bucket--empty" : "")
              }
              onClick={() => !bucket && handleSelectBucket(idx)}
              data-interactive="true"
            >
              <div className="yen-bucket__header">
                <span className="yen-bucket__id">Bucket {idx}</span>
                {bucket && (
                  <span className="yen-bucket__meta">
                    {bucket.screenshotCount} shot{bucket.screenshotCount === 1 ? "" : "s"} ·{" "}
                    {new Date(bucket.createdAt).toLocaleTimeString()}
                  </span>
                )}
              </div>

              {bucket ? (
                <BucketBody
                  bucket={bucket}
                  onCopy={handleCopy}
                  onCopyCode={handleCopyCode}
                  onDelete={handleDelete}
                />
              ) : (
                <div className="yen-bucket__empty-body">
                  <p>Empty</p>
                  <p className="yen-bucket__empty-hint">
                    {state.captureQueue.length > 0
                      ? "Press Cmd+Enter to save the current captures here"
                      : "Press Cmd+H to capture, then Cmd+Enter to save"}
                  </p>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

interface BucketBodyProps {
  bucket: YenBucket
  onCopy: (text: string) => void
  onCopyCode: (code: string) => void
  onDelete: (bucketIndex: number) => void
}

function BucketBody({ bucket, onCopy, onCopyCode, onDelete }: BucketBodyProps) {
  const parsed = useMemo(() => parseBucketContent(bucket.content), [bucket.content])
  const hasCode = !!parsed.code

  return (
    <>
      {/* Sticky action bar inside the bucket — always visible, even while
          long content scrolls below. Gives the user emergency Copy-code
          access without having to scroll to the bottom. */}
      <div className="yen-bucket__topbar" data-interactive="true">
        <button
          type="button"
          className="yen-bucket__btn yen-bucket__btn--primary"
          disabled={!hasCode}
          onClick={(e) => {
            e.stopPropagation()
            if (parsed.code) onCopyCode(parsed.code)
          }}
          title={hasCode ? "Copy just the code block" : "No code block in this bucket"}
          data-interactive="true"
        >
          Copy code
        </button>
        <button
          type="button"
          className="yen-bucket__btn"
          onClick={(e) => {
            e.stopPropagation()
            onCopy(bucket.content)
          }}
          title="Copy the full Yen response"
          data-interactive="true"
        >
          Copy all
        </button>
        <button
          type="button"
          className="yen-bucket__btn yen-bucket__btn--danger"
          onClick={(e) => {
            e.stopPropagation()
            onDelete(bucket.id)
          }}
          title="Delete this bucket"
          data-interactive="true"
        >
          Delete
        </button>
      </div>

      <div className="yen-bucket__scroll" data-interactive="true">
        {parsed.before && (
          <pre className="yen-bucket__text">{parsed.before}</pre>
        )}

        {parsed.code && (
          <div className="yen-bucket__code" data-interactive="true">
            <div className="yen-bucket__code-bar">
              <span className="yen-bucket__code-lang">
                {parsed.language || "code"}
              </span>
              <button
                type="button"
                className="yen-bucket__code-copy"
                onClick={(e) => {
                  e.stopPropagation()
                  if (parsed.code) onCopyCode(parsed.code)
                }}
                data-interactive="true"
              >
                Copy code
              </button>
            </div>
            <pre className="yen-bucket__code-pre">{parsed.code}</pre>
          </div>
        )}

        {parsed.after && (
          <pre className="yen-bucket__text yen-bucket__text--summary">
            {parsed.after}
          </pre>
        )}

        {/* Fallback for non-coding responses with no fenced block. */}
        {!parsed.code && !parsed.after && !parsed.before && (
          <pre className="yen-bucket__text">{bucket.content}</pre>
        )}
      </div>
    </>
  )
}
