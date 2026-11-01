import { useState, useMemo } from 'react'
import { Search, X } from 'lucide-react'
import { useI18n } from '../../i18n'
import { CROP_CONFIGS, CROP_DISPLAY_ORDER } from '../../lib/cropConfig'
import type { CropCategory } from '../../lib/cropConfig'
import type { CropKey } from '../../types'
import { Modal } from '../ui/Modal'
import { CropCard, AnyCropCard } from './CropCard'

/**
 * A modern, responsive modal showcasing realistic photographs of all 20 crops.
 * Farmers or owners can search or browse by category and tap to choose a crop.
 */
export function CropPickerModal({
  open,
  onClose,
  selected,
  onSelect,
  allowAny = false,
}: {
  open: boolean
  onClose: () => void
  selected: CropKey | '' | string
  /** Called with the chosen crop, or '' when "Any crop" is chosen. */
  onSelect: (crop: CropKey | '') => void
  allowAny?: boolean
}) {
  const { t } = useI18n()
  const [search, setSearch] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<CropCategory | 'all'>('all')

  const choose = (crop: CropKey | '') => {
    onSelect(crop)
    onClose()
  }

  const filteredCrops = useMemo(() => {
    const query = search.trim().toLowerCase()
    return CROP_DISPLAY_ORDER.filter((key) => {
      const config = CROP_CONFIGS[key]
      if (selectedCategory !== 'all' && config.category !== selectedCategory) {
        return false
      }
      if (!query) return true

      const localizedName = t(`crop.${key}`).toLowerCase()
      const englishName = config.englishName.toLowerCase()
      const keyStr = key.toLowerCase()

      return (
        localizedName.includes(query) ||
        englishName.includes(query) ||
        keyStr.includes(query)
      )
    })
  }, [search, selectedCategory, t])

  const categories: { id: CropCategory | 'all'; label: string }[] = [
    { id: 'all', label: 'All (20)' },
    { id: 'cereal', label: 'Cereals' },
    { id: 'millet', label: 'Millets' },
    { id: 'pulse', label: 'Pulses' },
    { id: 'oilseed', label: 'Oilseeds' },
    { id: 'cash_crop', label: 'Cash Crops' },
  ]

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('cropPicker.title')}
      description={t('cropPicker.hint')}
      size="lg"
    >
      <div className="space-y-4">
        {/* Search & Filter Bar */}
        <div className="space-y-2.5">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-ink-muted" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search crops (e.g. Wheat, Rice, Chana, Jowar)..."
              className="w-full rounded-xl border border-cream-300 bg-cream-50/50 py-2.5 pl-9 pr-8 text-sm font-medium text-ink placeholder:text-ink-muted/70 focus:border-leaf-600 focus:bg-white focus:outline-none focus:ring-1 focus:ring-leaf-600"
            />
            {search ? (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-ink-muted hover:text-ink"
                aria-label="Clear search"
              >
                <X className="size-3.5" />
              </button>
            ) : null}
          </div>

          {/* Category Chips */}
          <div className="flex gap-1.5 overflow-x-auto pb-1 text-xs no-scrollbar">
            {categories.map((cat) => {
              const active = selectedCategory === cat.id
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`shrink-0 rounded-full px-3 py-1 font-semibold transition-colors ${
                    active
                      ? 'bg-leaf-800 text-white shadow-xs'
                      : 'bg-cream-100 text-ink-soft hover:bg-cream-200'
                  }`}
                >
                  {cat.label}
                </button>
              )
            })}
          </div>
        </div>

        {/* Crops Grid */}
        <div className="grid max-h-[58vh] grid-cols-2 gap-2.5 overflow-y-auto p-1 pr-1.5 sm:grid-cols-3 md:grid-cols-4">
          {allowAny && selectedCategory === 'all' && !search ? (
            <AnyCropCard
              selected={selected === ''}
              onClick={() => choose('')}
              compact
            />
          ) : null}

          {filteredCrops.map((crop) => (
            <CropCard
              key={crop}
              crop={crop}
              selected={selected === crop}
              onClick={() => choose(crop)}
              compact
            />
          ))}

          {filteredCrops.length === 0 ? (
            <div className="col-span-full py-8 text-center">
              <p className="text-sm font-semibold text-ink-muted">
                No crops match &ldquo;{search}&rdquo;
              </p>
              <button
                type="button"
                onClick={() => {
                  setSearch('')
                  setSelectedCategory('all')
                }}
                className="mt-2 text-xs font-bold text-leaf-700 hover:underline"
              >
                Reset filters
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </Modal>
  )
}
