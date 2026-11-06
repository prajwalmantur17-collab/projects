import { useCallback, useMemo, useState } from 'react'
import { Plus, Tractor, Trash2 } from 'lucide-react'
import { useAuth } from '../../auth/AuthProvider'
import { useI18n } from '../../i18n'
import type { TranslationKey } from '../../i18n'
import { logError, mapErrorToKey } from '../../lib/errors'
import { formatPrice } from '../../lib/format'
import { machineTypeLabelKey } from '../../lib/labels'
import { useAsync } from '../../hooks/useAsync'
import {
  deleteMachine,
  getDeletedMachineIds,
  isMachineDeleted,
  listOwnerMachines,
  setMachineActive,
} from '../../services/machines'
import type { MachineCard } from '../../types'
import { BookingMachineThumb } from '../../components/booking/BookingMachineThumb'
import { Alert } from '../../components/ui/Alert'
import { Button, LinkButton } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { EmptyState, Spinner } from '../../components/ui/Feedback'
import { PageHeader } from '../../components/ui/PageHeader'

export function OwnerMachinesPage() {
  const { profile } = useAuth()
  const { t } = useI18n()
  const ownerId = profile?.id

  const [busyId, setBusyId] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<MachineCard | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [success, setSuccess] = useState<TranslationKey | null>(null)
  const [actionError, setActionError] = useState<TranslationKey | null>(null)

  const loader = useCallback(async () => {
    if (!ownerId) return [] as MachineCard[]
    return listOwnerMachines(ownerId)
  }, [ownerId])

  const { data, loading, error, reload } = useAsync(loader, {
    enabled: Boolean(ownerId),
    fallback: 'owner.machinesError',
  })

  const [deletedIds, setDeletedIds] = useState<Set<string>>(() => getDeletedMachineIds())

  const machines = useMemo(() => {
    return (data ?? []).filter((m) => !deletedIds.has(m.id) && !isMachineDeleted(m.id))
  }, [data, deletedIds])

  const toggle = async (machine: MachineCard) => {
    if (busyId) return
    setBusyId(machine.id)
    setActionError(null)
    setSuccess(null)
    try {
      await setMachineActive(machine.id, !machine.is_active)
      setSuccess(machine.is_active ? 'owner.pausedSuccess' : 'owner.reactivatedSuccess')
      reload()
    } catch (caught) {
      logError('owner.toggleMachine', caught)
      setActionError(mapErrorToKey(caught, 'owner.toggleError'))
    } finally {
      setBusyId(null)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    const idToDelete = deleteTarget.id
    setDeleting(true)
    setActionError(null)
    setSuccess(null)
    try {
      // 1. Perform deletion on backend first
      await deleteMachine(idToDelete, ownerId)

      // 2. Server confirmed deletion: update local state & show success
      setDeletedIds((prev) => new Set([...prev, idToDelete]))
      setDeleteTarget(null)
      setSuccess('owner.deleteSuccess')
      reload()
    } catch (caught) {
      logError('owner.deleteMachine', caught)
      setActionError(mapErrorToKey(caught, 'owner.deleteError'))
      // Keep deleteTarget open so owner can retry, do not pretend deletion succeeded
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div>
      <PageHeader
        title={t('owner.myMachinesTitle')}
        description={t('owner.myMachinesSubtitle')}
        action={
          <LinkButton
            to="/owner/machines/new"
            variant="primary"
            icon={<Plus className="size-4" aria-hidden="true" />}
          >
            {t('owner.addMachine')}
          </LinkButton>
        }
      />

      {success ? (
        <Alert variant="success" className="mb-4">
          {t(success)}
        </Alert>
      ) : null}
      {actionError ? (
        <Alert variant="error" className="mb-4">
          {t(actionError)}
        </Alert>
      ) : null}

      {loading ? (
        <div className="flex items-center justify-center gap-2 rounded-card border border-cream-200 bg-white py-16">
          <Spinner className="size-5" />
          <span className="text-sm font-medium text-ink-muted">{t('common.loading')}</span>
        </div>
      ) : error ? (
        <Alert variant="error">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span>{t(error)}</span>
            <Button size="sm" variant="outline" onClick={reload}>
              {t('common.retry')}
            </Button>
          </div>
        </Alert>
      ) : machines.length === 0 ? (
        <EmptyState
          icon={Tractor}
          title={t('owner.noMachinesTitle')}
          description={t('owner.noMachinesBody')}
          action={
            <LinkButton
              to="/owner/machines/new"
              variant="primary"
              icon={<Plus className="size-4" aria-hidden="true" />}
            >
              {t('owner.addMachine')}
            </LinkButton>
          }
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {machines.map((machine) => {
            const typeLabel = t(machineTypeLabelKey(machine.machine_type))
            const busy = busyId === machine.id
            const unitLabel =
              machine.pricing_unit === 'per_hour'
                ? t('common.perHour')
                : machine.pricing_unit === 'per_day'
                ? t('common.perDay')
                : t('common.perAcre')
            return (
              <Card key={machine.id} as="article" className="flex flex-col p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 gap-3">
                    <BookingMachineThumb
                      imagePath={machine.image_path}
                      typeLabel={typeLabel}
                    />
                    <div className="min-w-0">
                      <h2 className="truncate text-lg font-bold">{typeLabel}</h2>
                      <p className="truncate text-sm text-ink-muted">
                        {machine.model ?? t('farmer.noModel')}
                      </p>
                      <p className="mt-1 text-sm">
                        <span className="font-bold text-leaf-800">
                          {formatPrice(machine.price_per_acre)}
                        </span>{' '}
                        <span className="text-ink-muted">{unitLabel}</span>
                      </p>
                    </div>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-bold ${
                      machine.is_active
                        ? 'bg-leaf-50 text-leaf-800'
                        : 'bg-clay-50 text-clay-800'
                    }`}
                  >
                    {machine.is_active ? t('owner.activeLabel') : t('owner.pausedLabel')}
                  </span>
                </div>

                <div className="mt-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
                    {t('farmer.serviceAreas')}
                  </p>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {(Array.isArray(machine.service_villages) ? machine.service_villages : []).map((village) => (
                      <span
                        key={village}
                        className="rounded-full bg-cream-100 px-2.5 py-0.5 text-xs text-ink-soft"
                      >
                        {village}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="mt-auto flex flex-wrap gap-2 pt-4">
                  <LinkButton
                    to={`/owner/machines/${machine.id}/edit`}
                    size="sm"
                    variant="outline"
                  >
                    {t('common.edit')}
                  </LinkButton>
                  <LinkButton
                    to={`/owner/machines/${machine.id}/availability`}
                    size="sm"
                    variant="ghost"
                  >
                    {t('owner.manageAvailability')}
                  </LinkButton>
                  <Button
                    size="sm"
                    variant="ghost"
                    className={machine.is_active ? 'text-clay-800' : 'text-leaf-800'}
                    loading={busy}
                    disabled={busyId !== null || deleting}
                    onClick={() => void toggle(machine)}
                  >
                    {machine.is_active ? t('owner.pause') : t('owner.reactivate')}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-clay-700 hover:bg-clay-50 hover:text-clay-900"
                    icon={<Trash2 className="size-4" aria-hidden="true" />}
                    disabled={busyId !== null || deleting}
                    onClick={() => setDeleteTarget(machine)}
                  >
                    {t('owner.deleteMachine')}
                  </Button>
                </div>
              </Card>
            )
          })}
        </div>
      )}

      <ConfirmDialog
        open={deleteTarget !== null}
        onClose={() => (deleting ? undefined : setDeleteTarget(null))}
        onConfirm={() => void handleDelete()}
        title={t('owner.deleteConfirmTitle')}
        description={t('owner.deleteConfirmBody')}
        confirmLabel={t('owner.deleteMachine')}
        cancelLabel={t('common.cancel')}
        danger
        loading={deleting}
      />
    </div>
  )
}
