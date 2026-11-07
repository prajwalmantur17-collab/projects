import { useEffect, useId, useRef, useState } from 'react'
import type { KeyboardEvent, Ref } from 'react'
import { Loader2, LocateFixed, MapPin, Mic, MicOff } from 'lucide-react'
import { useI18n } from '../../i18n'
import { usePlaceSuggestions } from '../../hooks/usePlaceSuggestions'
import type { PlaceSuggestion } from '../../services/placeSearch'
import type { Coordinates } from '../../types'
import { isListeningSupported, listenOnce } from '../../lib/speech'
import type { ListenHandle } from '../../lib/speech'
import { parseSpokenQuery } from '../../lib/voice'

/** Turns "hubballi" or "near Hubballi" into a clean place name. */
function cleanSpoken(text: string): string {
  return (parseSpokenQuery(text).village ?? text).trim()
}

interface PlaceAutocompleteProps {
  value: string
  onChange: (value: string) => void
  /** Called when the person picks a place from the list. */
  onSelect: (place: PlaceSuggestion) => void
  /** Called when the person taps "Use my location" in the list. */
  onUseCurrentLocation: () => void
  locating?: boolean
  /** Rank suggestions closest to this point first (GPS or the last picked place). */
  nearTo?: Coordinates | null
  /** Called with the best guesses (best first) after the person speaks a place name. */
  onVoiceResult?: (guesses: string[]) => void
  placeholder?: string
  inputRef?: Ref<HTMLInputElement>
}

type Option = { kind: 'locate' } | { kind: 'place'; place: PlaceSuggestion }

/**
 * A place search box like Uber or Rapido: as you type it lists matching
 * villages, towns and city areas, and you tap the right one instead of the
 * app guessing from the raw text.
 */
