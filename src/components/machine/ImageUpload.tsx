import { useEffect, useRef, useState } from 'react'
import { ImagePlus, Trash2 } from 'lucide-react'
import { useI18n } from '../../i18n'
import type { TranslationKey } from '../../i18n'
import { validateImageFile } from '../../lib/validation'
import { getMachineImageUrl } from '../../services/machines'
import { Alert } from '../ui/Alert'
import { Button } from '../ui/Button'

export function ImageUpload({
  initialPath,
  selectedFile,
  removed,
  onSelect,
  onRemove,
  disabled = false,
}: {
  initialPath: string | null
  selectedFile: File | null
  removed: boolean
  onSelect: (file: File | null) => void
  onRemove: () => void
  disabled?: boolean
}) {
  const { t } = useI18n()
  const inputRef = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<TranslationKey | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!selectedFile) {
      setPreviewUrl(null)
      return
    }
    const url = URL.createObjectURL(selectedFile)
    setPreviewUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [selectedFile])

  const initialUrl = removed ? null : getMachineImageUrl(initialPath)
  const shownUrl = previewUrl ?? initialUrl
  const hasPhoto = Boolean(shownUrl)

  const handleFile = (file: File | undefined) => {
    if (!file) return
    const validationError = validateImageFile(file)
    if (validationError) {
      setError(validationError)
      if (inputRef.current) inputRef.current.value = ''
      return
    }
    setError(null)
    onSelect(file)
  }

  return (
    <div>
      <p className="text-sm font-semibold text-ink">{t('machine.photoLabel')}</p>
      <p className="mt-0.5 text-xs text-ink-muted">{t('machine.photoHint')}</p>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        disabled={disabled}
        onChange={(event) => handleFile(event.target.files?.[0])}
      />

      {hasPhoto ? (
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <img
            src={shownUrl ?? ''}
            alt={t('machine.photoLabel')}
            className="size-24 rounded-xl border border-cream-200 object-cover"
          />
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={disabled}
              onClick={() => inputRef.current?.click()}
            >
              {t('machine.photoReplace')}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-clay-800"
              disabled={disabled}
              onClick={() => {
                if (inputRef.current) inputRef.current.value = ''
                setError(null)
                onRemove()
              }}
            >
              <Trash2 className="size-4" aria-hidden="true" />
              {t('machine.photoRemove')}
            </Button>
          </div>
        </div>
      ) : (
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <span className="flex size-24 items-center justify-center rounded-xl border-2 border-dashed border-cream-300 bg-cream-50 text-ink-muted">
            <ImagePlus className="size-7" aria-hidden="true" />
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={disabled}
            onClick={() => inputRef.current?.click()}
          >
            {t('machine.photoChoose')}
          </Button>
        </div>
      )}

      {error ? (
        <Alert variant="error" className="mt-3">
          {t(error)}
        </Alert>
      ) : null}
      <p className="mt-2 text-xs text-ink-muted">{t('machine.photoOptionalNote')}</p>
    </div>
  )
}
