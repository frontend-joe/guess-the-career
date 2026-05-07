import { useState } from 'react'
import { RefreshCw, Loader2, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'

type State = 'idle' | 'loading' | 'success'

export function RescrapeButton({
  onRescrape,
  variant = 'full',
}: {
  onRescrape: () => Promise<unknown>
  variant?: 'full' | 'icon'
}) {
  const [state, setState] = useState<State>('idle')

  async function handle() {
    if (state !== 'idle') return
    setState('loading')
    try {
      await onRescrape()
      setState('success')
      setTimeout(() => setState('idle'), 3000)
    } catch {
      setState('idle')
    }
  }

  if (variant === 'icon') {
    return (
      <Button
        variant="ghost"
        size="icon"
        className={`h-7 w-7 ${state === 'success' ? 'text-green-600' : ''}`}
        onClick={handle}
        disabled={state === 'loading'}
        title="Re-scrape"
      >
        {state === 'loading' && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
        {state === 'success' && <Check className="h-3.5 w-3.5" />}
        {state === 'idle' && <RefreshCw className="h-3.5 w-3.5" />}
      </Button>
    )
  }

  if (state === 'success') {
    return (
      <Button variant="outline" size="sm" disabled className="text-green-600 border-green-300">
        <Check className="h-3.5 w-3.5 mr-1.5" />
        Updated
      </Button>
    )
  }

  return (
    <Button variant="outline" size="sm" onClick={handle} disabled={state === 'loading'}>
      {state === 'loading'
        ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
        : <RefreshCw className="h-3.5 w-3.5 mr-1.5" />}
      Re-scrape
    </Button>
  )
}
