import { useId, useState } from 'react'
import type { KeyboardEvent, Ref } from 'react'
import { Loader2, LocateFixed, MapPin } from 'lucide-react'
import { useI18n } from '../../i18n'
import { usePlaceSuggestions } from '../../hooks/usePlaceSuggestions'
import type { PlaceSuggestion } from '../../services/placeSearch'
import type { Coordinates } from '../../types'

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
  placeholder,
  inputRef,
}: PlaceAutocompleteProps) {
  const { t } = useI18n()
  const listId = useId()
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)

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
        className="h-13 w-full rounded-full border border-gray-200 bg-gray-50/80 px-6 pr-24 text-sm sm:text-base font-semibold text-gray-900 placeholder:text-gray-400 focus:bg-white focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 shadow-inner transition-all"
      />

      {loading ? (
        <Loader2
          className="pointer-events-none absolute right-16 top-1/2 size-4 -translate-y-1/2 animate-spin text-gray-400"
          aria-hidden="true"
        />
      ) : null}

      {isOpen ? (
        <ul
          id={listId}
          role="listbox"
          aria-label={t('ui.enterYourVillage')}
          className="absolute left-0 right-0 top-full z-30 mt-2 max-h-72 overflow-y-auto rounded-2xl border border-gray-200 bg-white p-1.5 shadow-xl"
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
                className={`flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 ${
                  selected ? 'bg-emerald-50' : 'hover:bg-emerald-50/60'
                }`}
              >
                {option.kind === 'locate' ? (
                  <>
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-800">
                      <LocateFixed className="size-4" aria-hidden="true" />
                    </span>
                    <span className="text-sm font-bold text-emerald-900">
                      {locating ? t('farmer.locationFinding') : t('farmer.useLocation')}
                    </span>
                  </>
                ) : (
                  <>
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-600">
                      <MapPin className="size-4" aria-hidden="true" />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-bold text-gray-900">
                        {option.place.name}
                      </span>
                      {option.place.detail ? (
                        <span className="block truncate text-xs text-gray-500">
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
