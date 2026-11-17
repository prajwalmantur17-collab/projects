// Tractor, trailer and driver-option texts. Placeholders such as {amount} must match in every language.

const equipmentEn = {
  'machineType.tractor': 'Tractor',
  'machineType.trailer': 'Trailer',
  'machineType.tractor_trailer': 'Tractor + Trailer',

  'equip.perTrip': 'per trip',
  'equip.priceTrip': 'Price per trip',
  'equip.unitTrip': 'trip',
  'machine.pricingPerTrip': 'Per trip',
  'equip.priceHintTrip': 'In rupees, for one trip.',

  'equip.driverModeLabel': 'Driver',
  'equip.driverModeHint': 'Do you send a driver with it, or does the renter drive?',
  'equip.driverWith': 'With driver',
  'equip.driverWithout': 'Without driver',
  'equip.driverBoth': 'Both',
  'equip.driverExtraLabel': 'Extra for a driver (₹)',
  'equip.driverExtraHint': 'Added to the price when the renter wants your driver. Leave empty if free.',
  'equip.cropsOptionalHint': 'Optional. Leave empty if it can carry any crop.',

  'equip.badgeWith': 'Driver included',
  'equip.badgeWithout': 'Without driver',
  'equip.badgeBoth': 'With or without driver',
  'equip.extraForDriver': '+₹{amount} {unit} with driver',

  'equip.chooseDriver': 'Driver',
  'equip.optionWithDriver': 'With driver',
  'equip.optionWithoutDriver': 'Without driver',
  'equip.rateNow': 'Rate: ₹{amount} {unit}',

  'equip.renterLabel': 'Booking for',
  'equip.renterFarmer': 'Farm',
  'equip.renterFactory': 'Sugar factory',
  'equip.factoryLabel': 'Deliver to factory (optional)',
  'equip.factoryHint': 'Name of the sugar factory where the load goes.',

  'equip.qtyAcres': 'Acres',
  'equip.qtyHours': 'Hours',
  'equip.qtyDays': 'Days',
  'equip.qtyTrips': 'Number of trips',

  'equip.driverYes': 'Driver: included',
  'equip.driverNo': 'Driver: not included',
  'equip.destination': 'Factory',
  'equip.bookedAsFactory': 'Booked for a sugar factory',

  'equip.voiceDriver': 'Do you give it with a driver, without a driver, or both?',
  'equip.voiceDriverBad': 'Please say with driver, without driver, or both.',

  'validation.driverMode': 'Choose with driver, without driver or both.',
  'validation.driverExtra': 'Enter a valid extra amount in rupees.',
  'validation.factory': 'Factory name must be 80 characters or fewer.',
} as const