export function PlaceAutocomplete({
  value,
  onChange,
  onSelect,
  onUseCurrentLocation,
  locating = false,
  nearTo,
  onVoiceResult,
  placeholder,
  inputRef,
}: PlaceAutocompleteProps) {
  const { t, language } = useI18n()
  const listId = useId()
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const [listening, setListening] = useState(false)
  const [voiceError, setVoiceError] = useState(false)
  const listenRef = useRef<ListenHandle | null>(null)
  const voiceSupported = Boolean(onVoiceResult) && isListeningSupported()

  // Stop the microphone if the box disappears while listening.
  useEffect(() => () => listenRef.current?.cancel(), [])

  const toggleVoice = async () => {
    if (listening) {
      listenRef.current?.cancel()
      return
    }
    setVoiceError(false)
    setOpen(false)
    const handle = listenOnce(language, (interim) => onChange(cleanSpoken(interim)))
    listenRef.current = handle
    setListening(true)
    const result = await handle.result
    listenRef.current = null
    setListening(false)
    if (result.ok) {
      const guesses = [...new Set(result.alternatives.map(cleanSpoken).filter(Boolean))]
      if (guesses.length > 0) {
        onChange(guesses[0])
        onVoiceResult?.(guesses)
      }
    } else if (result.error !== 'no-speech' && result.error !== 'aborted') {
      setVoiceError(true)
    }
  }

  const { suggestions, loading } = usePlaceSuggestions(value, open, nearTo)

  const showLocate = value.trim().length === 0
  const options: Option[] = [
    ...(showLocate ? [{ kind: 'locate' } as Option] : []),
    ...suggestions.map((place) => ({ kind: 'place', place }) as Option),
  ]
  const isOpen = open && options.length > 0
  const active = Math.min(activeIndex, options.length - 1)

  const choose = (option: Option) => {
    setOpen(false)
    setActiveIndex(-1)
    if (option.kind === 'locate') onUseCurrentLocation()
    else onSelect(option.place)
  }

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      if (options.length === 0) return
      event.preventDefault()
      setOpen(true)
      const step = event.key === 'ArrowDown' ? 1 : -1
      setActiveIndex((current) => (current + step + options.length) % options.length)
      return
    }

    if (event.key === 'Escape') {
      setOpen(false)
      return
    }

    if (event.key === 'Enter' && isOpen) {
      // Enter picks the highlighted row, or the best match if the person typed something.
      const target = active >= 0 ? options[active] : showLocate ? undefined : options[0]
      if (target) {
        event.preventDefault()
        choose(target)
      }
    }
  }

  return (
    <div
      className="relative"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false)
      }}
    >
      <input
        ref={inputRef}
        type="text"
        role="combobox"
        aria-expanded={isOpen}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={isOpen && active >= 0 ? `${listId}-${active}` : undefined}
        autoComplete="off"
        value={value}
        onChange={(event) => {
          onChange(event.target.value)
          setOpen(true)
          setActiveIndex(-1)
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        className="h-13 w-full rounded-full border border-cream-300 bg-cream-50/80 px-6 pr-28 text-sm sm:text-base font-semibold text-ink placeholder:text-ink-muted focus:bg-white focus:border-leaf-700 focus:outline-none focus:ring-2 focus:ring-leaf-700/15 shadow-inner transition-all"
      />

      {loading ? (
        <Loader2
          className="pointer-events-none absolute right-[6.5rem] top-1/2 size-4 -translate-y-1/2 animate-spin text-ink-muted"
          aria-hidden="true"
        />
      ) : null}

      {voiceSupported ? (
        <button
          type="button"
          onClick={() => void toggleVoice()}
          className={`absolute right-14 top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-full transition-all active:scale-95 sm:size-10 ${
            listening
              ? 'animate-pulse bg-red-600 text-white ring-4 ring-red-200'
              : 'bg-leaf-100 text-leaf-800 hover:bg-leaf-200'
          }`}
          title={listening ? t('voice.listening') : t('voice.tapToSpeak')}
          aria-label={listening ? t('voice.listening') : t('voice.tapToSpeak')}
        >
          {listening ? (
            <MicOff className="size-4.5" aria-hidden="true" />
          ) : (
            <Mic className="size-4.5" aria-hidden="true" />
          )}
        </button>
      ) : null}

      {voiceError ? (
        <p className="absolute left-4 top-full mt-1 text-xs font-medium text-red-600" role="alert">
          {t('voice.notSupported')}
        </p>
      ) : null}

      {isOpen ? (
        <ul
          id={listId}
          role="listbox"
          aria-label={t('ui.enterYourVillage')}
          className="absolute left-0 right-0 top-full z-30 mt-2 max-h-72 overflow-y-auto rounded-2xl border border-cream-200 bg-white/98 backdrop-blur-xl p-1.5 shadow-lift"
        >
          {options.map((option, index) => {
            const selected = index === active
            return (
              <li
                key={option.kind === 'locate' ? 'locate' : option.place.id}
                id={`${listId}-${index}`}
                role="option"
                aria-selected={selected}
                // Keep focus in the input so the list does not close before the click lands.
                onMouseDown={(event) => event.preventDefault()}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => choose(option)}
                className={`flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 transition-colors ${
                  selected ? 'bg-leaf-50 text-leaf-900' : 'hover:bg-cream-100/70'
                }`}
              >
                {option.kind === 'locate' ? (
                  <>
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-leaf-100 text-leaf-800">
                      <LocateFixed className="size-4" aria-hidden="true" />
                    </span>
                    <span className="text-sm font-bold text-leaf-900">
                      {locating ? t('farmer.locationFinding') : t('farmer.useLocation')}
                    </span>
                  </>
                ) : (
                  <>
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-cream-100 text-leaf-700">
                      <MapPin className="size-4" aria-hidden="true" />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-bold text-ink">
                        {option.place.name}
                      </span>
                      {option.place.detail ? (
                        <span className="block truncate text-xs text-ink-muted">
                          {option.place.detail}
                        </span>
                      ) : null}
                    </span>
                  </>
                )}
              </li>
            )
          })}
        </ul>
      ) : null}
    </div>
  )
}
