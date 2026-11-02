// Crop-from-photo texts. Placeholders must match in every language.

export const cropPhotoEn = {
  'cropPhoto.button': 'Take a photo of your crop',
  'cropPhoto.hint': 'The app guesses the crop from the photo. You confirm it.',
  'cropPhoto.analysing': 'Looking at your photo...',
  'cropPhoto.ask': 'This looks like {crop}. Is that right?',
  'cropPhoto.askUnsure': 'This might be {crop}, but we are not sure. Is that right?',
  'cropPhoto.yes': 'Yes',
  'cropPhoto.no': 'No',
  'cropPhoto.pickOther': 'Which crop is it?',
  'cropPhoto.cannotTell': 'We could not tell the crop. Please choose it yourself.',
  'cropPhoto.unavailable': 'Photo check is not available right now. Please choose the crop yourself.',
  'cropPhoto.selected': 'Crop selected: {crop}',
  'cropPicker.open': 'All crops',
  'cropPicker.title': 'Choose your crop',
  'cropPicker.hint': 'Tap the picture of your crop.',
} as const

export const cropPhotoKn: Record<keyof typeof cropPhotoEn, string> = {
  'cropPhoto.button': 'ನಿಮ್ಮ ಬೆಳೆಯ ಫೋಟೋ ತೆಗೆಯಿರಿ',
  'cropPhoto.hint': 'ಆ್ಯಪ್ ಫೋಟೋದಿಂದ ಬೆಳೆಯನ್ನು ಊಹಿಸುತ್ತದೆ. ನೀವು ಖಚಿತಪಡಿಸಿ.',
  'cropPhoto.analysing': 'ನಿಮ್ಮ ಫೋಟೋ ನೋಡುತ್ತಿದ್ದೇವೆ...',
  'cropPhoto.ask': 'ಇದು {crop} ಅನ್ನಿಸುತ್ತದೆ. ಸರಿಯೇ?',
  'cropPhoto.askUnsure': 'ಇದು {crop} ಇರಬಹುದು, ಆದರೆ ಖಚಿತವಿಲ್ಲ. ಸರಿಯೇ?',
  'cropPhoto.yes': 'ಹೌದು',
  'cropPhoto.no': 'ಇಲ್ಲ',
  'cropPhoto.pickOther': 'ಇದು ಯಾವ ಬೆಳೆ?',
  'cropPhoto.cannotTell': 'ಬೆಳೆ ಗುರುತಿಸಲು ಆಗಲಿಲ್ಲ. ದಯವಿಟ್ಟು ನೀವೇ ಆರಿಸಿ.',
  'cropPhoto.unavailable': 'ಫೋಟೋ ಪರಿಶೀಲನೆ ಈಗ ಲಭ್ಯವಿಲ್ಲ. ದಯವಿಟ್ಟು ಬೆಳೆಯನ್ನು ನೀವೇ ಆರಿಸಿ.',
  'cropPhoto.selected': 'ಬೆಳೆ ಆಯ್ಕೆಯಾಗಿದೆ: {crop}',
  'cropPicker.open': 'ಎಲ್ಲಾ ಬೆಳೆಗಳು',
  'cropPicker.title': 'ನಿಮ್ಮ ಬೆಳೆಯನ್ನು ಆರಿಸಿ',
  'cropPicker.hint': 'ನಿಮ್ಮ ಬೆಳೆಯ ಚಿತ್ರವನ್ನು ಒತ್ತಿ.',
}

export const cropPhotoHi: Record<keyof typeof cropPhotoEn, string> = {
  'cropPhoto.button': 'अपनी फसल की फ़ोटो खींचें',
  'cropPhoto.hint': 'ऐप फ़ोटो से फसल का अंदाज़ा लगाता है। आप पुष्टि करें।',
  'cropPhoto.analysing': 'आपकी फ़ोटो देख रहे हैं...',
  'cropPhoto.ask': 'यह {crop} लगती है। क्या यह सही है?',
  'cropPhoto.askUnsure': 'यह {crop} हो सकती है, पर पक्का नहीं। क्या यह सही है?',
  'cropPhoto.yes': 'हाँ',
  'cropPhoto.no': 'नहीं',
  'cropPhoto.pickOther': 'यह कौन सी फसल है?',
  'cropPhoto.cannotTell': 'फसल पहचान नहीं सके। कृपया खुद चुनें।',
  'cropPhoto.unavailable': 'फ़ोटो जाँच अभी उपलब्ध नहीं है। कृपया फसल खुद चुनें।',
  'cropPhoto.selected': 'फसल चुनी गई: {crop}',
  'cropPicker.open': 'सभी फसलें',
  'cropPicker.title': 'अपनी फसल चुनें',
  'cropPicker.hint': 'अपनी फसल की तस्वीर दबाएं।',
}

export const cropPhotoTa: Record<keyof typeof cropPhotoEn, string> = {
  'cropPhoto.button': 'உங்கள் பயிரின் புகைப்படம் எடுங்கள்',
  'cropPhoto.hint': 'புகைப்படத்திலிருந்து பயிரை ஆப் ஊகிக்கும். நீங்கள் உறுதிப்படுத்துங்கள்.',
  'cropPhoto.analysing': 'உங்கள் புகைப்படத்தைப் பார்க்கிறோம்...',
  'cropPhoto.ask': 'இது {crop} போலத் தெரிகிறது. சரியா?',
  'cropPhoto.askUnsure': 'இது {crop} ஆக இருக்கலாம், ஆனால் உறுதியில்லை. சரியா?',
  'cropPhoto.yes': 'ஆம்',
  'cropPhoto.no': 'இல்லை',
  'cropPhoto.pickOther': 'இது எந்தப் பயிர்?',
  'cropPhoto.cannotTell': 'பயிரைக் கண்டறிய முடியவில்லை. நீங்களே தேர்ந்தெடுங்கள்.',
  'cropPhoto.unavailable': 'புகைப்பட சரிபார்ப்பு இப்போது கிடைக்கவில்லை. பயிரை நீங்களே தேர்ந்தெடுங்கள்.',
  'cropPhoto.selected': 'பயிர் தேர்ந்தெடுக்கப்பட்டது: {crop}',
  'cropPicker.open': 'எல்லாப் பயிர்களும்',
  'cropPicker.title': 'உங்கள் பயிரைத் தேர்ந்தெடுக்கவும்',
  'cropPicker.hint': 'உங்கள் பயிரின் படத்தைத் தொடுங்கள்.',
}
