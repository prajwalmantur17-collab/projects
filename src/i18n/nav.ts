// Navigation labels and section headers across all supported languages.

export const navEn = {
  'nav.profile': 'My Profile',
  'nav.requestsShort': 'Requests',
  'nav.machinesShort': 'My Machines',
  'nav.bookingsShort': 'My Bookings',
  'nav.pendingCount': '{count} waiting',
  'nav.section.main': 'Main Menu',
  'nav.section.account': 'Account',
  'nav.section.support': 'Support',
  'nav.findMachines': 'Find Machines',
  'nav.ownerDashboard': 'Owner Dashboard',
  'nav.myRentals': 'My Rentals',
  'nav.rentalHistory': 'Rental History',
} as const

export const navKn: Record<keyof typeof navEn, string> = {
  'nav.profile': 'ನನ್ನ ಪ್ರೊಫೈಲ್',
  'nav.requestsShort': 'ವಿನಂತಿಗಳು',
  'nav.machinesShort': 'ನನ್ನ ಯಂತ್ರಗಳು',
  'nav.bookingsShort': 'ನನ್ನ ಬುಕಿಂಗ್‌ಗಳು',
  'nav.pendingCount': '{count} ಕಾಯುತ್ತಿವೆ',
  'nav.section.main': 'ಮುಖ್ಯ ಮೆನು',
  'nav.section.account': 'ಖಾತೆ',
  'nav.section.support': 'ಬೆಂಬಲ',
  'nav.findMachines': 'ಯಂತ್ರಗಳನ್ನು ಹುಡುಕಿ',
  'nav.ownerDashboard': 'ಮಾಲೀಕರ ಡ್ಯಾಶ್‌ಬೋರ್ಡ್',
  'nav.myRentals': 'ನನ್ನ ಬಾಡಿಗೆಗಳು',
  'nav.rentalHistory': 'ಬಾಡಿಗೆ ಇತಿಹಾಸ',
}

export const navHi: Record<keyof typeof navEn, string> = {
  'nav.profile': 'मेरी प्रोफ़ाइल',
  'nav.requestsShort': 'अनुरोध',
  'nav.machinesShort': 'मेरी मशीनें',
  'nav.bookingsShort': 'मेरी बुकिंग',
  'nav.pendingCount': '{count} प्रतीक्षा में',
  'nav.section.main': 'मुख्य मेनू',
  'nav.section.account': 'खाता',
  'nav.section.support': 'सहायता',
  'nav.findMachines': 'मशीनें खोजें',
  'nav.ownerDashboard': 'मालिक डैशबोर्ड',
  'nav.myRentals': 'मेरे किराए',
  'nav.rentalHistory': 'किराया इतिहास',
}

export const navTa: Record<keyof typeof navEn, string> = {
  'nav.profile': 'என் சுயவிவரம்',
  'nav.requestsShort': 'கோரிக்கைகள்',
  'nav.machinesShort': 'என் இயந்திரங்கள்',
  'nav.bookingsShort': 'என் முன்பதிவுகள்',
  'nav.pendingCount': '{count} காத்திருக்கின்றன',
  'nav.section.main': 'முக்கிய மெனு',
  'nav.section.account': 'கணக்கு',
  'nav.section.support': 'ஆதரவு',
  'nav.findMachines': 'இயந்திரங்களைத் தேடுங்கள்',
  'nav.ownerDashboard': 'உரிமையாளர் டாஷ்போர்டு',
  'nav.myRentals': 'என் வாடகைகள்',
  'nav.rentalHistory': 'வாடகை வரலாறு',
}
