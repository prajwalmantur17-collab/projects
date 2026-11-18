import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  CalendarClock,
  ChevronRight,
  Inbox,
  MapPin,
  Pause,
  Pencil,
  Play,
  Plus,
  Tractor,
  Trash2,
} from 'lucide-react'
import { useAuth } from '../../auth/AuthProvider'
import { useI18n } from '../../i18n'
import type { TranslationKey } from '../../i18n'
import { logError, mapErrorToKey } from '../../lib/errors'
import { formatDate, formatPrice } from '../../lib/format'
import { machineTypeLabelKey } from '../../lib/labels'
import { useAsync } from '../../hooks/useAsync'
import { getOwnerBookings, subscribeToBookings } from '../../services/bookings'
import {
  deleteMachine,
  getDeletedMachineIds,
  isMachineDeleted,
  listOwnerMachines,
  setMachineActive,
} from '../../services/machines'
import type { MachineCard } from '../../types'
import { BookingMachineThumb } from '../../components/booking/BookingMachineThumb'
import { KisanVoiceAssistant } from '../../components/voice/KisanVoiceAssistant'
import { speakAloud } from '../../lib/voice'
import { toast } from '../../lib/toast'
import { setUserRole } from '../../services/profiles'
import type { UserRole } from '../../types'
import { Alert } from '../../components/ui/Alert'
import { Button } from '../../components/ui/Button'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { Spinner } from '../../components/ui/Feedback'

