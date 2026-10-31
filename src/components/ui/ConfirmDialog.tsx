import type { ReactNode } from 'react'
import { useI18n } from '../../i18n'
import { Button } from './Button'
import { Modal } from './Modal'

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel,
  cancelLabel,
  danger = false,
  loading = false,
  children,
}: {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  description?: string
  confirmLabel?: string
  cancelLabel?: string
  danger?: boolean
  loading?: boolean
  children?: ReactNode
}) {
  const { t } = useI18n()

  return (
    <Modal
      open={open}
      onClose={loading ? () => undefined : onClose}
      title={title}
      description={description}
      size="sm"
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="outline" onClick={onClose} disabled={loading} fullWidth>
            {cancelLabel ?? t('common.cancel')}
          </Button>
          <Button
            variant={danger ? 'danger' : 'primary'}
            onClick={onConfirm}
            loading={loading}
            fullWidth
          >
            {confirmLabel ?? t('common.confirm')}
          </Button>
        </div>
      }
    >
      {children}
    </Modal>
  )
}
