import { useI18n } from '../../i18n'
import { startTour } from '../../lib/tour'
import { Button } from '../ui/Button'
import { Card, CardHeader } from '../ui/Card'

/** Settings card that shows the first-visit guide again. */
export function TourReplayCard() {
  const { t } = useI18n()
  return (
    <Card>
      <CardHeader title={t('tour.replayTitle')} description={t('tour.replayBody')} />
      <div className="p-5 sm:p-6">
        <Button type="button" variant="outline" onClick={startTour}>
          {t('tour.replayButton')}
        </Button>
      </div>
    </Card>
  )
}
