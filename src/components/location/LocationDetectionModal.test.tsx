import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../i18n'
import * as GeocodeService from '../../services/geocode'
import { LocationDetectionModal } from './LocationDetectionModal'

describe('LocationDetectionModal Component', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders detecting state with animated radar illustration when opened', () => {
    const mockWatch = vi.fn().mockReturnValue(1)
    const mockGetCurrent = vi.fn()
    const mockClear = vi.fn()

    Object.defineProperty(navigator, 'geolocation', {
      value: { getCurrentPosition: mockGetCurrent, watchPosition: mockWatch, clearWatch: mockClear },
      configurable: true,
    })

    render(
      <I18nProvider>
        <LocationDetectionModal
          open={true}
          onClose={vi.fn()}
          onConfirm={vi.fn()}
          onEnterManually={vi.fn()}
        />
      </I18nProvider>,
    )

    expect(screen.getByText('Finding your location')).toBeInTheDocument()
    expect(screen.getByText("We're locating your village to discover harvesting machines near you.")).toBeInTheDocument()
    expect(screen.getByText('Live GPS signal active')).toBeInTheDocument()
  })

  it('transitions to success state and allows confirmation after coordinates and geocode resolve', async () => {
    let watchSuccess: ((pos: GeolocationPosition) => void) | null = null
    const mockWatch = vi.fn().mockImplementation((success) => {
      watchSuccess = success
      return 1
    })
    const mockGetCurrent = vi.fn()
    const mockClear = vi.fn()

    Object.defineProperty(navigator, 'geolocation', {
      value: { getCurrentPosition: mockGetCurrent, watchPosition: mockWatch, clearWatch: mockClear },
      configurable: true,
    })

    vi.spyOn(GeocodeService, 'reverseGeocode').mockResolvedValue({
      village: 'Tikota',
      district: 'Vijayapura',
      state: 'Karnataka',
    })

    const onConfirmMock = vi.fn()
    const onCloseMock = vi.fn()

    render(
      <I18nProvider>
        <LocationDetectionModal
          open={true}
          onClose={onCloseMock}
          onConfirm={onConfirmMock}
          onEnterManually={vi.fn()}
        />
      </I18nProvider>,
    )

    // Simulate GPS signal arriving
    await act(async () => {
      watchSuccess?.({
        coords: {
          latitude: 16.8286,
          longitude: 75.5412,
          accuracy: 35,
          altitude: null,
          altitudeAccuracy: null,
          heading: null,
          speed: null,
          toJSON: () => ({}),
        },
        timestamp: Date.now(),
        toJSON: () => ({}),
      })
    })

    // Verify Success UI
    await waitFor(() => {
      expect(screen.getByText('Location Found!')).toBeInTheDocument()
      expect(screen.getByText('Tikota')).toBeInTheDocument()
      expect(screen.getByText('Vijayapura, Karnataka')).toBeInTheDocument()
    })

    // Click "Confirm Location"
    const confirmBtn = screen.getByRole('button', { name: 'Confirm Location' })
    fireEvent.click(confirmBtn)

    expect(onConfirmMock).toHaveBeenCalledWith({
      village: 'Tikota',
      district: 'Vijayapura',
      state: 'Karnataka',
      coords: { latitude: 16.8286, longitude: 75.5412 },
      accuracy: 35,
    })
    expect(onCloseMock).toHaveBeenCalled()
  })

  it('handles permission denied by displaying helpful instructions and retry options', async () => {
    let watchError: ((err: GeolocationPositionError) => void) | null = null
    const mockWatch = vi.fn().mockImplementation((_success, error) => {
      watchError = error
      return 1
    })
    const mockGetCurrent = vi.fn().mockImplementation((_success, error) => {
      error({ code: 1, message: 'User denied' })
    })
    const mockClear = vi.fn()

    Object.defineProperty(navigator, 'geolocation', {
      value: { getCurrentPosition: mockGetCurrent, watchPosition: mockWatch, clearWatch: mockClear },
      configurable: true,
    })

    render(
      <I18nProvider>
        <LocationDetectionModal
          open={true}
          onClose={vi.fn()}
          onConfirm={vi.fn()}
          onEnterManually={vi.fn()}
        />
      </I18nProvider>,
    )

    await act(async () => {
      watchError?.({ code: 1, message: 'User denied Geolocation', PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3 })
    })

    await waitFor(() => {
      expect(screen.getByText('Location Access Needed')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /enter village manually/i })).toBeInTheDocument()
    })
  })

  it('triggers onEnterManually when user selects Enter Village Manually', async () => {
    const mockWatch = vi.fn().mockImplementation((_success, error) => {
      error({ code: 1, message: 'User denied' })
      return 1
    })
    const mockGetCurrent = vi.fn()
    const mockClear = vi.fn()

    Object.defineProperty(navigator, 'geolocation', {
      value: { getCurrentPosition: mockGetCurrent, watchPosition: mockWatch, clearWatch: mockClear },
      configurable: true,
    })

    const onEnterManuallyMock = vi.fn()
    const onCloseMock = vi.fn()

    render(
      <I18nProvider>
        <LocationDetectionModal
          open={true}
          onClose={onCloseMock}
          onConfirm={vi.fn()}
          onEnterManually={onEnterManuallyMock}
        />
      </I18nProvider>,
    )

    const manualBtn = await screen.findByRole('button', { name: /enter village manually/i })
    fireEvent.click(manualBtn)

    expect(onEnterManuallyMock).toHaveBeenCalled()
    expect(onCloseMock).toHaveBeenCalled()
  })

  it('transitions to timeout state when location takes too long', async () => {
    vi.useFakeTimers()

    const mockWatch = vi.fn().mockReturnValue(1)
    const mockGetCurrent = vi.fn()
    const mockClear = vi.fn()

    Object.defineProperty(navigator, 'geolocation', {
      value: { getCurrentPosition: mockGetCurrent, watchPosition: mockWatch, clearWatch: mockClear },
      configurable: true,
    })

    render(
      <I18nProvider>
        <LocationDetectionModal
          open={true}
          onClose={vi.fn()}
          onConfirm={vi.fn()}
          onEnterManually={vi.fn()}
          timeoutMs={3000}
        />
      </I18nProvider>,
    )

    // Fast-forward past timeout limit
    act(() => {
      vi.advanceTimersByTime(3500)
    })

    expect(screen.getByText('Still trying to find your location…')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /enter village manually/i })).toBeInTheDocument()

    vi.useRealTimers()
  })

  it('confirms with empty village and valid coords when reverse geocoding returns no match so search is by distance only', async () => {
    let watchSuccess: ((pos: GeolocationPosition) => void) | null = null
    const mockWatch = vi.fn().mockImplementation((success) => {
      watchSuccess = success
      return 1
    })
    const mockGetCurrent = vi.fn()
    const mockClear = vi.fn()

    Object.defineProperty(navigator, 'geolocation', {
      value: { getCurrentPosition: mockGetCurrent, watchPosition: mockWatch, clearWatch: mockClear },
      configurable: true,
    })

    vi.spyOn(GeocodeService, 'reverseGeocode').mockResolvedValue(null)

    const onConfirmMock = vi.fn()

    render(
      <I18nProvider>
        <LocationDetectionModal
          open={true}
          onClose={vi.fn()}
          onConfirm={onConfirmMock}
          onEnterManually={vi.fn()}
        />
      </I18nProvider>,
    )

    await act(async () => {
      watchSuccess?.({
        coords: {
          latitude: 15.0,
          longitude: 76.0,
          accuracy: 50,
          altitude: null,
          altitudeAccuracy: null,
          heading: null,
          speed: null,
          toJSON: () => ({}),
        },
        timestamp: Date.now(),
        toJSON: () => ({}),
      })
    })

    await waitFor(() => {
      expect(screen.getByText('Location Found!')).toBeInTheDocument()
    })

    const confirmBtn = screen.getByRole('button', { name: 'Confirm Location' })
    fireEvent.click(confirmBtn)

    expect(onConfirmMock).toHaveBeenCalledWith(
      expect.objectContaining({
        village: '',
        coords: { latitude: 15.0, longitude: 76.0 },
      }),
    )
  })
})
