// Debug.tsx
import { useQuery, useQueryClient } from "@tanstack/react-query"
import React, { useEffect, useRef, useState } from "react"
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter"
import { oneLight } from "react-syntax-highlighter/dist/esm/styles/prism"
import ScreenshotQueue from "../components/Queue/ScreenshotQueue"
import { Screenshot } from "../types/screenshots"
import { useToast } from "../contexts/toast"

async function fetchScreenshots(): Promise<Screenshot[]> {
  try {
    const existing = await window.electronAPI.getScreenshots()
    return (Array.isArray(existing) ? existing : []).map((p) => ({
      id: p.path,
      path: p.path,
      preview: p.preview,
      timestamp: Date.now()
    }))
  } catch {
    return []
  }
}

interface DebugProps {
  isProcessing: boolean
  setIsProcessing: (isProcessing: boolean) => void
  currentLanguage: string
  setLanguage: (language: string) => void
}

const Debug: React.FC<DebugProps> = ({
  isProcessing,
  setIsProcessing,
  currentLanguage
}) => {
  const { showToast } = useToast()
  const queryClient = useQueryClient()
  const contentRef = useRef<HTMLDivElement>(null)

  const { data: screenshots = [], refetch } = useQuery<Screenshot[]>({
    queryKey: ["screenshots"],
    queryFn: fetchScreenshots,
    staleTime: Infinity,
    gcTime: Infinity,
    refetchOnWindowFocus: false
  })

  const [newCode, setNewCode] = useState<string | null>(null)
  const [thoughtsData, setThoughtsData] = useState<string[] | null>(null)
  const [debugAnalysis, setDebugAnalysis] = useState<string | null>(null)
  const [timeComplexity, setTimeComplexity] = useState<string | null>(null)
  const [spaceComplexity, setSpaceComplexity] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const copyAnswer = () => {
    const parts: string[] = []
    if (thoughtsData?.length) parts.push(thoughtsData.map((t) => "• " + t).join("\n"))
    if (debugAnalysis) parts.push("\n" + debugAnalysis)
    if (newCode) parts.push("\n" + newCode)
    const payload = parts.join("\n").trim()
    if (!payload) return
    navigator.clipboard.writeText(payload).then(
      () => { setCopied(true); window.setTimeout(() => setCopied(false), 1400) },
      () => {}
    )
  }

  const applyData = (data: {
    code?: string
    debug_analysis?: string
    thoughts?: string[]
    time_complexity?: string
    space_complexity?: string
  }) => {
    if (data.debug_analysis) {
      setDebugAnalysis(data.debug_analysis)
      setNewCode(data.code || null)
      // Extract up to 4 bullet points from the analysis as summary thoughts
      const bullets = data.debug_analysis.match(/(?:^|\n)[ ]*[-*•\d.]+[ ]+([^\n]+)/g)
      if (bullets && bullets.length > 0) {
        setThoughtsData(bullets.slice(0, 4).map((b) => b.replace(/^[ ]*[-*•\d.]+[ ]+/, "").trim()))
      } else {
        setThoughtsData(data.thoughts ?? null)
      }
    } else {
      setNewCode(data.code ?? null)
      setThoughtsData(data.thoughts ?? null)
      setDebugAnalysis(null)
    }
    setTimeComplexity(data.time_complexity ?? null)
    setSpaceComplexity(data.space_complexity ?? null)
    setIsProcessing(false)
  }

  useEffect(() => {
    const cached = queryClient.getQueryData(["new_solution"]) as any
    if (cached) applyData(cached)

    const cleanupFns = [
      window.electronAPI.onScreenshotTaken(() => refetch()),
      window.electronAPI.onResetView(() => refetch()),
      window.electronAPI.onDebugStart(() => setIsProcessing(true)),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      window.electronAPI.onDebugSuccess((data: any) => {
        queryClient.setQueryData(["new_solution"], data)
        applyData(data)
      }),
      window.electronAPI.onDebugError((error: string) => {
        showToast("Processing Failed", "There was an error debugging your code.", "error")
        setIsProcessing(false)
        console.error("Debug error:", error)
      })
    ]

    const updateDimensions = () => {
      if (contentRef.current) {
        window.electronAPI.updateContentDimensions({
          width: contentRef.current.scrollWidth,
          height: contentRef.current.scrollHeight
        })
      }
    }
    const ro = new ResizeObserver(updateDimensions)
    if (contentRef.current) ro.observe(contentRef.current)
    updateDimensions()

    return () => {
      ro.disconnect()
      cleanupFns.forEach((fn) => fn())
    }
  }, [queryClient, setIsProcessing])

  const handleDeleteScreenshot = async (index: number) => {
    const s = screenshots[index]
    try {
      const res = await window.electronAPI.deleteScreenshot(s.path)
      if (res.success) refetch()
    } catch (err) {
      console.error("Error deleting screenshot:", err)
    }
  }

  const hasContent = !!(newCode || debugAnalysis)
  const langForHighlighter = currentLanguage === "golang" ? "go" : currentLanguage

  return (
    <div ref={contentRef}>
      {screenshots.length > 0 && (
        <div className="ml-3 mb-1">
          <ScreenshotQueue
            isLoading={isProcessing}
            screenshots={screenshots}
            onDeleteScreenshot={handleDeleteScreenshot}
          />
        </div>
      )}

      <div className="answer-card">
        <button
          className={"answer-card__copy" + (copied ? " answer-card__copy--success" : "")}
          onClick={copyAnswer}
          disabled={!hasContent}
          title="Copy entire debug answer"
          data-interactive="true"
        >
          {copied ? "Copied" : "Copy"}
        </button>

        <div className="answer-card__body" data-interactive="true">
          {!hasContent && (
            <div className="answer-card__loading">
              {isProcessing ? "Analysing screenshots…" : "Waiting for debug input…"}
            </div>
          )}

          {thoughtsData && thoughtsData.length > 0 && (
            <ul className="answer-card__thoughts">
              {thoughtsData.map((t, i) => (
                <li key={i}>{t}</li>
              ))}
            </ul>
          )}

          {debugAnalysis && (
            <div className="answer-card__prose" style={{ marginBottom: newCode ? 12 : 0 }}>
              {debugAnalysis}
            </div>
          )}

          {newCode && currentLanguage !== "subjective" && (
            <div className="answer-card__code">
              <SyntaxHighlighter
                language={langForHighlighter}
                style={oneLight}
                customStyle={{
                  margin: 0,
                  padding: "12px 14px",
                  fontSize: "12px",
                  background: "transparent",
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                  borderRadius: 0,
                  lineHeight: 1.55
                }}
                wrapLongLines
              >
                {newCode}
              </SyntaxHighlighter>
            </div>
          )}

          {newCode && currentLanguage === "subjective" && (
            <div className="answer-card__prose">{newCode}</div>
          )}

          {(timeComplexity || spaceComplexity) &&
            timeComplexity !== "N/A - Debug mode" && (
              <div style={{ marginTop: 10, display: "flex", gap: 8 }}>
                {timeComplexity && (
                  <span className="answer-card__ping">tc {timeComplexity.match(/O\([^)]+\)/i)?.[0] ?? timeComplexity.slice(0, 14)}</span>
                )}
                {spaceComplexity && (
                  <span className="answer-card__ping">sc {spaceComplexity.match(/O\([^)]+\)/i)?.[0] ?? spaceComplexity.slice(0, 14)}</span>
                )}
              </div>
            )}
        </div>
      </div>
    </div>
  )
}

export default Debug
