import { MessageCircle, Phone } from 'lucide-react'
import { useI18n } from '../../i18n'
import { telHref, whatsappHref } from '../../lib/validation'

export function ContactButtons({
  phone,
  audience,
  message,
}: {
  phone: string | null | undefined
  audience: 'owner' | 'farmer'
  message?: string
}) {
  const { t } = useI18n()

  if (!phone) {
    return <p className="text-sm text-ink-muted">{t('farmer.contactUnavailable')}</p>
  }

  const callLabel = audience === 'owner' ? t('farmer.callOwner') : t('owner.callFarmer')
  const whatsappLabel =
    audience === 'owner' ? t('farmer.whatsappOwner') : t('owner.whatsappFarmer')

  return (
    <div className="grid gap-2 sm:grid-cols-2">
      <a
        href={telHref(phone)}
        className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border-2 border-leaf-700 bg-white px-4 text-sm font-bold text-leaf-800 hover:bg-leaf-50"
      >
        <Phone className="size-4" aria-hidden="true" />
        {callLabel}
      </a>
      <a
        href={whatsappHref(phone, message)}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-leaf-700 px-4 text-sm font-bold text-cream-50 hover:bg-leaf-800"
      >
        <MessageCircle className="size-4" aria-hidden="true" />
        {whatsappLabel}
      </a>
    </div>
  )
}
