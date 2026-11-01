import { useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import { Camera, Trash2 } from 'lucide-react'
import { useAuth } from '../../auth/AuthProvider'
import { useI18n } from '../../i18n'
import type { TranslationKey } from '../../i18n'
import { logError } from '../../lib/errors'
import { avatarUrl, forgetAvatar, removeAvatar, uploadAvatar } from '../../services/avatars'
import { Alert } from '../ui/Alert'
import { Avatar } from '../ui/Avatar'
import { Button } from '../ui/Button'
import { Card } from '../ui/Card'

/** Optional profile photo: take a picture or choose one, change it, or remove it. */
export function ProfilePhotoCard() {
  const { profile, refreshProfile } = useAuth()
  const { t } = useI18n()
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ key: TranslationKey; ok: boolean } | null>(null)

  if (!profile) return null
  const url = avatarUrl(profile.avatar_path)

  const onPick = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file || busy) return
    setBusy(true)
    setMessage(null)
    try {
      await uploadAvatar(file, profile.id, profile.avatar_path)
      forgetAvatar(profile.id)
      await refreshProfile()
      setMessage({ key: 'photo.saved', ok: true })
    } catch (caught) {
      logError('profile.uploadAvatar', caught)
      setMessage({ key: 'photo.error', ok: false })
    } finally {
      setBusy(false)
    }
  }

  const onRemove = async () => {
    if (busy) return
    setBusy(true)
    setMessage(null)
    try {
      await removeAvatar(profile.id, profile.avatar_path)
      forgetAvatar(profile.id)
      await refreshProfile()
      setMessage({ key: 'photo.removed', ok: true })
    } catch (caught) {
      logError('profile.removeAvatar', caught)
      setMessage({ key: 'photo.error', ok: false })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card className="mb-4 p-5 sm:p-6">
      <div className="flex items-center gap-4">
        <Avatar url={url} name={profile.full_name} size="xl" />
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-extrabold">{t('photo.title')}</h2>
          <p className="mt-0.5 text-sm text-ink-muted">{t('photo.subtitle')}</p>
        </div>
      </div>

      {message ? (
        <Alert variant={message.ok ? 'success' : 'error'} className="mt-4">
          {t(message.key)}
        </Alert>
      ) : null}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="sr-only"
        onChange={(event) => void onPick(event)}
        tabIndex={-1}
        aria-hidden="true"
      />
      <div className="mt-4 flex flex-wrap gap-2">
        <Button
          loading={busy}
          icon={<Camera className="size-4" aria-hidden="true" />}
          onClick={() => inputRef.current?.click()}
        >
          {url ? t('photo.change') : t('photo.choose')}
        </Button>
        {url ? (
          <Button
            variant="outline"
            disabled={busy}
            icon={<Trash2 className="size-4" aria-hidden="true" />}
            onClick={() => void onRemove()}
          >
            {t('photo.remove')}
          </Button>
        ) : null}
      </div>
    </Card>
  )
}