const equipmentKn: Record<keyof typeof equipmentEn, string> = {
  'machineType.tractor': 'ಟ್ರ್ಯಾಕ್ಟರ್',
  'machineType.trailer': 'ಟ್ರೇಲರ್',
  'machineType.tractor_trailer': 'ಟ್ರ್ಯಾಕ್ಟರ್ + ಟ್ರೇಲರ್',

  'equip.perTrip': 'ಪ್ರತಿ ಟ್ರಿಪ್‌ಗೆ',
  'equip.priceTrip': 'ಪ್ರತಿ ಟ್ರಿಪ್‌ಗೆ ಬೆಲೆ',
  'equip.unitTrip': 'ಟ್ರಿಪ್',
  'machine.pricingPerTrip': 'ಪ್ರತಿ ಟ್ರಿಪ್',
  'equip.priceHintTrip': 'ರೂಪಾಯಿಯಲ್ಲಿ, ಒಂದು ಟ್ರಿಪ್‌ಗೆ.',

  'equip.driverModeLabel': 'ಚಾಲಕ',
  'equip.driverModeHint': 'ನೀವು ಚಾಲಕನನ್ನು ಕಳುಹಿಸುತ್ತೀರಾ, ಅಥವಾ ಬಾಡಿಗೆದಾರರೇ ಓಡಿಸುತ್ತಾರಾ?',
  'equip.driverWith': 'ಚಾಲಕನೊಂದಿಗೆ',
  'equip.driverWithout': 'ಚಾಲಕ ಇಲ್ಲದೆ',
  'equip.driverBoth': 'ಎರಡೂ',
  'equip.driverExtraLabel': 'ಚಾಲಕನಿಗೆ ಹೆಚ್ಚುವರಿ (₹)',
  'equip.driverExtraHint': 'ಬಾಡಿಗೆದಾರರಿಗೆ ನಿಮ್ಮ ಚಾಲಕ ಬೇಕಾದರೆ ಬೆಲೆಗೆ ಸೇರುತ್ತದೆ. ಉಚಿತವಾಗಿದ್ದರೆ ಖಾಲಿ ಬಿಡಿ.',
  'equip.cropsOptionalHint': 'ಐಚ್ಛಿಕ. ಯಾವುದೇ ಬೆಳೆ ಸಾಗಿಸಬಹುದಾದರೆ ಖಾಲಿ ಬಿಡಿ.',

  'equip.badgeWith': 'ಚಾಲಕ ಸೇರಿದೆ',
  'equip.badgeWithout': 'ಚಾಲಕ ಇಲ್ಲದೆ',
  'equip.badgeBoth': 'ಚಾಲಕನೊಂದಿಗೆ ಅಥವಾ ಇಲ್ಲದೆ',
  'equip.extraForDriver': 'ಚಾಲಕನೊಂದಿಗೆ +₹{amount} {unit}',

  'equip.chooseDriver': 'ಚಾಲಕ',
  'equip.optionWithDriver': 'ಚಾಲಕನೊಂದಿಗೆ',
  'equip.optionWithoutDriver': 'ಚಾಲಕ ಇಲ್ಲದೆ',
  'equip.rateNow': 'ದರ: ₹{amount} {unit}',

  'equip.renterLabel': 'ಯಾರಿಗೆ ಬುಕಿಂಗ್',
  'equip.renterFarmer': 'ಹೊಲ',
  'equip.renterFactory': 'ಸಕ್ಕರೆ ಕಾರ್ಖಾನೆ',
  'equip.factoryLabel': 'ಕಾರ್ಖಾನೆಗೆ ತಲುಪಿಸಿ (ಐಚ್ಛಿಕ)',
  'equip.factoryHint': 'ಲೋಡ್ ಹೋಗುವ ಸಕ್ಕರೆ ಕಾರ್ಖಾನೆಯ ಹೆಸರು.',

  'equip.qtyAcres': 'ಎಕರೆ',
  'equip.qtyHours': 'ಗಂಟೆಗಳು',
  'equip.qtyDays': 'ದಿನಗಳು',
  'equip.qtyTrips': 'ಟ್ರಿಪ್‌ಗಳ ಸಂಖ್ಯೆ',

  'equip.driverYes': 'ಚಾಲಕ: ಸೇರಿದೆ',
  'equip.driverNo': 'ಚಾಲಕ: ಸೇರಿಲ್ಲ',
  'equip.destination': 'ಕಾರ್ಖಾನೆ',
  'equip.bookedAsFactory': 'ಸಕ್ಕರೆ ಕಾರ್ಖಾನೆಗಾಗಿ ಬುಕ್ ಮಾಡಲಾಗಿದೆ',

  'equip.voiceDriver': 'ನೀವು ಚಾಲಕನೊಂದಿಗೆ ಕೊಡುತ್ತೀರಾ, ಚಾಲಕ ಇಲ್ಲದೆ ಕೊಡುತ್ತೀರಾ, ಅಥವಾ ಎರಡೂ?',
  'equip.voiceDriverBad': 'ದಯವಿಟ್ಟು ಚಾಲಕನೊಂದಿಗೆ, ಚಾಲಕ ಇಲ್ಲದೆ ಅಥವಾ ಎರಡೂ ಎಂದು ಹೇಳಿ.',

  'validation.driverMode': 'ಚಾಲಕನೊಂದಿಗೆ, ಚಾಲಕ ಇಲ್ಲದೆ ಅಥವಾ ಎರಡೂ ಆಯ್ಕೆಮಾಡಿ.',
  'validation.driverExtra': 'ರೂಪಾಯಿಯಲ್ಲಿ ಸರಿಯಾದ ಹೆಚ್ಚುವರಿ ಮೊತ್ತ ನಮೂದಿಸಿ.',
  'validation.factory': 'ಕಾರ್ಖಾನೆಯ ಹೆಸರು 80 ಅಕ್ಷರಗಳಿಗಿಂತ ಕಡಿಮೆ ಇರಬೇಕು.',
}

