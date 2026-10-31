import { useCallback, useState } from 'react'
import type { FormEvent } from 'react'
import { useParams } from 'react-router-dom'
import { CalendarOff, Trash2 } from 'lucide-react'
import { useAuth } from '../../auth/AuthProvider'
import { useI18n } from '../../i18n'
import type { TranslationKey } from '../../i18n'
import { logError, mapErrorToKey } from '../../lib/errors'
import { formatDate } from '../../lib/format'
import { addYearsIso, todayIsoInIndia, validateServiceDate } from '../../lib/validation'
import { useAsync } from '../../hooks/useAsync'
import {
  addBlackoutDate,
  getMachineCard,
  listBlackoutDates,
  removeBlackoutDate,
} from '../../services/machines'
import type { MachineBlackoutDate, MachineCard } from '../../types'
import { Alert } from '../../components/ui/Alert'
import { Button, LinkButton } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { EmptyState, LoadingScreen } from '../../components/ui/Feedback'
import { Input } from '../../components/ui/Input'
import { PageHeader } from '../../components/ui/PageHeader'

interface AvailabilityData {
  machine: MachineCard | null
  blackouts: MachineBlackoutDate[]
}

export function AvailabilityPage() {
  const { machineId } = useParams<{ machineId: string }>()
  const { profile } = useAuth()
  const ownerId = profile?.id
  const { t, language } = useI18n()
  const today = todayIsoInIndia()

  const [date, setDate] = useState('')
  const [dateError, setDateError] = useState<TranslationKey | null>(null)
  const [adding, setAdding] = useState(false)
  const [removingId, setRemovingId] = useState<string | null>(null)
  const [success, setSuccess] = useState<TranslationKey | null>(null)
  const [actionError, setActionError] = useState<TranslationKey | null>(null)

  const loader = useCallback(async (): Promise<AvailabilityData> => {
    if (!machineId || !ownerId) return { machine: null, blackouts: [] }
    const machine = await getMachineCard(machineId)
    if (!machine || machine.owner_id !== ownerId) {
      return { machine: null, blackouts: [] }
    }
    const blackouts = await listBlackoutDates(machine.id)
    return { machine, blackouts }
  }, [machineId, ownerId])

  const { data, loading, error, reload } = useAsync(loader, {
    fallback: 'machine.availabilityError',
  })

  const onAdd = async (event: FormEvent) => {
    event.preventDefault()
    if (!machineId || adding) return
    setSuccess(null)
    setActionError(null)
    const validation = validateServiceDate(date, today)
    if (validation) {
      setDateError(validation)
      return
    }
    setDateError(null)
    setAdding(true)
    try {
      await addBlackoutDate(machineId, date)
      setDate('')
      setSuccess('machine.dateAdded')
      reload()
    } catch (caught) {
      logError('machine.addBlackout', caught)
      setActionError(mapErrorToKey(caught, 'machine.dateAddError'))
    } finally {
      setAdding(false)
    }
  }

  const onRemove = async (blackout: MachineBlackoutDate) => {
    if (removingId) return
    setSuccess(null)
    setActionError(null)
    setRemovingId(blackout.id)
    try {
      await removeBlackoutDate(blackout.id)
      reload()
    } catch (caught) {
      logError('machine.removeBlackout', caught)
      setActionError(mapErrorToKey(caught, 'machine.dateRemoveError'))
    } finally {
      setRemovingId(null)
    }
  }

  if (loading) return <LoadingScreen message={t('common.loading')} />

  if (error) {
    return (
      <div className="mx-auto max-w-xl">
        <Alert variant="error">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span>{t(error)}</span>
            <Button size="sm" variant="outline" onClick={reload}>
              {t('common.retry')}
            </Button>
          </div>
        </Alert>
        <LinkButton to="/owner/machines" variant="ghost" className="mt-4">
          {t('machine.backToMachines')}
        </LinkButton>
      </div>
    )
  }

  if (!data?.machine) {
    return (
      <div className="mx-auto max-w-xl">
        <PageHeader
          title={t('machine.notFoundTitle')}
          backTo="/owner/machines"
          backLabel={t('machine.backToMachines')}
        />
        <EmptyState
          icon={CalendarOff}
          title={t('machine.notFoundTitle')}
          description={t('machine.notFoundBody')}
          action={
            <LinkButton to="/owner/machines" variant="primary">
              {t('machine.backToMachines')}
            </LinkButton>
          }
        />
      </div>
    )
  }

  const machine = data.machine
  const typeLabel = t(`machineType.${machine.machine_type}`)

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title={t('machine.availabilityTitle')}
        description={`${typeLabel}${machine.model ? ` · ${machine.model}` : ''}`}
        backTo="/owner/machines"
        backLabel={t('machine.backToMachines')}
      />

      <Card className="p-5 sm:p-6">
        <h2 className="text-lg font-bold">{t('machine.addUnavailableDate')}</h2>
        <p className="mt-0.5 text-sm text-ink-muted">{t('machine.availabilitySubtitle')}</p>

        {success ? (
          <Alert variant="success" className="mt-4">
            {t(success)}
          </Alert>
        ) : null}
        {actionError ? (
          <Alert variant="error" className="mt-4">
            {t(actionError)}
          </Alert>
        ) : null}

        <form onSubmit={(event) => void onAdd(event)} className="mt-4 flex flex-wrap items-end gap-3">
          <Input
            label={t('common.date')}
            type="date"
            value={date}
            min={today}
            max={addYearsIso(today, 1)}
            onChange={(event) => {
              setDate(event.target.value)
              setDateError(null)
            }}
            error={dateError ? t(dateError) : null}
            containerClassName="min-w-48 flex-1"
            required
          />
          <Button type="submit" loading={adding} className="mb-0.5">
            {t('machine.addUnavailableDate')}
          </Button>
        </form>
      </Card>

      <section className="mt-6" aria-labelledby="blocked-dates-heading">
        <h2 id="blocked-dates-heading" className="mb-3 text-lg font-bold">
          {t('machine.unavailableDates')}
        </h2>

        {data.blackouts.length === 0 ? (
          <Card className="p-5">
            <p className="text-sm text-ink-muted">{t('machine.noUnavailableDates')}</p>
          </Card>
        ) : (
          <ul className="space-y-2">
            {data.blackouts.map((blackout) => (
              <li
                key={blackout.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-cream-200 bg-white p-3.5 shadow-soft"
              >
                <span className="font-semibold">{formatDate(blackout.unavailable_on, language)}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-clay-800"
                  loading={removingId === blackout.id}
                  disabled={removingId !== null}
                  onClick={() => void onRemove(blackout)}
                  icon={<Trash2 className="size-4" aria-hidden="true" />}
                >
                  {t('machine.removeDate')}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
