// Solutions.tsx
import React, { useState, useEffect, useRef } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter"
import { oneLight } from "react-syntax-highlighter/dist/esm/styles/prism"

import ScreenshotQueue from "../components/Queue/ScreenshotQueue"

import { ProblemStatementData } from "../types/solutions"
import SolutionCommands from "../components/Solutions/SolutionCommands"
import Debug from "./Debug"
import { useToast } from "../contexts/toast"
import { COMMAND_KEY } from "../utils/platform"

export const ContentSection = ({
  title,
  content,
  isLoading
}: {
  title: string
  content: React.ReactNode
  isLoading: boolean
}) => (
  <div className="space-y-2">
    <h2 className="text-[13px] font-medium text-white tracking-wide">
      {title}
    </h2>
    {isLoading ? (
      <div className="mt-4 flex">
        <p className="text-xs bg-gradient-to-r from-gray-300 via-gray-100 to-gray-300 bg-clip-text text-transparent animate-pulse">
          Extracting problem statement...
        </p>
      </div>
    ) : (
      <div className="text-[13px] leading-[1.4] text-gray-100 max-w-[600px]">
        {content}
      </div>
    )}
  </div>
)
const SolutionSection = ({
  title,
  content,
  isLoading,
  currentLanguage
}: {
  title: string
  content: React.ReactNode
  isLoading: boolean
  currentLanguage: string
}) => {
  const [copied, setCopied] = useState(false)

  const copyToClipboard = () => {
    if (typeof content === "string") {
      navigator.clipboard.writeText(content).then(() => {
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      })
    }
  }

  return (
    <div className="space-y-2 relative">
      <h2 className="text-[13px] font-medium text-white tracking-wide">
        {title}
      </h2>
      {isLoading ? (
        <div className="space-y-1.5">
          <div className="mt-4 flex">
            <p className="text-xs bg-gradient-to-r from-gray-300 via-gray-100 to-gray-300 bg-clip-text text-transparent animate-pulse">
              Loading solutions...
            </p>
          </div>
        </div>
      ) : (
        <div className="w-full relative">
          <button
            onClick={copyToClipboard}
            className="absolute top-2 right-2 text-xs text-white bg-white/10 hover:bg-white/20 rounded px-2 py-1 transition"
          >
            {copied ? "Copied!" : "Copy"}
          </button>
          <SyntaxHighlighter
            showLineNumbers
            language={currentLanguage == "golang" ? "go" : currentLanguage}
            style={dracula}
            customStyle={{
              maxWidth: "100%",
              margin: 0,
              padding: "1rem",
              whiteSpace: "pre-wrap",
              wordBreak: "break-all",
              backgroundColor: "rgba(22, 27, 34, 0.5)"
            }}
            wrapLongLines={true}
          >
            {content as string}
          </SyntaxHighlighter>
        </div>
      )}
    </div>
  )
}

