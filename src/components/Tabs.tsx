import { useId, useRef, useState, type ReactNode } from 'react'

// Accessible tab set following the ARIA tabs pattern: roving tabindex, arrow
// keys to move between tabs, Home/End to jump to the ends. Only the active
// panel is mounted.

export type TabItem = { id: string; label: string; content: ReactNode }

export default function Tabs({
  tabs,
  initial,
  className = '',
}: {
  tabs: TabItem[]
  initial?: string
  className?: string
}) {
  const base = useId()
  const [active, setActive] = useState(initial ?? tabs[0]?.id)
  const refs = useRef<Record<string, HTMLButtonElement | null>>({})

  if (!tabs.length) return null
  const index = Math.max(0, tabs.findIndex((t) => t.id === active))

  const focusTab = (i: number) => {
    const next = tabs[(i + tabs.length) % tabs.length]
    setActive(next.id)
    refs.current[next.id]?.focus()
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    const keys: Record<string, number> = {
      ArrowRight: index + 1,
      ArrowLeft: index - 1,
      Home: 0,
      End: tabs.length - 1,
    }
    if (!(e.key in keys)) return
    e.preventDefault()
    focusTab(keys[e.key])
  }

  return (
    <div className={className}>
      <div
        role="tablist"
        aria-label="Program information"
        onKeyDown={onKeyDown}
        className="flex gap-1 overflow-x-auto border-b border-line"
      >
        {tabs.map((t) => {
          const selected = t.id === active
          return (
            <button
              key={t.id}
              ref={(el) => {
                refs.current[t.id] = el
              }}
              role="tab"
              id={`${base}-tab-${t.id}`}
              aria-selected={selected}
              aria-controls={`${base}-panel-${t.id}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => setActive(t.id)}
              className={`-mb-px shrink-0 border-b-2 px-4 py-2.5 text-sm font-600 transition-colors ${
                selected
                  ? 'border-brand-500 text-ink'
                  : 'border-transparent text-slate hover:text-ink'
              }`}
            >
              {t.label}
            </button>
          )
        })}
      </div>

      {tabs.map((t) =>
        t.id === active ? (
          <div
            key={t.id}
            role="tabpanel"
            id={`${base}-panel-${t.id}`}
            aria-labelledby={`${base}-tab-${t.id}`}
            tabIndex={0}
            className="pt-8 focus-visible:outline-none"
          >
            {t.content}
          </div>
        ) : null,
      )}
    </div>
  )
}
