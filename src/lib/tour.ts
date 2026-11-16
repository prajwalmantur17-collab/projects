// Small helpers for the first-visit guided tour. Storage is best-effort: it can be blocked.

export const TOUR_EVENT = 'hr-start-tour'
const TOUR_KEY = 'hr_tour_done_v1'

export function isTourDone(): boolean {
  try {
    return window.localStorage.getItem(TOUR_KEY) === '1'
  } catch {
    // If storage is blocked we cannot remember, so do not nag on every visit.
    return true
  }
}

export function markTourDone(): void {
  try {
    window.localStorage.setItem(TOUR_KEY, '1')
  } catch {
    // ignore
  }
}

/** Asks the tour to start again (used by the Settings button). */
export function startTour(): void {
  window.dispatchEvent(new Event(TOUR_EVENT))
}