export const ComplexitySection = ({
  timeComplexity,
  spaceComplexity,
  isLoading
}: {
  timeComplexity: string | null
  spaceComplexity: string | null
  isLoading: boolean
}) => {
  // Helper to ensure we have proper complexity values
  const formatComplexity = (complexity: string | null): string => {
    // Default if no complexity returned by LLM
    if (!complexity || complexity.trim() === "") {
      return "Complexity not available";
    }

    const bigORegex = /O\([^)]+\)/i;
    // Return the complexity as is if it already has Big O notation
    if (bigORegex.test(complexity)) {
      return complexity;
    }
    
    // Concat Big O notation to the complexity
    return `O(${complexity})`;
  };
  
  const formattedTimeComplexity = formatComplexity(timeComplexity);
  const formattedSpaceComplexity = formatComplexity(spaceComplexity);
  
  return (
    <div className="space-y-2">
      <h2 className="text-[13px] font-medium text-white tracking-wide">
        Complexity
      </h2>
      {isLoading ? (
        <p className="text-xs bg-gradient-to-r from-gray-300 via-gray-100 to-gray-300 bg-clip-text text-transparent animate-pulse">
          Calculating complexity...
        </p>
      ) : (
        <div className="space-y-3">
          <div className="text-[13px] leading-[1.4] text-gray-100 bg-white/5 rounded-md p-3">
            <div className="flex items-start gap-2">
              <div className="w-1 h-1 rounded-full bg-blue-400/80 mt-2 shrink-0" />
              <div>
                <strong>Time:</strong> {formattedTimeComplexity}
              </div>
            </div>
          </div>
          <div className="text-[13px] leading-[1.4] text-gray-100 bg-white/5 rounded-md p-3">
            <div className="flex items-start gap-2">
              <div className="w-1 h-1 rounded-full bg-blue-400/80 mt-2 shrink-0" />
              <div>
                <strong>Space:</strong> {formattedSpaceComplexity}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export interface SolutionsProps {
  setView: (view: "queue" | "solutions" | "debug") => void
  credits: number
  currentLanguage: string
  setLanguage: (language: string) => void
}
const Solutions: React.FC<SolutionsProps> = ({
  setView,
  credits,
  currentLanguage,
  setLanguage
}) => {
  const queryClient = useQueryClient()
  const contentRef = useRef<HTMLDivElement>(null)

  const [debugProcessing, setDebugProcessing] = useState(false)
  const [problemStatementData, setProblemStatementData] =
    useState<ProblemStatementData | null>(null)
  const [solutionData, setSolutionData] = useState<string | null>(null)
  const [thoughtsData, setThoughtsData] = useState<string[] | null>(null)
  const [timeComplexityData, setTimeComplexityData] = useState<string | null>(
    null
  )
  const [spaceComplexityData, setSpaceComplexityData] = useState<string | null>(
    null
  )
  const [stepsData, setStepsData] = useState<string[] | null>(null)
  const [conclusionData, setConclusionData] = useState<string | null>(null)
  const [memoryId, setMemoryId] = useState<number | null>(null)
  const [fromMemory, setFromMemory] = useState(false)
  const [likedState, setLikedState] = useState<boolean | null>(null)

  const [isTooltipVisible, setIsTooltipVisible] = useState(false)
  const [tooltipHeight, setTooltipHeight] = useState(0)

  const [isResetting, setIsResetting] = useState(false)

  interface Screenshot {
    id: string
    path: string
    preview: string
    timestamp: number
  }

  const [extraScreenshots, setExtraScreenshots] = useState<Screenshot[]>([])

  useEffect(() => {
    const fetchScreenshots = async () => {
      try {
        const existing = await window.electronAPI.getScreenshots()
        console.log("Raw screenshot data:", existing)
        const screenshots = (Array.isArray(existing) ? existing : []).map(
          (p) => ({
            id: p.path,
            path: p.path,
            preview: p.preview,
            timestamp: Date.now()
          })
        )
        console.log("Processed screenshots:", screenshots)
        setExtraScreenshots(screenshots)
      } catch (error) {
        console.error("Error loading extra screenshots:", error)
        setExtraScreenshots([])
      }
    }

    fetchScreenshots()
  }, [solutionData])

  const { showToast } = useToast()

  useEffect(() => {
    // Height update logic
    const updateDimensions = () => {
      if (contentRef.current) {
        let contentHeight = contentRef.current.scrollHeight
        const contentWidth = contentRef.current.scrollWidth
        if (isTooltipVisible) {
          contentHeight += tooltipHeight
        }
        window.electronAPI.updateContentDimensions({
          width: contentWidth,
          height: contentHeight
        })
      }
    }

    // Initialize resize observer
    const resizeObserver = new ResizeObserver(updateDimensions)
    if (contentRef.current) {
      resizeObserver.observe(contentRef.current)
    }
    updateDimensions()

    // Set up event listeners
    const cleanupFunctions = [
      window.electronAPI.onScreenshotTaken(async () => {
        try {
          const existing = await window.electronAPI.getScreenshots()
          const screenshots = (Array.isArray(existing) ? existing : []).map(
            (p) => ({
              id: p.path,
              path: p.path,
              preview: p.preview,
              timestamp: Date.now()
            })
          )
          setExtraScreenshots(screenshots)
        } catch (error) {
          console.error("Error loading extra screenshots:", error)
        }
      }),
      window.electronAPI.onResetView(() => {
        // Set resetting state first
        setIsResetting(true)

        // Remove queries
        queryClient.removeQueries({
          queryKey: ["solution"]
        })
        queryClient.removeQueries({
          queryKey: ["new_solution"]
        })

        // Reset screenshots
        setExtraScreenshots([])

        // After a small delay, clear the resetting state
        setTimeout(() => {
          setIsResetting(false)
        }, 0)
      }),
      window.electronAPI.onSolutionStart(() => {
        // Every time processing starts, reset relevant states
        setSolutionData(null)
        setThoughtsData(null)
        setTimeComplexityData(null)
        setSpaceComplexityData(null)
        setStepsData(null)
        setConclusionData(null)
        setMemoryId(null)
        setFromMemory(false)
        setLikedState(null)
      }),
      window.electronAPI.onProblemExtracted((data) => {
        queryClient.setQueryData(["problem_statement"], data)
      }),
      //if there was an error processing the initial solution
      window.electronAPI.onSolutionError((error: string) => {
        showToast("Processing Failed", error, "error")
        // Reset solutions in the cache (even though this shouldn't ever happen) and complexities to previous states
        const solution = queryClient.getQueryData(["solution"]) as {
          code: string
          thoughts: string[]
          time_complexity: string
          space_complexity: string
        } | null
        if (!solution) {
          setView("queue")
        }
        setSolutionData(solution?.code || null)
        setThoughtsData(solution?.thoughts || null)
        setTimeComplexityData(solution?.time_complexity || null)
        setSpaceComplexityData(solution?.space_complexity || null)
        setStepsData((solution as any)?.steps || null)
        setConclusionData((solution as any)?.conclusion || null)
        setMemoryId((solution as any)?.memoryId ?? null)
        setFromMemory(!!(solution as any)?.fromMemory)
        console.error("Processing error:", error)
      }),
      //when the initial solution is generated, we'll set the solution data to that
      window.electronAPI.onSolutionSuccess((data) => {
        if (!data) {
          console.warn("Received empty or invalid solution data")
          return
        }
        console.log({ data })
        const solutionData = {
          code: data.code,
          thoughts: data.thoughts,
          time_complexity: data.time_complexity,
          space_complexity: data.space_complexity
        }

        queryClient.setQueryData(["solution"], solutionData)
        setSolutionData(solutionData.code || null)
        setThoughtsData(solutionData.thoughts || null)
        setTimeComplexityData(solutionData.time_complexity || null)
        setSpaceComplexityData(solutionData.space_complexity || null)
        setStepsData((data as any).steps || null)
        setConclusionData((data as any).conclusion || null)
        setMemoryId((data as any).memoryId ?? null)
        setFromMemory(!!(data as any).fromMemory)
        setLikedState(null)

        // Fetch latest screenshots when solution is successful
        const fetchScreenshots = async () => {
          try {
            const existing = await window.electronAPI.getScreenshots()
            const screenshots =
              existing.previews?.map((p) => ({
                id: p.path,
                path: p.path,
                preview: p.preview,
                timestamp: Date.now()
              })) || []
            setExtraScreenshots(screenshots)
          } catch (error) {
            console.error("Error loading extra screenshots:", error)
            setExtraScreenshots([])
          }
        }
        fetchScreenshots()
      }),

      //########################################################
      //DEBUG EVENTS
      //########################################################
      window.electronAPI.onDebugStart(() => {
        //we'll set the debug processing state to true and use that to render a little loader
        setDebugProcessing(true)
      }),
      //the first time debugging works, we'll set the view to debug and populate the cache with the data
      window.electronAPI.onDebugSuccess((data) => {
        queryClient.setQueryData(["new_solution"], data)
        setDebugProcessing(false)
      }),
      //when there was an error in the initial debugging, we'll show a toast and stop the little generating pulsing thing.
      window.electronAPI.onDebugError(() => {
        showToast(
          "Processing Failed",
          "There was an error debugging your code.",
          "error"
        )
        setDebugProcessing(false)
      }),
      window.electronAPI.onProcessingNoScreenshots(() => {
        showToast(
          "No Screenshots",
          "There are no extra screenshots to process.",
          "neutral"
        )
      }),
      // Removed out of credits handler - unlimited credits in this version
    ]

    return () => {
      resizeObserver.disconnect()
      cleanupFunctions.forEach((cleanup) => cleanup())
    }
  }, [isTooltipVisible, tooltipHeight])

  useEffect(() => {
    setProblemStatementData(
      queryClient.getQueryData(["problem_statement"]) || null
    )
    setSolutionData(queryClient.getQueryData(["solution"]) || null)

    const unsubscribe = queryClient.getQueryCache().subscribe((event) => {
      if (event?.query.queryKey[0] === "problem_statement") {
        setProblemStatementData(
          queryClient.getQueryData(["problem_statement"]) || null
        )
      }
      if (event?.query.queryKey[0] === "solution") {
        const solution = queryClient.getQueryData(["solution"]) as {
          code: string
          thoughts: string[]
          time_complexity: string
          space_complexity: string
        } | null

        setSolutionData(solution?.code ?? null)
        setThoughtsData(solution?.thoughts ?? null)
        setTimeComplexityData(solution?.time_complexity ?? null)
        setSpaceComplexityData(solution?.space_complexity ?? null)
        setStepsData((solution as any)?.steps ?? null)
        setConclusionData((solution as any)?.conclusion ?? null)
      }
    })
    return () => unsubscribe()
  }, [queryClient])

  const handleTooltipVisibilityChange = (visible: boolean, height: number) => {
    setIsTooltipVisible(visible)
    setTooltipHeight(height)
  }

  const handleDeleteExtraScreenshot = async (index: number) => {
    const screenshotToDelete = extraScreenshots[index]

    try {
      const response = await window.electronAPI.deleteScreenshot(
        screenshotToDelete.path
      )

      if (response.success) {
        // Fetch and update screenshots after successful deletion
        const existing = await window.electronAPI.getScreenshots()
        const screenshots = (Array.isArray(existing) ? existing : []).map(
          (p) => ({
            id: p.path,
            path: p.path,
            preview: p.preview,
            timestamp: Date.now()
          })
        )
        setExtraScreenshots(screenshots)
      } else {
        console.error("Failed to delete extra screenshot:", response.error)
        showToast("Error", "Failed to delete the screenshot", "error")
      }
    } catch (error) {
      console.error("Error deleting extra screenshot:", error)
      showToast("Error", "Failed to delete the screenshot", "error")
    }
  }

  // Helper: extract just the Big-O part for the compact ping chips.
  const shortComplexity = (raw: string | null): string | null => {
    if (!raw) return null
    const m = raw.match(/O\([^)]+\)/i)
    return m ? m[0] : raw.slice(0, 14)
  }

  const handleLike = async (liked: boolean) => {
    if (memoryId === null) return
    setLikedState(liked)
    await window.electronAPI.likeMemory(memoryId, liked)
  }

  const [copied, setCopied] = useState(false)
  const copyAnswer = () => {
    // Build a single text payload: thoughts (if any) + code + complexity.
    // Falls back to whatever subset is available so it works during loading too.
    const parts: string[] = []
    if (thoughtsData?.length) parts.push(thoughtsData.map((t) => "• " + t).join("\n"))
    if (solutionData) parts.push("\n" + solutionData)
    if (stepsData?.length) parts.push("\nSteps:\n" + stepsData.map((s, i) => `${i + 1}. ${s}`).join("\n"))
    if (timeComplexityData) parts.push("\nTime: " + timeComplexityData)
    if (spaceComplexityData) parts.push("Space: " + spaceComplexityData)
    const payload = parts.join("\n").trim()
    if (!payload) return
    navigator.clipboard.writeText(payload).then(
      () => {
        setCopied(true)
        window.setTimeout(() => setCopied(false), 1400)
      },
      () => { /* ignore */ }
    )
  }

  if (!isResetting && queryClient.getQueryData(["new_solution"])) {
    return (
      <Debug
        isProcessing={debugProcessing}
        setIsProcessing={setDebugProcessing}
        currentLanguage={currentLanguage}
        setLanguage={setLanguage}
      />
    )
  }

  const tShort = shortComplexity(timeComplexityData)
  const sShort = shortComplexity(spaceComplexityData)

  return (
    <div ref={contentRef}>
      {/* Tiny screenshot chips above the card, only when there are extras */}
      {extraScreenshots.length > 0 && (
        <div className="ml-3 mb-1">
          <ScreenshotQueue
            isLoading={debugProcessing}
            screenshots={extraScreenshots}
            onDeleteScreenshot={handleDeleteExtraScreenshot}
          />
        </div>
      )}

      <div className="answer-card">
        {/* Complexity pings + from-memory badge — top right */}
        {currentLanguage !== "subjective" && (tShort || sShort || fromMemory) && (
          <div className="answer-card__pings">
            {fromMemory && <span className="answer-card__ping answer-card__ping--memory">⚡ memory</span>}
            {tShort && <span className="answer-card__ping">tc {tShort}</span>}
            {sShort && <span className="answer-card__ping">sc {sShort}</span>}
          </div>
        )}

        {/* Like / Dislike + Copy — pinned bottom-right, always visible */}
        <div className="answer-card__actions" data-interactive="true">
          {memoryId !== null && (
            <>
              <button
                className={"answer-card__like" + (likedState === true ? " answer-card__like--active" : "")}
                onClick={() => handleLike(true)}
                title="Good answer — use from memory next time"
                data-interactive="true"
              >
                👍
              </button>
              <button
                className={"answer-card__like answer-card__like--dislike" + (likedState === false ? " answer-card__like--bad" : "")}
                onClick={() => handleLike(false)}
                title="Bad answer — don't reuse from memory"
                data-interactive="true"
              >
                👎
              </button>
            </>
          )}
          <button
            className={"answer-card__copy" + (copied ? " answer-card__copy--success" : "")}
            onClick={copyAnswer}
            disabled={!solutionData && !(thoughtsData && thoughtsData.length > 0)}
            title="Copy entire answer"
            data-interactive="true"
          >
            {copied ? "Copied" : "Copy"}
          </button>
        </div>

        {/* Scrollable body */}
        <div className="answer-card__body" data-interactive="true">
          {!solutionData && (
            <div className="answer-card__loading">
              {problemStatementData ? "Generating solution…" : "Extracting problem…"}
            </div>
          )}

          {solutionData && (
            <>
              {thoughtsData && thoughtsData.length > 0 && (
                <ul className="answer-card__thoughts">
                  {thoughtsData.map((t, i) => (
                    <li key={i}>{t}</li>
                  ))}
                </ul>
              )}

              {currentLanguage === "subjective" ? (
                /* Plain prose — paragraph + step points come back as text, not code. */
                <div className="answer-card__prose">{solutionData}</div>
              ) : (
                <div className="answer-card__code">
                  <SyntaxHighlighter
                    language={currentLanguage === "golang" ? "go" : currentLanguage}
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
                    {solutionData}
                  </SyntaxHighlighter>
                </div>
              )}

              {stepsData && stepsData.length > 0 && (
                <>
                  {currentLanguage !== "subjective" && (
                    <p className="answer-card__section-label">Alternative Approaches</p>
                  )}
                  <ol className="answer-card__steps">
                    {stepsData.map((s, i) => (
                      <li key={i}>{s}</li>
                    ))}
                  </ol>
                </>
              )}

              {conclusionData && (
                <div className="answer-card__conclusion">{conclusionData}</div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default Solutions
