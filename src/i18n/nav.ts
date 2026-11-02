// Short labels for the simplified navigation. Placeholders must match in every language.

export const navEn = {
  'nav.profile': 'Profile',
  'nav.requestsShort': 'Requests',
  'nav.machinesShort': 'My Machines',
  'nav.bookingsShort': 'My Bookings',
  'nav.pendingCount': '{count} waiting',
} as const

export const navKn: Record<keyof typeof navEn, string> = {
  'nav.profile': 'ಪ್ರೊಫೈಲ್',
  'nav.requestsShort': 'ವಿನಂತಿಗಳು',
  'nav.machinesShort': 'ನನ್ನ ಯಂತ್ರಗಳು',
  'nav.bookingsShort': 'ನನ್ನ ಬುಕಿಂಗ್‌ಗಳು',
  'nav.pendingCount': '{count} ಕಾಯುತ್ತಿವೆ',
}

export const navHi: Record<keyof typeof navEn, string> = {
  'nav.profile': 'प्रोफ़ाइल',
  'nav.requestsShort': 'अनुरोध',
  'nav.machinesShort': 'मेरी मशीनें',
  'nav.bookingsShort': 'मेरी बुकिंग',
  'nav.pendingCount': '{count} प्रतीक्षा में',
}

export const navTa: Record<keyof typeof navEn, string> = {
  'nav.profile': 'சுயவிவரம்',
  'nav.requestsShort': 'கோரிக்கைகள்',
  'nav.machinesShort': 'என் இயந்திரங்கள்',
  'nav.bookingsShort': 'என் முன்பதிவுகள்',
  'nav.pendingCount': '{count} காத்திருக்கின்றன',
}
