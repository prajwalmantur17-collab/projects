// Road route on the live tracking map. Placeholders must match in every language.

export const routeEn = {
  'route.distanceTime': '{distance} km - about {time}',
  'route.viaRoad': 'Route by road',
  'route.straightLine': 'Road route not available, showing the direct line.',
  'route.loading': 'Finding the road route...',
  'route.minutes': '{count} min',
  'route.hoursMinutes': '{hours} h {minutes} min',
} as const

export const routeKn: Record<keyof typeof routeEn, string> = {
  'route.distanceTime': '{distance} ಕಿ.ಮೀ - ಸುಮಾರು {time}',
  'route.viaRoad': 'ರಸ್ತೆ ಮಾರ್ಗ',
  'route.straightLine': 'ರಸ್ತೆ ಮಾರ್ಗ ಲಭ್ಯವಿಲ್ಲ, ನೇರ ರೇಖೆ ತೋರಿಸಲಾಗುತ್ತಿದೆ.',
  'route.loading': 'ರಸ್ತೆ ಮಾರ್ಗ ಹುಡುಕಲಾಗುತ್ತಿದೆ...',
  'route.minutes': '{count} ನಿಮಿಷ',
  'route.hoursMinutes': '{hours} ಗಂ {minutes} ನಿಮಿಷ',
}

export const routeHi: Record<keyof typeof routeEn, string> = {
  'route.distanceTime': '{distance} किमी - लगभग {time}',
  'route.viaRoad': 'सड़क का रास्ता',
  'route.straightLine': 'सड़क का रास्ता उपलब्ध नहीं, सीधी रेखा दिखाई जा रही है।',
  'route.loading': 'सड़क का रास्ता खोजा जा रहा है...',
  'route.minutes': '{count} मिनट',
  'route.hoursMinutes': '{hours} घंटे {minutes} मिनट',
}
