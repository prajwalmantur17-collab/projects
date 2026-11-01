import { useEffect, useState } from 'react'
import {
  AlertCircle,
  Briefcase,
  Calendar,
  Clock,
  Coins,
  LandPlot,
  MapPin,
  Sprout,
  Tractor,
  Trash2,
  User,
} from 'lucide-react'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { ConfirmDialog } from '../components/ui/ConfirmDialog'
import { LoadingScreen } from '../components/ui/Feedback'
import { PageHeader } from '../components/ui/PageHeader'
import { useI18n } from '../i18n'
import type { TranslationKey } from '../i18n'
import { logError } from '../lib/errors'
import { formatAcreage, formatDate, formatPrice } from '../lib/format'
import {
  clearClosedBookingsFromHistory,
  getHiddenBookingIds,
  removeBookingFromHistory,
} from '../services/bookings'
import { getMyRecord } from '../services/record'
import type { MyRecord, RecordItem } from '../types'

export function RecordPage() {
  const { t, language } = useI18n()
  const [selectedYear, setSelectedYear] = useState<number | undefined>(undefined)
  const [availableYears, setAvailableYears] = useState<number[]>([])
  const [record, setRecord] = useState<MyRecord | null>(null)
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(() => getHiddenBookingIds())
  const [deleteTarget, setDeleteTarget] = useState<RecordItem | null>(null)
  const [clearAllOpen, setClearAllOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    getMyRecord(selectedYear)
      .then((data) => {
        if (cancelled) return
        setRecord(data)
        if (data.years && data.years.length > 0) {
          setAvailableYears(data.years)
        }
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setError(err instanceof Error ? err.message : 'Failed to load record')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [selectedYear])

  const confirmDeleteSingle = async () => {
    if (!deleteTarget || deleting) return
    setDeleting(true)
    try {
      await removeBookingFromHistory(deleteTarget.id)
      setHiddenIds((prev) => {
        const next = new Set(prev)
        next.add(deleteTarget.id)
        return next
      })
      setDeleteTarget(null)
    } catch (caught) {
      logError('record.removeJob', caught)
    } finally {
      setDeleting(false)
    }
  }

  const confirmClearAll = async () => {
    if (deleting) return
    const ids = visibleItems.map((job) => job.id)
    if (ids.length === 0) return
    setDeleting(true)
    try {
      await clearClosedBookingsFromHistory(ids)
      setHiddenIds((prev) => {
        const next = new Set(prev)
        ids.forEach((id) => next.add(id))
        return next
      })
      setClearAllOpen(false)
    } catch (caught) {
      logError('record.clearAll', caught)
    } finally {
      setDeleting(false)
    }
  }

  if (loading && !record) {
    return <LoadingScreen message={t('app.loading')} />
  }

  const isOwner = record?.role === 'owner'
  const items = record?.items ?? []
  const visibleItems = items.filter((job) => !hiddenIds.has(job.id))
  const hasVisibleItems = visibleItems.length > 0

  // Calculate dynamic totals from visible items so removing an item updates the numbers
  const hasHiddenItems = hiddenIds.size > 0
  const jobsCount = hasHiddenItems ? visibleItems.length : (record?.jobs ?? 0)
  const totalAcres = hasHiddenItems
    ? visibleItems.reduce((acc, job) => acc + (Number(job.acreage) || 0), 0)
    : (record?.acres ?? 0)
  const totalAmount = hasHiddenItems
    ? visibleItems.reduce((acc, job) => {
        if (job.payment_method && job.amount_paid != null) {
          return acc + (Number(job.amount_paid) || 0)
        }
        return acc
      }, 0)
    : (record?.amount ?? 0)
  const totalHours = hasHiddenItems
    ? (isOwner ? visibleItems.reduce((acc, job) => acc + (Number(job.hours) || 0), 0) : null)
    : (record?.hours ?? null)
  const totalVillages = hasHiddenItems
    ? (isOwner ? new Set(visibleItems.map((j) => j.village.trim()).filter(Boolean)).size : null)
    : (record?.villages ?? null)
  const unpaidJobsCount = hasHiddenItems
    ? visibleItems.filter((j) => !j.payment_method || j.amount_paid == null).length
    : (record?.unpaid_jobs ?? 0)

  const visibleCrops = hasHiddenItems
    ? Array.from(
        visibleItems.reduce((map, item) => {
          const prev = map.get(item.crop) || { crop: item.crop, acres: 0, amount: 0 }
          prev.acres += Number(item.acreage) || 0
          if (item.payment_method && item.amount_paid != null) {
            prev.amount += Number(item.amount_paid) || 0
          }
          map.set(item.crop, prev)
          return map
        }, new Map<string, { crop: string; acres: number; amount: number }>()).values(),
      ).sort((a, b) => b.acres - a.acres)
    : (record?.by_crop ?? [])

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6">
      <PageHeader
        title={t('record.title')}
        description={t('record.subtitle')}
        action={
          availableYears.length > 0 ? (
            <div className="flex items-center gap-2">
              <label htmlFor="record-year-filter" className="text-sm font-bold text-ink-soft">
                <Calendar className="mr-1 inline-block size-4 text-leaf-700" aria-hidden="true" />
                {t('record.filterYear')}
              </label>
              <select
                id="record-year-filter"
                value={selectedYear ?? ''}
                onChange={(e) => {
                  const val = e.target.value
                  setSelectedYear(val ? Number(val) : undefined)
                }}
                className="min-h-11 rounded-xl border-2 border-cream-300 bg-white px-3 py-1.5 text-sm font-bold text-ink focus:border-leaf-600 focus:outline-none"
              >
                <option value="">{t('record.allTime')}</option>
                {availableYears.map((yr) => (
                  <option key={yr} value={yr}>
                    {yr}
                  </option>
                ))}
              </select>
            </div>
          ) : undefined
        }
      />

      {error ? (
        <div className="mb-6 rounded-2xl border border-clay-200 bg-clay-50 p-4 text-sm text-clay-800">
          <p className="font-semibold">{error}</p>
        </div>
      ) : null}

      {/* Summary Cards */}
      <div
        className={`grid gap-3 sm:gap-4 ${
          isOwner
            ? 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-5'
            : 'grid-cols-2 sm:grid-cols-3'
        }`}
      >
        <Card className="p-4 sm:p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-ink-muted">
              {isOwner ? t('record.earned') : t('record.spent')}
            </span>
            <Coins className="size-5 text-harvest-600" aria-hidden="true" />
          </div>
          <p className="mt-2 text-xl font-black text-ink sm:text-2xl">
            {formatPrice(totalAmount)}
          </p>
        </Card>

        <Card className="p-4 sm:p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-ink-muted">
              {t('record.acres')}
            </span>
            <LandPlot className="size-5 text-leaf-600" aria-hidden="true" />
          </div>
          <p className="mt-2 text-xl font-black text-ink sm:text-2xl">
            {formatAcreage(totalAcres)}
          </p>
        </Card>

        <Card className="p-4 sm:p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-ink-muted">
              {t('record.jobs')}
            </span>
            <Briefcase className="size-5 text-leaf-700" aria-hidden="true" />
          </div>
          <p className="mt-2 text-xl font-black text-ink sm:text-2xl">
            {jobsCount}
          </p>
        </Card>

        {isOwner ? (
          <>
            <Card className="p-4 sm:p-5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-ink-muted">
                  {t('record.hours')}
                </span>
                <Clock className="size-5 text-leaf-600" aria-hidden="true" />
              </div>
              <p className="mt-2 text-xl font-black text-ink sm:text-2xl">
                {t('record.hoursUnit', { hours: String(Math.round((totalHours ?? 0) * 10) / 10) })}
              </p>
            </Card>

            <Card className="p-4 sm:p-5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-ink-muted">
                  {t('record.villages')}
                </span>
                <MapPin className="size-5 text-leaf-700" aria-hidden="true" />
              </div>
              <p className="mt-2 text-xl font-black text-ink sm:text-2xl">
                {totalVillages ?? 0}
              </p>
            </Card>
          </>
        ) : null}
      </div>

      {/* Unpaid jobs warning note */}
      {unpaidJobsCount > 0 ? (
        <div className="mt-4 flex items-start gap-2.5 rounded-2xl border border-harvest-200 bg-harvest-50 p-4 text-xs font-medium leading-relaxed text-harvest-900 sm:text-sm">
          <AlertCircle className="mt-0.5 size-4 shrink-0 text-harvest-700" aria-hidden="true" />
          <p>{t('record.unpaidNote', { count: String(unpaidJobsCount) })}</p>
        </div>
      ) : null}

      {/* Farmer by_crop breakdown */}
      {!isOwner && visibleCrops.length > 0 ? (
        <Card className="mt-6 p-4 sm:p-6">
          <h2 className="flex items-center gap-2 text-base font-bold text-ink sm:text-lg">
            <Sprout className="size-5 text-leaf-600" aria-hidden="true" />
            {t('record.byCrop')}
          </h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 md:grid-cols-3">
            {visibleCrops.map((c) => {
              const cropKey = `crop.${c.crop}` as TranslationKey
              const cropName = t(cropKey) !== cropKey ? t(cropKey) : c.crop
              return (
                <div
                  key={c.crop}
                  className="flex items-center justify-between rounded-xl border border-cream-200 bg-cream-50/60 p-3"
                >
                  <div>
                    <p className="font-bold text-ink">{cropName}</p>
                    <p className="text-xs text-ink-muted">
                      {t('record.acresUnit', { acres: formatAcreage(c.acres) })}
                    </p>
                  </div>
                  <span className="text-sm font-extrabold text-leaf-900">
                    {formatPrice(c.amount)}
                  </span>
                </div>
              )
            })}
          </div>
        </Card>
      ) : null}

      {/* Completed Jobs List */}
      <div className="mt-6">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-bold text-ink sm:text-xl">
            {t('record.jobs')} ({visibleItems.length})
          </h2>
          {hasVisibleItems ? (
            <Button
              variant="ghost"
              size="sm"
              className="border border-cream-300 text-clay-700 hover:border-clay-400 hover:bg-clay-50"
              icon={<Trash2 className="size-4 text-clay-600" aria-hidden="true" />}
              onClick={() => setClearAllOpen(true)}
            >
              {t('work.clearAll')}
            </Button>
          ) : null}
        </div>

        {!hasVisibleItems ? (
          <Card className="p-8 text-center sm:p-12">
            <Briefcase className="mx-auto size-12 text-cream-400" aria-hidden="true" />
            <p className="mt-3 text-base font-semibold text-ink-soft">
              {t('record.empty')}
            </p>
          </Card>
        ) : (
          <div className="space-y-3">
            {visibleItems.map((job) => {
              const machineKey = `machineType.${job.machine_type}` as TranslationKey
              const machineName = t(machineKey) !== machineKey ? t(machineKey) : job.machine_type
              const cropKey = `crop.${job.crop}` as TranslationKey
              const cropName = t(cropKey) !== cropKey ? t(cropKey) : job.crop

              return (
                <Card key={job.id} className="p-4 sm:p-5">
                  <div className="flex flex-wrap items-start justify-between gap-2 border-b border-cream-200 pb-3">
                    <div className="flex items-center gap-2">
                      <Calendar className="size-4 text-leaf-700" aria-hidden="true" />
                      <span className="text-sm font-bold text-ink">
                        {formatDate(job.service_date, language)}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      {job.payment_method && job.amount_paid != null ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-leaf-50 px-3 py-1 text-xs font-black text-leaf-800">
                          {formatPrice(job.amount_paid)}
                          <span className="font-normal text-leaf-600">
                            ({job.payment_method === 'upi' ? t('work.upi') : t('work.cash')})
                          </span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full bg-harvest-50 px-3 py-1 text-xs font-bold text-harvest-800">
                          {t('record.unpaidBadge')}
                        </span>
                      )}

                      <button
                        type="button"
                        onClick={() => setDeleteTarget(job)}
                        className="inline-flex size-8 items-center justify-center rounded-lg text-cream-400 transition-colors hover:bg-clay-50 hover:text-clay-700"
                        title={t('work.removeHistory')}
                        aria-label={t('work.removeHistory')}
                      >
                        <Trash2 className="size-4" aria-hidden="true" />
                      </button>
                    </div>
                  </div>

                  <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2 md:grid-cols-4">
                    {/* Other party & Machine */}
                    <div className="flex items-center gap-2 text-ink-soft">
                      {isOwner ? (
                        <User className="size-4 shrink-0 text-leaf-600" aria-hidden="true" />
                      ) : (
                        <Tractor className="size-4 shrink-0 text-leaf-600" aria-hidden="true" />
                      )}
                      <span className="truncate">
                        <strong className="text-ink">
                          {isOwner ? `${t('record.farmer')}: ` : ''}
                        </strong>
                        {isOwner ? job.other_party_name : machineName}
                      </span>
                    </div>

                    {!isOwner ? (
                      <div className="flex items-center gap-2 text-ink-soft">
                        <User className="size-4 shrink-0 text-leaf-600" aria-hidden="true" />
                        <span className="truncate">
                          <strong className="text-ink">{t('record.owner')}: </strong>
                          {job.other_party_name}
                        </span>
                      </div>
                    ) : null}

                    {/* Location */}
                    <div className="flex items-center gap-2 text-ink-soft">
                      <MapPin className="size-4 shrink-0 text-leaf-600" aria-hidden="true" />
                      <span className="truncate">{job.village}</span>
                    </div>

                    {/* Acres & Crop */}
                    <div className="flex items-center gap-2 text-ink-soft">
                      <Sprout className="size-4 shrink-0 text-leaf-600" aria-hidden="true" />
                      <span>
                        {t('record.acresUnit', { acres: formatAcreage(job.acreage) })} • {cropName}
                      </span>
                    </div>

                    {/* Hours (if available / owner) */}
                    {job.hours != null ? (
                      <div className="flex items-center gap-2 text-ink-soft">
                        <Clock className="size-4 shrink-0 text-leaf-600" aria-hidden="true" />
                        <span>{t('record.hoursUnit', { hours: String(job.hours) })}</span>
                      </div>
                    ) : null}
                  </div>

                  {/* One-by-one remove button */}
                  <div className="mt-3 flex items-center justify-end border-t border-cream-100 pt-3">
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-cream-300 text-clay-700 hover:border-clay-400 hover:bg-clay-50"
                      icon={<Trash2 className="size-4 text-clay-600" aria-hidden="true" />}
                      onClick={() => setDeleteTarget(job)}
                    >
                      {t('work.removeHistory')}
                    </Button>
                  </div>
                </Card>
              )
            })}
          </div>
        )}
      </div>

      {/* Remove Single Record Dialog */}
      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => {
          if (deleting) return
          setDeleteTarget(null)
        }}
        onConfirm={() => void confirmDeleteSingle()}
        title={t('work.removeConfirm')}
        description={t('farmer.deleteBookingBody')}
        confirmLabel={t('work.removeHistory')}
        cancelLabel={t('common.cancel')}
        danger
        loading={deleting}
      />

      {/* Clear All Dialog */}
      <ConfirmDialog
        open={clearAllOpen}
        onClose={() => {
          if (deleting) return
          setClearAllOpen(false)
        }}
        onConfirm={() => void confirmClearAll()}
        title={t('work.clearConfirm')}
        description={t('farmer.deleteBookingBody')}
        confirmLabel={t('work.clearAll')}
        cancelLabel={t('common.cancel')}
        danger
        loading={deleting}
      />
    </div>
  )
}
