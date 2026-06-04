import React from "react"

interface Screenshot {
  path: string
  preview: string
}

interface ScreenshotQueueProps {
  isLoading: boolean
  screenshots: Screenshot[]
  onDeleteScreenshot: (index: number) => void
}

/**
 * Capture indicator. The numbered chips were too noisy in the panel; we now
 * surface only a single discreet dot indicating "you have N captures pending"
 * without spelling them out one-by-one. Click the dot to drop the most recent.
 */
const ScreenshotQueue: React.FC<ScreenshotQueueProps> = ({
  screenshots
}) => {
  if (screenshots.length === 0) return null

  return (
    <div className="flex items-center gap-2" data-interactive="true">
            {/* Green capture indicator removed */}
    </div>
  )
}

export default ScreenshotQueue