const equipmentHi: Record<keyof typeof equipmentEn, string> = {
  'machineType.tractor': 'ट्रैक्टर',
  'machineType.trailer': 'ट्रेलर',
  'machineType.tractor_trailer': 'ट्रैक्टर + ट्रेलर',

  'equip.perTrip': 'प्रति फेरा',
  'equip.priceTrip': 'प्रति फेरा कीमत',
  'equip.unitTrip': 'फेरा',
  'machine.pricingPerTrip': 'प्रति फेरा',
  'equip.priceHintTrip': 'रुपयों में, एक फेरे के लिए।',

  'equip.driverModeLabel': 'ड्राइवर',
  'equip.driverModeHint': 'क्या आप ड्राइवर भेजते हैं, या किराए पर लेने वाला खुद चलाएगा?',
  'equip.driverWith': 'ड्राइवर के साथ',
  'equip.driverWithout': 'ड्राइवर के बिना',
  'equip.driverBoth': 'दोनों',
  'equip.driverExtraLabel': 'ड्राइवर के लिए अतिरिक्त (₹)',
  'equip.driverExtraHint': 'जब किराएदार आपका ड्राइवर चाहे तो कीमत में जुड़ेगा। मुफ़्त हो तो खाली छोड़ें।',
  'equip.cropsOptionalHint': 'वैकल्पिक। अगर कोई भी फसल ढो सकते हैं तो खाली छोड़ें।',

  'equip.badgeWith': 'ड्राइवर शामिल',
  'equip.badgeWithout': 'ड्राइवर के बिना',
  'equip.badgeBoth': 'ड्राइवर के साथ या बिना',
  'equip.extraForDriver': 'ड्राइवर के साथ +₹{amount} {unit}',

  'equip.chooseDriver': 'ड्राइवर',
  'equip.optionWithDriver': 'ड्राइवर के साथ',
  'equip.optionWithoutDriver': 'ड्राइवर के बिना',
  'equip.rateNow': 'दर: ₹{amount} {unit}',

  'equip.renterLabel': 'बुकिंग किसके लिए',
  'equip.renterFarmer': 'खेत',
  'equip.renterFactory': 'चीनी मिल',
  'equip.factoryLabel': 'मिल तक पहुँचाएँ (वैकल्पिक)',
  'equip.factoryHint': 'उस चीनी मिल का नाम जहाँ माल जाएगा।',

  'equip.qtyAcres': 'एकड़',
  'equip.qtyHours': 'घंटे',
  'equip.qtyDays': 'दिन',
  'equip.qtyTrips': 'फेरों की संख्या',

  'equip.driverYes': 'ड्राइवर: शामिल',
  'equip.driverNo': 'ड्राइवर: शामिल नहीं',
  'equip.destination': 'मिल',
  'equip.bookedAsFactory': 'चीनी मिल के लिए बुक किया गया',

  'equip.voiceDriver': 'क्या आप ड्राइवर के साथ देते हैं, ड्राइवर के बिना, या दोनों?',
  'equip.voiceDriverBad': 'कृपया बोलें: ड्राइवर के साथ, ड्राइवर के बिना, या दोनों।',

  'validation.driverMode': 'ड्राइवर के साथ, ड्राइवर के बिना या दोनों चुनें।',
  'validation.driverExtra': 'रुपयों में सही अतिरिक्त राशि डालें।',
  'validation.factory': 'मिल का नाम 80 अक्षरों या उससे कम का होना चाहिए।',
}

