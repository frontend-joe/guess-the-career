import { useState } from 'react'
import { SlidersHorizontal } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useSettings } from '@/contexts/SettingsContext'
import { cn } from '@/lib/utils'

const OPTIONS = [25, 50, 75, 100] as const

// Header settings icon (top-right of every game) opening a global-settings modal.
// First setting: Guess percentage — the share of a round's players you must guess
// to pass it. Self-contained so it can be dropped into any game's header.
export function GameSettingsButton() {
  const [open, setOpen] = useState(false)
  const { guessPercentage, setGuessPercentage } = useSettings()

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Settings"
        title="Settings"
        className="text-white/60 hover:text-white transition-colors p-1"
      >
        <SlidersHorizontal size={18} />
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="w-[calc(100vw-2rem)] max-w-sm">
          <DialogHeader>
            <DialogTitle>Settings</DialogTitle>
          </DialogHeader>

          <div className="space-y-2">
            <div className="flex items-baseline justify-between">
              <span className="text-sm font-medium">Guess percentage</span>
              <span className="text-xs text-muted-foreground">Difficulty</span>
            </div>
            <div className="grid grid-cols-4 gap-1.5">
              {OPTIONS.map((pct) => (
                <button
                  key={pct}
                  type="button"
                  onClick={() => setGuessPercentage(pct)}
                  className={cn(
                    'rounded-md border py-2 text-sm font-semibold transition-colors',
                    guessPercentage === pct
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-input hover:bg-muted',
                  )}
                >
                  {pct}%
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Guess this share of each round's players to pass it. 100% means you must
              name them all.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
