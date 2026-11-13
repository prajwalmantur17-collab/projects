import { useCallback, useEffect, useRef, useState } from 'react'
import type { KeyboardEvent, PointerEvent } from 'react'
import { useI18n } from '../../i18n'
import { Button } from '../ui/Button'

const VIEW = 300
const HIT_RADIUS = 40
const DOTS = [0, 1, 2, 3, 4, 5, 6, 7, 8]
const dotX = (index: number) => 50 + (index % 3) * 100
const dotY = (index: number) => 50 + Math.floor(index / 3) * 100

export type PatternPadStatus = 'idle' | 'error' | 'success'

interface PatternPadProps {
  /** Called with the dots the user connected (0 to 8, top-left to bottom-right). */
  onComplete: (pattern: number[]) => void
  disabled?: boolean
  status?: PatternPadStatus
}

/**
 * 3x3 pattern pad. Works with finger, mouse and keyboard
 * (Tab to a dot, press Enter or Space, then press Done).
 */
export function PatternPad({ onComplete, disabled = false, status = 'idle' }: PatternPadProps) {
  const { t } = useI18n()
  const boxRef = useRef<HTMLDivElement>(null)
  const pathRef = useRef<number[]>([])
  const drawingRef = useRef(false)
  const clearTimerRef = useRef<number | undefined>(undefined)
  const onCompleteRef = useRef(onComplete)
  const [path, setPath] = useState<number[]>([])
  const [finger, setFinger] = useState<{ x: number; y: number } | null>(null)
  const [usedKeyboard, setUsedKeyboard] = useState(false)

  useEffect(() => {
    onCompleteRef.current = onComplete
  })

  useEffect(() => () => window.clearTimeout(clearTimerRef.current), [])

  const commit = useCallback((next: number[]) => {
    pathRef.current = next
    setPath(next)
  }, [])

  const reset = useCallback(() => {
    drawingRef.current = false
    commit([])
    setFinger(null)
    setUsedKeyboard(false)
  }, [commit])

  const finish = useCallback(() => {
    drawingRef.current = false
    setFinger(null)
    const finished = pathRef.current
    if (finished.length === 0) return
    onCompleteRef.current([...finished])
    window.clearTimeout(clearTimerRef.current)
    clearTimerRef.current = window.setTimeout(reset, 500)
  }, [reset])

  const toPoint = (clientX: number, clientY: number) => {
    const rect = boxRef.current?.getBoundingClientRect()
    if (!rect || rect.width === 0 || rect.height === 0) return null
    return {
      x: ((clientX - rect.left) / rect.width) * VIEW,
      y: ((clientY - rect.top) / rect.height) * VIEW,
    }
  }

  const extend = (clientX: number, clientY: number) => {
    const point = toPoint(clientX, clientY)
    if (!point) return
    setFinger(point)
    const hit = DOTS.find(
      (dot) => Math.hypot(point.x - dotX(dot), point.y - dotY(dot)) <= HIT_RADIUS,
    )
    if (hit !== undefined && !pathRef.current.includes(hit)) {
      commit([...pathRef.current, hit])
    }
  }

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (disabled) return
    event.preventDefault()
    window.clearTimeout(clearTimerRef.current)
    commit([])
    setUsedKeyboard(false)
    drawingRef.current = true
    try {
      event.currentTarget.setPointerCapture(event.pointerId)
    } catch {
      // pointer capture is optional
    }
    extend(event.clientX, event.clientY)
  }

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!drawingRef.current) return
    extend(event.clientX, event.clientY)
  }

  const onPointerUp = () => {
    if (!drawingRef.current) return
    finish()
  }

  const onPointerCancel = () => {
    if (!drawingRef.current) return
    reset()
  }

  const onDotKeyDown = (event: KeyboardEvent<HTMLButtonElement>, dot: number) => {
    if (disabled || (event.key !== 'Enter' && event.key !== ' ')) return
    event.preventDefault()
    window.clearTimeout(clearTimerRef.current)
    setUsedKeyboard(true)
    if (!pathRef.current.includes(dot)) commit([...pathRef.current, dot])
  }

  const linePoints = [
    ...path.map((dot) => `${dotX(dot)},${dotY(dot)}`),
    ...(finger && path.length > 0 ? [`${finger.x},${finger.y}`] : []),
  ].join(' ')

  const lineColor = status === 'error' ? 'text-clay-600' : 'text-leaf-600'
  const dotActive =
    status === 'error' ? 'bg-clay-600' : status === 'success' ? 'bg-leaf-500' : 'bg-leaf-700'

  return (
    <div className="flex flex-col items-center gap-3">
      <div
        ref={boxRef}
        role="group"
        aria-label={t('pattern.padLabel')}
        className="relative aspect-square w-full max-w-[260px] touch-none select-none rounded-3xl border border-cream-200 bg-cream-50"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
      >
        <svg
          viewBox={`0 0 ${VIEW} ${VIEW}`}
          className={`pointer-events-none absolute inset-0 size-full ${lineColor}`}
          aria-hidden="true"
        >
          {path.length > 0 ? (
            <polyline
              points={linePoints}
              fill="none"
              stroke="currentColor"
              strokeWidth="10"
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity="0.65"
            />
          ) : null}
        </svg>
        <div className="absolute inset-0 grid grid-cols-3 grid-rows-3 place-items-center">
          {DOTS.map((dot) => {
            const active = path.includes(dot)
            return (
              <button
                key={dot}
                type="button"
                disabled={disabled}
                aria-label={t('pattern.dot', { n: dot + 1 })}
                aria-pressed={active}
                onKeyDown={(event) => onDotKeyDown(event, dot)}
                className="flex size-14 items-center justify-center rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-leaf-700"
              >
                <span
                  className={`rounded-full transition-all duration-150 ${
                    active ? `size-6 ${dotActive}` : 'size-4 bg-ink/30'
                  }`}
                />
              </button>
            )
          })}
        </div>
      </div>

      <p className="sr-only" aria-live="polite">
        {path.length > 0 ? t('pattern.dotsSelected', { count: path.length }) : ''}
      </p>

      {usedKeyboard && path.length > 0 ? (
        <div className="flex gap-2">
          <Button type="button" size="sm" onClick={finish}>
            {t('pattern.keyboardDone')}
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={reset}>
            {t('pattern.keyboardClear')}
          </Button>
        </div>
      ) : null}
    </div>
  )
}
