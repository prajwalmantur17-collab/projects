import { useEffect, useRef } from 'react'
import {
  HelpCircle,
  MessageCircle,
  Phone,
  ShieldCheck,
  Tractor,
  X,
  Zap,
} from 'lucide-react'
import { useI18n } from '../../i18n'
import { useSidebar } from './SidebarContext'

export function HelpSupportModal() {
  const { helpModalOpen, setHelpModalOpen } = useSidebar()
  const { t } = useI18n()
  const modalRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!helpModalOpen) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setHelpModalOpen(false)
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [helpModalOpen, setHelpModalOpen])

  if (!helpModalOpen) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="help-support-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs"
      onClick={(e) => {
        if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
          setHelpModalOpen(false)
        }
      }}
    >
      <div
        ref={modalRef}
        className="relative w-full max-w-lg rounded-2xl border border-cream-200 bg-white p-6 shadow-lift sm:p-7 max-h-[90vh] overflow-y-auto"
      >
        <button
          type="button"
          onClick={() => setHelpModalOpen(false)}
          className="absolute right-4 top-4 rounded-xl p-2 text-ink-muted transition-colors hover:bg-cream-100 hover:text-ink"
          aria-label={t('common.close')}
        >
          <X className="size-5" />
        </button>

        <div className="flex items-center gap-3 border-b border-cream-200 pb-4">
          <div className="flex size-11 items-center justify-center rounded-xl bg-leaf-100 text-leaf-800">
            <HelpCircle className="size-6" aria-hidden="true" />
          </div>
          <div>
            <h2 id="help-support-title" className="text-xl font-extrabold text-ink">
              {t('ui.helpSupport')}
            </h2>
            <p className="text-sm text-ink-muted">{t('ui.supportSubtitle')}</p>
          </div>
        </div>

        <div className="mt-5 space-y-4">
          {/* Kisan Call Centre Toll-Free */}
          <div className="rounded-xl border border-leaf-200 bg-leaf-50/70 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-bold text-leaf-950">{t('ui.kisanHelpline')}</p>
                <p className="mt-0.5 text-xs text-leaf-800">6:00 AM - 10:00 PM · All Regional Languages</p>
                <p className="mt-2 text-lg font-extrabold text-leaf-900">1800-180-1551</p>
              </div>
              <a
                href="tel:18001801551"
                className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl bg-leaf-700 px-3.5 py-2 text-sm font-bold text-white shadow-soft transition-colors hover:bg-leaf-800"
              >
                <Phone className="size-4" aria-hidden="true" />
                <span>Call Free</span>
              </a>
            </div>
          </div>

          {/* WhatsApp Direct Helpdesk */}
          <div className="rounded-xl border border-cream-200 bg-cream-50/70 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-bold text-ink">{t('ui.whatsappSupport')}</p>
                <p className="mt-0.5 text-xs text-ink-muted">Quick machine booking & verified owner assistance</p>
                <p className="mt-1 text-sm font-semibold text-leaf-800">+91 98765 43210</p>
              </div>
              <a
                href="https://wa.me/919876543210?text=Namaste,%20I%20need%20help%20with%20Harvest%20Rentals"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl border border-cream-300 bg-white px-3.5 py-2 text-sm font-bold text-leaf-900 shadow-2xs transition-colors hover:bg-cream-100"
              >
                <MessageCircle className="size-4 text-leaf-700" aria-hidden="true" />
                <span>WhatsApp</span>
              </a>
            </div>
          </div>

          {/* Quick FAQ Highlights */}
          <div className="space-y-2 pt-2">
            <h3 className="text-sm font-bold uppercase tracking-wider text-ink-muted">
              Frequently Asked Questions
            </h3>
            <div className="space-y-2">
              <div className="flex items-start gap-2.5 rounded-xl border border-cream-200 p-3 text-sm">
                <ShieldCheck className="size-5 shrink-0 text-leaf-600 mt-0.5" />
                <div>
                  <p className="font-bold text-ink">Zero Commission Guarantee</p>
                  <p className="text-xs text-ink-muted mt-0.5">
                    Harvest Rentals is 100% free for farmers. You negotiate and pay directly to the machine owner.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-2.5 rounded-xl border border-cream-200 p-3 text-sm">
                <Zap className="size-5 shrink-0 text-harvest-600 mt-0.5" />
                <div>
                  <p className="font-bold text-ink">Operator & Diesel Included</p>
                  <p className="text-xs text-ink-muted mt-0.5">
                    All machine rental rates include an experienced operator and diesel fuel.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-2.5 rounded-xl border border-cream-200 p-3 text-sm">
                <Tractor className="size-5 shrink-0 text-leaf-700 mt-0.5" />
                <div>
                  <p className="font-bold text-ink">Machine Breakdown Support</p>
                  <p className="text-xs text-ink-muted mt-0.5">
                    If a machine breaks down during harvesting, use the app to instantly locate another harvester nearby.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <button
            type="button"
            onClick={() => setHelpModalOpen(false)}
            className="rounded-xl border border-cream-300 bg-cream-50 px-4 py-2 text-sm font-bold text-ink hover:bg-cream-100"
          >
            {t('common.close')}
          </button>
        </div>
      </div>
    </div>
  )
}
