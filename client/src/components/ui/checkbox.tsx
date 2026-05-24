import * as React from 'react'
import { cn } from '@/lib/utils'

interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  /** Pass "indeterminate" to show the − state */
  'data-state'?: 'checked' | 'unchecked' | 'indeterminate'
  onCheckedChange?: (checked: boolean) => void
}

const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, 'data-state': dataState, onCheckedChange, onChange, ...props }, ref) => {
    const indeterminate = dataState === 'indeterminate'

    const innerRef = React.useRef<HTMLInputElement>(null)
    const combinedRef = (node: HTMLInputElement | null) => {
      (innerRef as React.MutableRefObject<HTMLInputElement | null>).current = node
      if (typeof ref === 'function') ref(node)
      else if (ref) (ref as React.MutableRefObject<HTMLInputElement | null>).current = node
    }

    React.useEffect(() => {
      if (innerRef.current) innerRef.current.indeterminate = indeterminate
    }, [indeterminate])

    return (
      <input
        type="checkbox"
        ref={combinedRef}
        className={cn(
          'h-4 w-4 rounded-sm border border-input accent-primary cursor-pointer',
          'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
          'disabled:cursor-not-allowed disabled:opacity-50',
          className,
        )}
        onChange={e => {
          onChange?.(e)
          onCheckedChange?.(e.target.checked)
        }}
        {...props}
      />
    )
  }
)
Checkbox.displayName = 'Checkbox'

export { Checkbox }
