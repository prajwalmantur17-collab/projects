// Optional profile photo texts. Placeholders must match in every language.

export const photoEn = {
  'photo.title': 'Profile photo',
  'photo.subtitle': 'Optional. Your photo helps people trust each other. It is shown to the person you have a booking with, and on the live map.',
  'photo.choose': 'Take or choose a photo',
  'photo.change': 'Change photo',
  'photo.remove': 'Remove photo',
  'photo.saved': 'Your photo is saved.',
  'photo.removed': 'Your photo was removed.',
  'photo.error': 'We could not save the photo. Please try a smaller picture.',
} as const

export const photoKn: Record<keyof typeof photoEn, string> = {
  'photo.title': 'ಪ್ರೊಫೈಲ್ ಫೋಟೋ',
  'photo.subtitle': 'ಐಚ್ಛಿಕ. ನಿಮ್ಮ ಫೋಟೋ ಜನರ ನಡುವೆ ನಂಬಿಕೆ ಮೂಡಿಸುತ್ತದೆ. ಬುಕಿಂಗ್ ಇರುವ ವ್ಯಕ್ತಿಗೆ ಮತ್ತು ಲೈವ್ ನಕ್ಷೆಯಲ್ಲಿ ಇದು ಕಾಣುತ್ತದೆ.',
  'photo.choose': 'ಫೋಟೋ ತೆಗೆಯಿರಿ ಅಥವಾ ಆರಿಸಿ',
  'photo.change': 'ಫೋಟೋ ಬದಲಿಸಿ',
  'photo.remove': 'ಫೋಟೋ ತೆಗೆಯಿರಿ',
  'photo.saved': 'ನಿಮ್ಮ ಫೋಟೋ ಉಳಿಸಲಾಗಿದೆ.',
  'photo.removed': 'ನಿಮ್ಮ ಫೋಟೋ ತೆಗೆಯಲಾಗಿದೆ.',
  'photo.error': 'ಫೋಟೋ ಉಳಿಸಲು ಆಗಲಿಲ್ಲ. ದಯವಿಟ್ಟು ಚಿಕ್ಕ ಚಿತ್ರವನ್ನು ಪ್ರಯತ್ನಿಸಿ.',
}

export const photoHi: Record<keyof typeof photoEn, string> = {
  'photo.title': 'प्रोफ़ाइल फ़ोटो',
  'photo.subtitle': 'वैकल्पिक। आपकी फ़ोटो से लोगों में भरोसा बढ़ता है। यह उस व्यक्ति को दिखती है जिससे आपकी बुकिंग है, और लाइव नक्शे पर भी।',
  'photo.choose': 'फ़ोटो खींचें या चुनें',
  'photo.change': 'फ़ोटो बदलें',
  'photo.remove': 'फ़ोटो हटाएं',
  'photo.saved': 'आपकी फ़ोटो सहेज ली गई।',
  'photo.removed': 'आपकी फ़ोटो हटा दी गई।',
  'photo.error': 'फ़ोटो सहेज नहीं सके। कृपया छोटी तस्वीर आज़माएं।',
}
