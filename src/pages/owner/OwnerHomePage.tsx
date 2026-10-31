import { useCallback, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { CalendarClock, ChevronRight, Inbox, Plus, Tractor, Trash2 } from 'lucide-react'
import { useAuth } from '../../auth/AuthProvider'
import { useI18n } from '../../i18n'
import type { TranslationKey } from '../../i18n'
import { logError, mapErrorToKey } from '../../lib/errors'
import { formatDate, formatPrice } from '../../lib/format'
import { machineTypeLabelKey } from '../../lib/labels'
import { useAsync } from '../../hooks/useAsync'
import { getOwnerBookings } from '../../services/bookings'
import {
  deleteMachine,
  getDeletedMachineIds,
  isMachineDeleted,
  listOwnerMachines,
  setMachineActive,
} from '../../services/machines'
import type { MachineCard } from '../../types'
import { FarmIllustration } from '../../components/brand/FarmIllustration'
import { BookingMachineThumb } from '../../components/booking/BookingMachineThumb'
import { Alert } from '../../components/ui/Alert'
import { Button, LinkButton } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { Spinner } from '../../components/ui/Feedback'
import { PageHeader } from '../../components/ui/PageHeader'

export function OwnerHomePage() {
  const { profile } = useAuth()
  const { t, language } = useI18n()
  const ownerId = profile?.id

  const [busyMachineId, setBusyMachineId] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<MachineCard | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [success, setSuccess] = useState<TranslationKey | null>(null)
  const [actionError, setActionError] = useState<TranslationKey | null>(null)

  const machinesLoader = useCallback(async () => {
    if (!ownerId) return [] as MachineCard[]
    return listOwnerMachines(ownerId)
  }, [ownerId])

  const requestsLoader = useCallback(async () => {
    if (!ownerId) return []
    return getOwnerBookings(ownerId)
  }, [ownerId])

  const machines = useAsync(machinesLoader, {
    enabled: Boolean(ownerId),
    fallback: 'owner.machinesError',
  })
  const requests = useAsync(requestsLoader, {
    enabled: Boolean(ownerId),
    fallback: 'owner.requestsError',
  })

  const [deletedIds, setDeletedIds] = useState<Set<string>>(() => getDeletedMachineIds())

  const machineList = useMemo(() => {
    return (machines.data ?? []).filter((m) => !deletedIds.has(m.id) && !isMachineDeleted(m.id))
  }, [machines.data, deletedIds])

  const pending = (requests.data ?? []).filter((booking) => booking.status === 'pending')

  const toggleMachine = async (machine: MachineCard) => {
    if (busyMachineId) return
    setBusyMachineId(machine.id)
    setActionError(null)
    setSuccess(null)
    try {
      await setMachineActive(machine.id, !machine.is_active)
      setSuccess(machine.is_active ? 'owner.pausedSuccess' : 'owner.reactivatedSuccess')
      machines.reload()
    } catch (caught) {
      logError('owner.toggleMachine', caught)
      setActionError(mapErrorToKey(caught, 'owner.toggleError'))
    } finally {
      setBusyMachineId(null)
    }
  }

  const handleDeleteMachine = async () => {
    if (!deleteTarget) return
    const idToDelete = deleteTarget.id
    setDeleting(true)
    setActionError(null)
    setSuccess(null)
    try {
      // 1. Immediately remove from local state so it vanishes from the UI without any delay!
      setDeletedIds((prev) => new Set([...prev, idToDelete]))
      setDeleteTarget(null)

      // 2. Perform deletion in store & backend
      await deleteMachine(idToDelete, ownerId)
      setSuccess('owner.deleteSuccess')
      machines.reload()
    } catch (caught) {
      logError('owner.deleteMachine', caught)
      setActionError(mapErrorToKey(caught, 'owner.deleteError'))
    } finally {
      setDeleting(false)
    }
  }

  const name = profile?.full_name?.trim() || t('owner.fallbackName')

  return (
    <div>
      <PageHeader
        title={t('owner.greeting', { name })}
        description={t('owner.subtitle')}
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

      <div className="grid gap-3 sm:grid-cols-2">
        <Link
          to="/owner/bookings"
          className="group flex items-center gap-4 rounded-card border border-cream-200 bg-white p-4 shadow-soft transition-colors hover:border-leaf-300"
        >
          <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-harvest-100 text-harvest-800">
            <Inbox className="size-6" aria-hidden="true" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold text-ink-muted">
              {t('owner.requestsTitle')}
            </span>
            <span className="mt-0.5 block text-2xl font-extrabold">
              {requests.loading ? '…' : requests.error ? '—' : pending.length}
            </span>
            <span className="block truncate text-xs text-ink-muted">
              {requests.error
                ? t('common.unknown')
                : pending.length > 0
                  ? t('owner.pendingCount', { count: pending.length })
                  : t('owner.noPending')}
            </span>
          </span>
          <ChevronRight className="size-5 text-ink-muted" aria-hidden="true" />
        </Link>

        <Link
          to="/owner/machines"
          className="group flex items-center gap-4 rounded-card border border-cream-200 bg-white p-4 shadow-soft transition-colors hover:border-leaf-300"
        >
          <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-leaf-100 text-leaf-800">
            <Tractor className="size-6" aria-hidden="true" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold text-ink-muted">
              {t('owner.myMachinesTitle')}
            </span>
            <span className="mt-0.5 block text-2xl font-extrabold">
              {machines.loading ? '…' : machines.error ? '—' : machineList.length}
            </span>
            <span className="block truncate text-xs text-ink-muted">
              {t('owner.myMachinesSubtitle')}
            </span>
          </span>
          <ChevronRight className="size-5 text-ink-muted" aria-hidden="true" />
        </Link>
      </div>

      {requests.error ? (
        <Alert variant="error" className="mt-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span>{t(requests.error)}</span>
            <Button size="sm" variant="outline" onClick={requests.reload}>
              {t('common.retry')}
            </Button>
          </div>
        </Alert>
      ) : null}

      <section className="mt-8" aria-labelledby="owner-machines-heading">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 id="owner-machines-heading" className="text-xl font-extrabold">
            {t('owner.myMachinesTitle')}
          </h2>
          {machineList.length > 0 ? (
            <Link to="/owner/machines" className="text-sm font-bold text-leaf-700 hover:underline">
              {t('common.view')}
            </Link>
          ) : null}
        </div>

        {machines.loading ? (
          <div className="flex items-center justify-center gap-2 rounded-card border border-cream-200 bg-white py-12">
            <Spinner className="size-5" />
            <span className="text-sm text-ink-muted">{t('common.loading')}</span>
          </div>
        ) : machines.error ? (
          <Alert variant="error">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span>{t(machines.error)}</span>
              <Button size="sm" variant="outline" onClick={machines.reload}>
                {t('common.retry')}
              </Button>
            </div>
          </Alert>
        ) : machineList.length === 0 ? (
          <Card className="overflow-hidden">
            <div className="grid items-center gap-4 p-5 sm:grid-cols-[1fr_auto] sm:p-6">
              <div>
                <FarmIllustration className="mb-3 h-20 w-auto" />
                <h3 className="text-lg font-bold">{t('owner.noMachinesTitle')}</h3>
                <p className="mt-1 text-sm leading-relaxed text-ink-muted">
                  {t('owner.noMachinesBody')}
                </p>
                <LinkButton
                  to="/owner/machines/new"
                  variant="primary"
                  className="mt-4"
                  icon={<Plus className="size-4" aria-hidden="true" />}
                >
                  {t('owner.addMachine')}
                </LinkButton>
              </div>
            </div>
          </Card>
        ) : (
          <div className="space-y-3">
            {machineList.slice(0, 4).map((machine) => {
              const typeLabel = t(machineTypeLabelKey(machine.machine_type))
              const busy = busyMachineId === machine.id
              const unitLabel =
                machine.pricing_unit === 'per_hour'
                  ? t('common.perHour')
                  : machine.pricing_unit === 'per_day'
                  ? t('common.perDay')
                  : t('common.perAcre')
              return (
                <Card key={machine.id} as="article" className="p-4">
                  <div className="flex gap-3">
                    <BookingMachineThumb imagePath={machine.image_path} typeLabel={typeLabel} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0">
                          <h3 className="truncate text-base font-bold">{typeLabel}</h3>
                          <p className="truncate text-sm text-ink-muted">
                            {machine.model ?? t('farmer.noModel')}
                          </p>
                        </div>
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
                            machine.is_active
                              ? 'bg-leaf-50 text-leaf-800'
                              : 'bg-clay-50 text-clay-800'
                          }`}
                        >
                          {machine.is_active ? t('owner.activeLabel') : t('owner.pausedLabel')}
                        </span>
                      </div>
                      <p className="mt-1.5 text-sm">
                        <span className="font-bold text-leaf-800">
                          {formatPrice(machine.price_per_acre)}
                        </span>{' '}
                        <span className="text-ink-muted">{unitLabel}</span>
                      </p>
                      <p className="mt-0.5 truncate text-xs text-ink-muted">
                        {machine.service_villages.join(', ')}
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
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
                          disabled={busyMachineId !== null || deleting}
                          onClick={() => void toggleMachine(machine)}
                        >
                          {machine.is_active ? t('owner.pause') : t('owner.reactivate')}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-clay-700 hover:bg-clay-50 hover:text-clay-900"
                          icon={<Trash2 className="size-4" aria-hidden="true" />}
                          disabled={busyMachineId !== null || deleting}
                          onClick={() => setDeleteTarget(machine)}
                        >
                          {t('owner.deleteMachine')}
                        </Button>
                      </div>
                    </div>
                  </div>
                </Card>
              )
            })}
            {machineList.length > 4 ? (
              <LinkButton to="/owner/machines" variant="outline" fullWidth>
                {t('owner.myMachinesCount', { count: machineList.length })}
              </LinkButton>
            ) : null}
          </div>
        )}
      </section>

      <section className="mt-8" aria-labelledby="owner-requests-heading">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 id="owner-requests-heading" className="text-xl font-extrabold">
            {t('owner.recentRequests')}
          </h2>
          <Link to="/owner/bookings" className="text-sm font-bold text-leaf-700 hover:underline">
            {t('owner.viewAllRequests')}
          </Link>
        </div>

        {requests.loading ? (
          <div className="flex items-center justify-center gap-2 rounded-card border border-cream-200 bg-white py-10">
            <Spinner className="size-5" />
            <span className="text-sm text-ink-muted">{t('common.loading')}</span>
          </div>
        ) : pending.length === 0 ? (
          <Card className="flex items-start gap-3 p-5">
            <CalendarClock className="mt-0.5 size-5 shrink-0 text-leaf-600" aria-hidden="true" />
            <div>
              <p className="font-semibold">{t('owner.noPending')}</p>
              <p className="mt-0.5 text-sm text-ink-muted">{t('owner.noRequestsBody')}</p>
            </div>
          </Card>
        ) : (
          <ul className="space-y-2">
            {pending.slice(0, 3).map((booking) => (
              <li key={booking.id}>
                <Link
                  to="/owner/bookings"
                  className="flex items-center gap-3 rounded-xl border border-cream-200 bg-white p-3.5 shadow-soft transition-colors hover:border-leaf-300"
                >
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-harvest-100 text-harvest-800">
                    <Inbox className="size-5" aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-bold">
                      {t('owner.requestFrom', {
                        name: booking.farmer?.full_name ?? t('owner.farmer'),
                      })}
                    </span>
                    <span className="block truncate text-xs text-ink-muted">
                      {booking.machine
                        ? t(machineTypeLabelKey(booking.machine.machine_type))
                        : t('common.unknown')}{' '}
                      · {formatDate(booking.service_date, language)} · {booking.acreage}{' '}
                      {t('common.acres')}
                    </span>
                  </span>
                  <ChevronRight className="size-4 shrink-0 text-ink-muted" aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <ConfirmDialog
        open={deleteTarget !== null}
        onClose={() => (deleting ? undefined : setDeleteTarget(null))}
        onConfirm={() => void handleDeleteMachine()}
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
