import { MessageCircle, Phone } from 'lucide-react'
import { useI18n } from '../../i18n'
import { telHref, whatsappHref } from '../../lib/validation'

/** Call and WhatsApp buttons for a driver. Shows a note when the number is still hidden. */
export function DriverContact({
  phone,
  message,
  callLabel,
  whatsappLabel,
  hiddenNote = true,
}: {
  phone: string | null | undefined
  message?: string
  callLabel?: string
  whatsappLabel?: string
  hiddenNote?: boolean
}) {
  const { t } = useI18n()

  if (!phone) {
    return hiddenNote ? (
      <p className="text-sm text-ink-muted">{t('drivers.card.phoneLater')}</p>
    ) : null
  }

  return (
    <div className="grid gap-2 sm:grid-cols-2">
      <a
        href={telHref(phone)}
        className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border-2 border-leaf-700 bg-white px-4 text-sm font-bold text-leaf-800 hover:bg-leaf-50"
      >
        <Phone className="size-4" aria-hidden="true" />
        {callLabel ?? t('drivers.card.call')}
      </a>
      <a
        href={whatsappHref(phone, message)}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-leaf-700 px-4 text-sm font-bold text-cream-50 hover:bg-leaf-800"
      >
        <MessageCircle className="size-4" aria-hidden="true" />
        {whatsappLabel ?? t('drivers.card.whatsapp')}
      </a>
    </div>
  )
}