const equipmentTa: Record<keyof typeof equipmentEn, string> = {
  'machineType.tractor': 'டிராக்டர்',
  'machineType.trailer': 'டிரெய்லர்',
  'machineType.tractor_trailer': 'டிராக்டர் + டிரெய்லர்',

  'equip.perTrip': 'ஒரு நடைக்கு',
  'equip.priceTrip': 'ஒரு நடைக்கு விலை',
  'equip.unitTrip': 'நடை',
  'machine.pricingPerTrip': 'ஒரு நடை',
  'equip.priceHintTrip': 'ரூபாயில், ஒரு நடைக்கு.',

  'equip.driverModeLabel': 'ஓட்டுநர்',
  'equip.driverModeHint': 'நீங்கள் ஓட்டுநரை அனுப்புவீர்களா, அல்லது வாடகைக்கு எடுப்பவரே ஓட்டுவாரா?',
  'equip.driverWith': 'ஓட்டுநருடன்',
  'equip.driverWithout': 'ஓட்டுநர் இல்லாமல்',
  'equip.driverBoth': 'இரண்டும்',
  'equip.driverExtraLabel': 'ஓட்டுநருக்கு கூடுதல் (₹)',
  'equip.driverExtraHint': 'வாடகைதாரர் உங்கள் ஓட்டுநரை விரும்பினால் விலையில் சேரும். இலவசம் என்றால் காலியாக விடுங்கள்.',
  'equip.cropsOptionalHint': 'விருப்பம். எந்தப் பயிரையும் ஏற்றிச் செல்லலாம் என்றால் காலியாக விடுங்கள்.',

  'equip.badgeWith': 'ஓட்டுநர் உட்பட',
  'equip.badgeWithout': 'ஓட்டுநர் இல்லாமல்',
  'equip.badgeBoth': 'ஓட்டுநருடன் அல்லது இல்லாமல்',
  'equip.extraForDriver': 'ஓட்டுநருடன் +₹{amount} {unit}',

  'equip.chooseDriver': 'ஓட்டுநர்',
  'equip.optionWithDriver': 'ஓட்டுநருடன்',
  'equip.optionWithoutDriver': 'ஓட்டுநர் இல்லாமல்',
  'equip.rateNow': 'கட்டணம்: ₹{amount} {unit}',

  'equip.renterLabel': 'யாருக்கான முன்பதிவு',
  'equip.renterFarmer': 'வயல்',
  'equip.renterFactory': 'சர்க்கரை ஆலை',
  'equip.factoryLabel': 'ஆலைக்கு கொண்டு சேர்க்கவும் (விருப்பம்)',
  'equip.factoryHint': 'சரக்கு செல்லும் சர்க்கரை ஆலையின் பெயர்.',

  'equip.qtyAcres': 'ஏக்கர்',
  'equip.qtyHours': 'மணிநேரம்',
  'equip.qtyDays': 'நாட்கள்',
  'equip.qtyTrips': 'நடைகளின் எண்ணிக்கை',

  'equip.driverYes': 'ஓட்டுநர்: உட்பட',
  'equip.driverNo': 'ஓட்டுநர்: இல்லை',
  'equip.destination': 'ஆலை',
  'equip.bookedAsFactory': 'சர்க்கரை ஆலைக்காக முன்பதிவு',

  'equip.voiceDriver': 'ஓட்டுநருடன் கொடுக்கிறீர்களா, ஓட்டுநர் இல்லாமலா, அல்லது இரண்டுமா?',
  'equip.voiceDriverBad': 'தயவுசெய்து ஓட்டுநருடன், ஓட்டுநர் இல்லாமல் அல்லது இரண்டும் என்று சொல்லுங்கள்.',

  'validation.driverMode': 'ஓட்டுநருடன், ஓட்டுநர் இல்லாமல் அல்லது இரண்டையும் தேர்ந்தெடுக்கவும்.',
  'validation.driverExtra': 'ரூபாயில் சரியான கூடுதல் தொகையை உள்ளிடுங்கள்.',
  'validation.factory': 'ஆலையின் பெயர் 80 எழுத்துகளுக்குள் இருக்க வேண்டும்.',
}

export { equipmentEn, equipmentKn, equipmentHi, equipmentTa }
