import { useCallback } from 'react'
import { Users } from 'lucide-react'
import { useI18n } from '../../i18n'
import { useAsync } from '../../hooks/useAsync'
import { listDriverRequests } from '../../services/drivers'
import { DriverRequestCard } from '../../components/drivers/DriverRequestCard'
import { Alert } from '../../components/ui/Alert'
import { Button, LinkButton } from '../../components/ui/Button'
import { EmptyState, Spinner } from '../../components/ui/Feedback'
import { PageHeader } from '../../components/ui/PageHeader'

/** Hire requests I sent to drivers. */
export function DriverRequestsPage() {
  const { t } = useI18n()
  const loader = useCallback(() => listDriverRequests('requester'), [])
  const { data, loading, error, reload } = useAsync(loader, {
    fallback: 'drivers.req.loadError',
  })
  const requests = data ?? []

  return (
    <div>
      <PageHeader
        title={t('drivers.requests.title')}
        description={t('drivers.requests.subtitle')}
        action={
          <LinkButton to="/drivers" variant="outline">
            {t('drivers.find.title')}
          </LinkButton>
        }
      />

      {loading ? (
        <div className="flex justify-center py-10" aria-busy="true">
          <Spinner className="size-8" />
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
      ) : requests.length === 0 ? (
        <EmptyState
          icon={Users}
          title={t('drivers.requests.emptyTitle')}
          description={t('drivers.requests.emptyBody')}
          action={<LinkButton to="/drivers">{t('drivers.find.title')}</LinkButton>}
        />
      ) : (
        <div className="space-y-4">
          {requests.map((request) => (
            <DriverRequestCard
              key={request.id}
              request={request}
              mode="requester"
              onChanged={reload}
            />
          ))}
        </div>
      )}
    </div>
  )
}