export function OwnerHomePage() {
  const { profile, refreshProfile } = useAuth()
  const { t, language } = useI18n()
  const navigate = useNavigate()
  const ownerId = profile?.id

  /**
   * Called when the owner uses voice to switch back to farmer mode.
   * Switches immediately via voice without modal blockers.
   */
  const handleVoiceModeSwitch = useCallback(
    async (targetRole?: 'owner' | 'farmer' | 'toggle') => {
      const nextRole: UserRole =
        targetRole === 'owner'
          ? 'owner'
          : targetRole === 'farmer'
            ? 'farmer'
            : profile?.role === 'owner'
              ? 'farmer'
              : 'owner'

      if (profile?.role === nextRole) {
        const msg = t('mode.switched', { role: t(nextRole === 'owner' ? 'role.owner' : 'role.farmer') })
        toast.success(msg)
        void speakAloud(msg, language)
        return
      }

      try {
        const spokenRole = t(nextRole === 'owner' ? 'role.owner' : 'role.farmer')
        const switchingMsg =
          language === 'kn'
            ? `${spokenRole} ಮೋಡ್‌ಗೆ ಬದಲಾಯಿಸಲಾಗುತ್ತಿದೆ...`
            : language === 'hi'
              ? `${spokenRole} मोड में बदला जा रहा है...`
              : language === 'ta'
                ? `${spokenRole} பயன்முறைக்கு மாற்றப்படுகிறது...`
                : `Switching to ${spokenRole} mode...`
        void speakAloud(switchingMsg, language)

        await setUserRole(nextRole)
        await refreshProfile()
        const successMsg = t('mode.switched', { role: spokenRole })
        toast.success(successMsg)
        navigate(nextRole === 'owner' ? '/owner' : '/farmer', { replace: true })
      } catch (caught) {
        logError('voice.modeSwitch', caught)
        toast.error(t('mode.error'))
      }
    },
    [profile?.role, refreshProfile, navigate, t, language],
  )

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
  const { reload: reloadRequests } = requests

  useEffect(() => {
    if (!ownerId) return
    return subscribeToBookings(ownerId, 'owner', () => {
      reloadRequests()
    }, 'owner-home-bookings')
  }, [ownerId, reloadRequests])

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
      // 1. Perform deletion on backend first
      await deleteMachine(idToDelete, ownerId)

      // 2. Server confirmed deletion: update local state & show success
      setDeletedIds((prev) => new Set([...prev, idToDelete]))
      setDeleteTarget(null)
      setSuccess('owner.deleteSuccess')
      machines.reload()
    } catch (caught) {
      logError('owner.deleteMachine', caught)
      setActionError(mapErrorToKey(caught, 'owner.deleteError'))
      // Do not falsely hide the machine or claim deletion succeeded
    } finally {
      setDeleting(false)
    }
  }

  const name = profile?.full_name?.trim() || t('owner.fallbackName')

  return (
    <div className="space-y-6">
      {/* Header section */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-leaf-950 via-leaf-900 to-leaf-800 p-6 sm:p-8 text-white shadow-xl border border-white/10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-white/10 border border-white/15 px-3.5 py-1 text-xs font-semibold text-leaf-200 backdrop-blur-md">
            <Tractor className="size-3.5 text-harvest-400" aria-hidden="true" />
            <span>{t('role.owner')}</span>
          </div>
          <h1 className="font-display mt-2 text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
            {t('owner.greeting', { name })}
          </h1>
          <p className="mt-1 text-sm font-medium text-cream-200/90">
            {t('owner.subtitle')}
          </p>
        </div>

        <div>
          <Link
            to="/owner/machines/new"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-leaf-700 hover:bg-leaf-600 px-5 py-2.5 text-sm font-bold text-white shadow-md active:scale-[0.98] transition-all cursor-pointer"
          >
            <Plus className="size-4" aria-hidden="true" />
            <span>{t('owner.addMachine')}</span>
          </Link>
        </div>
      </div>

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

      {/* Statistics Cards */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Link
          to="/owner/bookings"
          className="group flex items-center justify-between card-surface p-5 shadow-soft hover:shadow-lift hover:border-leaf-300 transition-all"
        >
          <div className="flex items-center gap-4">
            <span className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-harvest-100 text-harvest-800 border border-harvest-200/60">
              <Inbox className="size-7" aria-hidden="true" />
            </span>
            <div>
              <span className="block text-xs font-bold uppercase tracking-wider text-ink-muted">
                {t('owner.requestsTitle')}
              </span>
              <span className="font-display mt-0.5 block text-3xl font-black text-ink">
                {requests.loading ? '…' : requests.error ? '—' : pending.length}
              </span>
              <span className="block truncate text-xs font-medium text-ink-muted mt-0.5">
                {requests.error
                  ? t('common.unknown')
                  : pending.length > 0
                    ? t('owner.pendingCount', { count: pending.length })
                    : t('owner.noPending')}
              </span>
            </div>
          </div>
          <ChevronRight className="size-5 text-ink-muted group-hover:text-ink group-hover:translate-x-0.5 transition-all" aria-hidden="true" />
        </Link>

        <Link
          to="/owner/machines"
          className="group flex items-center justify-between card-surface p-5 shadow-soft hover:shadow-lift hover:border-leaf-300 transition-all"
        >
          <div className="flex items-center gap-4">
            <span className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-leaf-50 text-leaf-800 border border-leaf-200/60">
              <Tractor className="size-7" aria-hidden="true" />
            </span>
            <div>
              <span className="block text-xs font-bold uppercase tracking-wider text-ink-muted">
                {t('owner.myMachinesTitle')}
              </span>
              <span className="font-display mt-0.5 block text-3xl font-black text-ink">
                {machines.loading ? '…' : machines.error ? '—' : machineList.length}
              </span>
              <span className="block truncate text-xs font-medium text-ink-muted mt-0.5">
                {t('owner.myMachinesSubtitle')}
              </span>
            </div>
          </div>
          <ChevronRight className="size-5 text-ink-muted group-hover:text-ink group-hover:translate-x-0.5 transition-all" aria-hidden="true" />
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

      {/* My Machines section */}
      <section className="pt-2" aria-labelledby="owner-machines-heading">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 id="owner-machines-heading" className="font-display text-xl font-extrabold text-ink">
              {t('owner.myMachinesTitle')}
            </h2>
            <p className="text-xs font-semibold text-ink-muted">
              {t('owner.myMachinesSubtitle')}
            </p>
          </div>
          {machineList.length > 0 ? (
            <Link
              to="/owner/machines"
              className="text-xs font-bold text-leaf-800 bg-leaf-50 border border-leaf-200 px-3.5 py-1.5 rounded-full hover:bg-leaf-100 transition-colors shadow-xs"
            >
              {t('common.view')} ({machineList.length})
            </Link>
          ) : null}
        </div>

        {machines.loading ? (
          <div className="flex items-center justify-center gap-2 card-surface py-12 shadow-soft">
            <Spinner className="size-5 text-leaf-700" />
            <span className="text-sm font-medium text-ink-muted">{t('common.loading')}</span>
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
          <div className="card-surface p-8 text-center shadow-soft">
            <div className="mx-auto flex size-16 items-center justify-center rounded-2xl bg-cream-100 text-leaf-800 mb-4">
              <Tractor className="size-8" />
            </div>
            <h3 className="font-display text-lg font-bold text-ink">{t('owner.noMachinesTitle')}</h3>
            <p className="mt-1 text-sm text-ink-muted max-w-md mx-auto">
              {t('owner.noMachinesBody')}
            </p>
            <Link
              to="/owner/machines/new"
              className="mt-5 inline-flex items-center gap-2 rounded-xl bg-leaf-700 px-5 py-2.5 text-sm font-bold text-white shadow-soft hover:bg-leaf-800 transition-all"
            >
              <Plus className="size-4" aria-hidden="true" />
              <span>{t('owner.addMachine')}</span>
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
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
                <div
                  key={machine.id}
                  className="card-surface p-5 sm:p-6 shadow-soft hover:shadow-lift transition-all"
                >
                  <div className="flex flex-col sm:flex-row gap-4">
                    <div className="shrink-0">
                      <BookingMachineThumb imagePath={machine.image_path} typeLabel={typeLabel} />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <h3 className="font-display text-base sm:text-lg font-bold text-ink">{typeLabel}</h3>
                          <p className="text-xs sm:text-sm font-medium text-ink-muted">
                            {machine.model ?? t('farmer.noModel')}
                          </p>
                        </div>

                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-0.5 text-xs font-bold ${
                            machine.is_active
                              ? 'bg-leaf-50 text-leaf-800 border border-leaf-200'
                              : 'bg-harvest-100 text-harvest-800 border border-harvest-200'
                          }`}
                        >
                          <span
                            className={`size-1.5 rounded-full ${
                              machine.is_active ? 'bg-leaf-600' : 'bg-harvest-600'
                            }`}
                            aria-hidden="true"
                          />
                          {machine.is_active ? t('owner.activeLabel') : t('owner.pausedLabel')}
                        </span>
                      </div>

                      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs sm:text-sm">
                        <p className="font-display font-extrabold text-leaf-800 text-base">
                          {formatPrice(machine.price_per_acre)}{' '}
                          <span className="text-xs font-normal text-ink-muted">{unitLabel}</span>
                        </p>

                        {Array.isArray(machine.service_villages) && machine.service_villages.length > 0 ? (
                          <p className="flex items-center gap-1 text-xs text-ink-muted">
                            <MapPin className="size-3.5 text-leaf-600 shrink-0" />
                            <span className="truncate max-w-xs">{machine.service_villages.join(', ')}</span>
                          </p>
                        ) : null}
                      </div>

                      {/* Machine Action Buttons */}
                      <div className="mt-4 flex flex-wrap items-center gap-2">
                        <Link
                          to={`/owner/machines/${machine.id}/edit`}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-cream-200 bg-white px-3.5 py-1.5 text-xs font-bold text-ink shadow-2xs hover:bg-cream-50 hover:border-leaf-300 transition-colors"
                        >
                          <Pencil className="size-3.5 text-ink-muted" />
                          <span>{t('common.edit')}</span>
                        </Link>

                        <Link
                          to={`/owner/machines/${machine.id}/availability`}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-cream-200 bg-white px-3.5 py-1.5 text-xs font-bold text-ink shadow-2xs hover:bg-cream-50 hover:border-leaf-300 transition-colors"
                        >
                          <CalendarClock className="size-3.5 text-leaf-700" />
                          <span>{t('owner.manageAvailability')}</span>
                        </Link>

                        <button
                          type="button"
                          disabled={busyMachineId !== null || deleting}
                          onClick={() => void toggleMachine(machine)}
                          className={`inline-flex items-center gap-1.5 rounded-xl border px-3.5 py-1.5 text-xs font-bold shadow-2xs transition-colors cursor-pointer disabled:opacity-50 ${
                            machine.is_active
                              ? 'border-harvest-200 bg-harvest-50/80 text-harvest-800 hover:bg-harvest-100'
                              : 'border-leaf-200 bg-leaf-50 text-leaf-800 hover:bg-leaf-100'
                          }`}
                        >
                          {busy ? (
                            <Spinner className="size-3.5" />
                          ) : machine.is_active ? (
                            <Pause className="size-3.5 text-harvest-700" />
                          ) : (
                            <Play className="size-3.5 text-leaf-700" />
                          )}
                          <span>{machine.is_active ? t('owner.pause') : t('owner.reactivate')}</span>
                        </button>

                        <button
                          type="button"
                          disabled={busyMachineId !== null || deleting}
                          onClick={() => setDeleteTarget(machine)}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50/50 px-3.5 py-1.5 text-xs font-bold text-rose-700 shadow-2xs hover:bg-rose-100 transition-colors cursor-pointer disabled:opacity-50"
                        >
                          <Trash2 className="size-3.5" />
                          <span>{t('owner.deleteMachine')}</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}

            {machineList.length > 4 ? (
              <Link
                to="/owner/machines"
                className="mt-2 block w-full rounded-xl border border-cream-200 bg-white py-2.5 text-center text-xs font-bold text-leaf-800 shadow-2xs hover:bg-cream-50 transition-colors"
              >
                {t('owner.myMachinesCount', { count: machineList.length })}
              </Link>
            ) : null}
          </div>
        )}
      </section>

      {/* Booking Requests section */}
      <section className="pt-2" aria-labelledby="owner-requests-heading">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 id="owner-requests-heading" className="font-display text-xl font-extrabold text-ink">
              {t('owner.recentRequests')}
            </h2>
            <p className="text-xs font-medium text-ink-muted">
              {t('owner.requestsTitle')}
            </p>
          </div>
          <Link
            to="/owner/bookings"
            className="text-xs font-bold text-leaf-700 hover:text-leaf-800 hover:underline"
          >
            {t('owner.viewAllRequests')}
          </Link>
        </div>

        {requests.loading ? (
          <div className="flex items-center justify-center gap-2 rounded-2xl border border-cream-200 bg-white py-10 shadow-soft">
            <Spinner className="size-5 text-leaf-700" />
            <span className="text-sm font-medium text-ink-muted">{t('common.loading')}</span>
          </div>
        ) : pending.length === 0 ? (
          <div className="flex items-start gap-3 rounded-2xl border border-cream-200 bg-white p-5 shadow-soft">
            <CalendarClock className="mt-0.5 size-5 shrink-0 text-leaf-700" aria-hidden="true" />
            <div>
              <p className="font-bold text-ink text-sm">{t('owner.noPending')}</p>
              <p className="mt-0.5 text-xs text-ink-muted">{t('owner.noRequestsBody')}</p>
            </div>
          </div>
        ) : (
          <ul className="space-y-2.5">
            {pending.slice(0, 3).map((booking) => (
              <li key={booking.id}>
                <Link
                  to="/owner/bookings"
                  className="group flex items-center justify-between gap-3 rounded-2xl border border-cream-200 bg-white p-4 shadow-soft hover:border-leaf-400 hover:shadow-lift transition-all"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-harvest-100 text-harvest-800 border border-harvest-200/50">
                      <Inbox className="size-5" aria-hidden="true" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-ink">
                        {t('owner.requestFrom', {
                          name: booking.farmer?.full_name ?? t('owner.farmer'),
                        })}
                      </p>
                      <p className="truncate text-xs font-medium text-ink-muted">
                        {booking.machine
                          ? t(machineTypeLabelKey(booking.machine.machine_type))
                          : t('common.unknown')}{' '}
                        · {formatDate(booking.service_date, language)} · {booking.acreage}{' '}
                        {t('common.acres')}
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="size-4 shrink-0 text-ink-muted group-hover:text-ink group-hover:translate-x-0.5 transition-all" aria-hidden="true" />
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

      {/* Floating Voice Assistant for 1-tap or voice mode switching */}
      <KisanVoiceAssistant
        onModeSwitch={handleVoiceModeSwitch}
        currentRole="owner"
      />
    </div>
  )
}
