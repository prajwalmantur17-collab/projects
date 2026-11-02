const vfEn = {
  'vf.cta.book': 'Book by speaking',
  'vf.cta.machine': 'Fill by speaking',
  'vf.cta.requests': 'Answer requests by speaking',
  'vf.title.book': 'Book by voice',
  'vf.title.machine': 'Add machine by voice',
  'vf.title.requests': 'Requests by voice',
  'vf.status.speaking': 'Listen…',
  'vf.status.listening': 'Speak now…',
  'vf.status.working': 'Please wait…',
  'vf.status.done': 'Done',
  'vf.status.stopped': 'Voice stopped',
  'vf.heard': 'You said: {text}',
  'vf.repeat': 'Repeat',
  'vf.skip': 'Skip',
  'vf.close': 'Close',
  'vf.unsupported':
    'This browser cannot listen to your voice. Please open this website in Google Chrome, or fill the form by typing.',
  'vf.micDenied':
    'The microphone is blocked. Allow the microphone for this website in your browser settings, then try again.',
  'vf.networkError': 'Voice needs internet. Please check your connection and try again.',
  'vf.noSpeech': 'I could not hear you. Please speak again.',
  'vf.notUnderstood': 'Sorry, I did not understand. Please say it again.',
  'vf.tooManyTries': 'Okay, we will skip this one. You can type it in the form.',
  'vf.gotIt': 'Got it: {value}.',
  'vf.confirmAsk': 'You said {value}. Is that correct? Say yes or no.',
  'vf.confirmRetry': 'Okay, let us try again.',
  'vf.yesNoRetry': 'Please say yes or no.',
  'vf.finished': 'All done. You can close this window.',
  'vf.genericError': 'Something went wrong. Please try again or use the form.',
  'vf.incomplete':
    'Some answers are missing. Please look at the form, fill the rest, and press the button yourself.',
  'vf.noVoice':
    'This phone cannot speak this language aloud. The questions are shown on the screen. You can still answer by speaking.',

  'vf.book.intro':
    'I will help you book this machine. I will ask a few questions. Please answer one by one.',
  'vf.book.date':
    'On which day do you need the machine? You can say tomorrow, or a date like 15 November.',
  'vf.book.dateBad':
    'I did not understand the date. Please say tomorrow, or a date like 15 November.',
  'vf.book.datePast': 'That day has already passed. Please say today or a later day.',
  'vf.book.village': 'In which village is your farm? Say the village name.',
  'vf.book.villageBad': 'Please say the village name again.',
  'vf.book.acreage': 'How many acres do you want harvested? Say a number, for example 5.',
  'vf.book.acreageBad': 'Please say the acres as a number, for example 5 or 2 and a half.',
  'vf.book.crop': 'Which crop do you grow? You can say: {crops}.',
  'vf.book.cropBad': 'This machine works on: {crops}. Please say one of these.',
  'vf.book.phone': 'Please say your 10 digit mobile number. The owner will call you on it.',
  'vf.book.phoneBad':
    'I could not get a 10 digit number. Please say the digits slowly, one by one.',
  'vf.book.summary':
    'Booking {machine} on {date} in {village}. {acres} acres of {crop}. Your phone number is {phone}. Shall I send the request? Say yes or no.',
  'vf.book.sent': 'Your request was sent. The owner will call you after seeing it.',
  'vf.book.notSent': 'Okay, I did not send it. You can check the form and send it yourself.',
  'vf.book.signIn': 'Please sign in as a farmer to book this machine.',

  'vf.machine.intro':
    'I will help you add your machine. I will ask a few questions. Please answer one by one.',
  'vf.machine.type':
    'Which machine do you have? You can say combine harvester, tractor harvester, reaper, thresher or baler.',
  'vf.machine.typeBad':
    'I did not understand. Please say combine harvester, tractor harvester, reaper, thresher or baler.',
  'vf.machine.unit': 'How do you charge: per acre, per hour or per day?',
  'vf.machine.unitBad': 'Please say per acre, per hour or per day.',
  'vf.machine.price':
    'What is your rate {unit}, in rupees? Say a number, for example 2500.',
  'vf.machine.priceBad': 'Please say the rate as a number, for example 2500.',
  'vf.machine.crops':
    'For which crops can your machine work? Say the crop names, for example wheat and rice. Or say all.',
  'vf.machine.cropsBad':
    'I did not hear a crop name. Please say crops like wheat, rice or maize.',
  'vf.machine.village': 'In which village is your machine kept? Say the village name.',
  'vf.machine.district': 'Which district is that village in?',
  'vf.machine.state': 'Which state?',
  'vf.machine.placeBad': 'Please say it again.',
  'vf.machine.phone':
    'Please say your 10 digit mobile number. Farmers will call you on it.',
  'vf.machine.summary':
    'Machine: {type}. Rate {price} rupees {unit}. Crops: {crops}. Village {village}, district {district}, state {state}. Phone {phone}. Shall I save this machine? Say yes or no.',
  'vf.machine.saved':
    'Your machine is saved. Farmers can now find it. You can add a photo later by editing the machine.',
  'vf.machine.notSaved': 'Okay, I did not save it. You can check the form and save it yourself.',

  'vf.requests.none': 'You have no new requests.',
  'vf.requests.intro': 'You have {count} new requests. I will read them one by one.',
  'vf.requests.item':
    'Request {n} of {total}. {farmer} wants {machine} on {date}, {acres} acres of {crop}, in {village}. Do you want to accept it? Say yes to accept, no to reject, or skip.',
  'vf.requests.confirmAccept':
    'You want to accept this request. Is that correct? Say yes or no.',
  'vf.requests.confirmReject':
    'You want to reject this request. Is that correct? Say yes or no.',
  'vf.cta.notify': 'Notify by speaking',
  'vf.title.notify': 'Notify when free',
  'vf.notify.intro':
    'I will help you set an alert when this machine is free.',
  'vf.notify.prompt':
    'This {machine} is busy right now. Do you want an alert as soon as it is free? Say yes or no.',
  'vf.notify.confirmYes':
    'You want an alert when this machine is free. Is that correct? Say yes or no.',
  'vf.notify.confirmNo':
    'You do not want an alert. Is that correct? Say yes or no.',
  'vf.notify.cancelled':
    'Okay, I did not set an alert. You can tap the button yourself.',
}

const vfKn: Record<keyof typeof vfEn, string> = {
  'vf.cta.book': 'ಮಾತಿನಿಂದ ಬುಕ್ ಮಾಡಿ',
  'vf.cta.machine': 'ಮಾತಿನಿಂದ ತುಂಬಿ',
  'vf.cta.requests': 'ಮಾತಿನಿಂದ ವಿನಂತಿಗಳಿಗೆ ಉತ್ತರಿಸಿ',
  'vf.title.book': 'ಧ್ವನಿಯಿಂದ ಬುಕಿಂಗ್',
  'vf.title.machine': 'ಧ್ವನಿಯಿಂದ ಯಂತ್ರ ಸೇರಿಸಿ',
  'vf.title.requests': 'ಧ್ವನಿಯಿಂದ ವಿನಂತಿಗಳು',
  'vf.status.speaking': 'ಕೇಳಿ…',
  'vf.status.listening': 'ಈಗ ಮಾತನಾಡಿ…',
  'vf.status.working': 'ದಯವಿಟ್ಟು ಕಾಯಿರಿ…',
  'vf.status.done': 'ಆಯಿತು',
  'vf.status.stopped': 'ಧ್ವನಿ ನಿಂತಿದೆ',
  'vf.heard': 'ನೀವು ಹೇಳಿದ್ದು: {text}',
  'vf.repeat': 'ಮತ್ತೆ',
  'vf.skip': 'ಬಿಡಿ',
  'vf.close': 'ಮುಚ್ಚಿ',
  'vf.unsupported':
    'ಈ ಬ್ರೌಸರ್ ನಿಮ್ಮ ಧ್ವನಿಯನ್ನು ಕೇಳಲು ಸಾಧ್ಯವಿಲ್ಲ. ದಯವಿಟ್ಟು ಈ ವೆಬ್‌ಸೈಟ್ ಅನ್ನು Google Chrome ನಲ್ಲಿ ತೆರೆಯಿರಿ, ಅಥವಾ ಫಾರ್ಮ್ ಅನ್ನು ಬರೆದು ತುಂಬಿ.',
  'vf.micDenied':
    'ಮೈಕ್ರೊಫೋನ್ ಬಂದ್ ಆಗಿದೆ. ಬ್ರೌಸರ್ ಸೆಟ್ಟಿಂಗ್‌ನಲ್ಲಿ ಈ ವೆಬ್‌ಸೈಟ್‌ಗೆ ಮೈಕ್ರೊಫೋನ್ ಅನುಮತಿ ನೀಡಿ, ನಂತರ ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.',
  'vf.networkError': 'ಧ್ವನಿಗೆ ಇಂಟರ್ನೆಟ್ ಬೇಕು. ದಯವಿಟ್ಟು ಸಂಪರ್ಕ ಪರಿಶೀಲಿಸಿ ಮತ್ತು ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.',
  'vf.noSpeech': 'ನಿಮ್ಮ ಧ್ವನಿ ಕೇಳಿಸಲಿಲ್ಲ. ದಯವಿಟ್ಟು ಮತ್ತೆ ಮಾತನಾಡಿ.',
  'vf.notUnderstood': 'ಕ್ಷಮಿಸಿ, ನನಗೆ ಅರ್ಥವಾಗಲಿಲ್ಲ. ದಯವಿಟ್ಟು ಮತ್ತೆ ಹೇಳಿ.',
  'vf.tooManyTries': 'ಸರಿ, ಇದನ್ನು ಬಿಡೋಣ. ನೀವು ಇದನ್ನು ಫಾರ್ಮ್‌ನಲ್ಲಿ ಬರೆಯಬಹುದು.',
  'vf.gotIt': 'ಅರ್ಥವಾಯಿತು: {value}.',
  'vf.confirmAsk': 'ನೀವು {value} ಎಂದು ಹೇಳಿದಿರಿ. ಇದು ಸರಿಯೇ? ಹೌದು ಅಥವಾ ಇಲ್ಲ ಎಂದು ಹೇಳಿ.',
  'vf.confirmRetry': 'ಸರಿ, ಮತ್ತೆ ಪ್ರಯತ್ನಿಸೋಣ.',
  'vf.yesNoRetry': 'ದಯವಿಟ್ಟು ಹೌದು ಅಥವಾ ಇಲ್ಲ ಎಂದು ಹೇಳಿ.',
  'vf.finished': 'ಎಲ್ಲಾ ಆಯಿತು. ನೀವು ಈ ವಿಂಡೋ ಮುಚ್ಚಬಹುದು.',
  'vf.genericError': 'ಏನೋ ತಪ್ಪಾಯಿತು. ದಯವಿಟ್ಟು ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ ಅಥವಾ ಫಾರ್ಮ್ ಬಳಸಿ.',
  'vf.incomplete':
    'ಕೆಲವು ಉತ್ತರಗಳು ಇಲ್ಲ. ದಯವಿಟ್ಟು ಫಾರ್ಮ್ ನೋಡಿ, ಉಳಿದದ್ದನ್ನು ತುಂಬಿ, ಮತ್ತು ಬಟನ್ ಅನ್ನು ನೀವೇ ಒತ್ತಿ.',
  'vf.noVoice':
    'ಈ ಫೋನ್ ಈ ಭಾಷೆಯಲ್ಲಿ ಮಾತನಾಡಲು ಸಾಧ್ಯವಿಲ್ಲ. ಪ್ರಶ್ನೆಗಳು ಪರದೆಯ ಮೇಲೆ ಕಾಣುತ್ತವೆ. ನೀವು ಮಾತಿನಲ್ಲಿ ಉತ್ತರಿಸಬಹುದು.',

  'vf.book.intro':
    'ಈ ಯಂತ್ರವನ್ನು ಬುಕ್ ಮಾಡಲು ನಾನು ಸಹಾಯ ಮಾಡುತ್ತೇನೆ. ಕೆಲವು ಪ್ರಶ್ನೆಗಳನ್ನು ಕೇಳುತ್ತೇನೆ. ದಯವಿಟ್ಟು ಒಂದೊಂದಾಗಿ ಉತ್ತರಿಸಿ.',
  'vf.book.date':
    'ನಿಮಗೆ ಯಂತ್ರ ಯಾವ ದಿನ ಬೇಕು? ನಾಳೆ ಎಂದು ಹೇಳಬಹುದು, ಅಥವಾ 15 ನವೆಂಬರ್ ಅಂತಹ ದಿನಾಂಕ.',
  'vf.book.dateBad':
    'ದಿನಾಂಕ ಅರ್ಥವಾಗಲಿಲ್ಲ. ದಯವಿಟ್ಟು ನಾಳೆ ಎಂದು ಹೇಳಿ, ಅಥವಾ 15 ನವೆಂಬರ್ ಅಂತಹ ದಿನಾಂಕ ಹೇಳಿ.',
  'vf.book.datePast': 'ಆ ದಿನ ಕಳೆದುಹೋಗಿದೆ. ದಯವಿಟ್ಟು ಇಂದು ಅಥವಾ ನಂತರದ ದಿನ ಹೇಳಿ.',
  'vf.book.village': 'ನಿಮ್ಮ ಹೊಲ ಯಾವ ಊರಿನಲ್ಲಿದೆ? ಊರಿನ ಹೆಸರು ಹೇಳಿ.',
  'vf.book.villageBad': 'ದಯವಿಟ್ಟು ಊರಿನ ಹೆಸರನ್ನು ಮತ್ತೆ ಹೇಳಿ.',
  'vf.book.acreage': 'ನಿಮಗೆ ಎಷ್ಟು ಎಕರೆ ಕೊಯ್ಲು ಮಾಡಿಸಬೇಕು? ಒಂದು ಸಂಖ್ಯೆ ಹೇಳಿ, ಉದಾಹರಣೆಗೆ 5.',
  'vf.book.acreageBad':
    'ದಯವಿಟ್ಟು ಎಕರೆಯನ್ನು ಸಂಖ್ಯೆಯಲ್ಲಿ ಹೇಳಿ, ಉದಾಹರಣೆಗೆ 5 ಅಥವಾ ಎರಡೂವರೆ.',
  'vf.book.crop': 'ನೀವು ಯಾವ ಬೆಳೆ ಬೆಳೆಯುತ್ತೀರಿ? ನೀವು ಹೇಳಬಹುದು: {crops}.',
  'vf.book.cropBad': 'ಈ ಯಂತ್ರ ಈ ಬೆಳೆಗಳಿಗೆ ಕೆಲಸ ಮಾಡುತ್ತದೆ: {crops}. ದಯವಿಟ್ಟು ಇವುಗಳಲ್ಲಿ ಒಂದನ್ನು ಹೇಳಿ.',
  'vf.book.phone':
    'ದಯವಿಟ್ಟು ನಿಮ್ಮ 10 ಅಂಕಿಯ ಮೊಬೈಲ್ ಸಂಖ್ಯೆ ಹೇಳಿ. ಮಾಲೀಕರು ಇದಕ್ಕೆ ಕರೆ ಮಾಡುತ್ತಾರೆ.',
  'vf.book.phoneBad':
    '10 ಅಂಕಿಯ ಸಂಖ್ಯೆ ಸಿಗಲಿಲ್ಲ. ದಯವಿಟ್ಟು ಅಂಕಿಗಳನ್ನು ನಿಧಾನವಾಗಿ, ಒಂದೊಂದಾಗಿ ಹೇಳಿ.',
  'vf.book.summary':
    '{machine} ಬುಕಿಂಗ್ {date} ರಂದು, ಊರು {village}. {acres} ಎಕರೆ {crop}. ನಿಮ್ಮ ಫೋನ್ ಸಂಖ್ಯೆ {phone}. ವಿನಂತಿ ಕಳುಹಿಸಲೇ? ಹೌದು ಅಥವಾ ಇಲ್ಲ ಎಂದು ಹೇಳಿ.',
  'vf.book.sent': 'ನಿಮ್ಮ ವಿನಂತಿ ಕಳುಹಿಸಲಾಗಿದೆ. ಮಾಲೀಕರು ನೋಡಿದ ನಂತರ ನಿಮಗೆ ಕರೆ ಮಾಡುತ್ತಾರೆ.',
  'vf.book.notSent': 'ಸರಿ, ನಾನು ಕಳುಹಿಸಿಲ್ಲ. ನೀವು ಫಾರ್ಮ್ ನೋಡಿ ನೀವೇ ಕಳುಹಿಸಬಹುದು.',
  'vf.book.signIn': 'ಈ ಯಂತ್ರವನ್ನು ಬುಕ್ ಮಾಡಲು ದಯವಿಟ್ಟು ರೈತರಾಗಿ ಸೈನ್ ಇನ್ ಮಾಡಿ.',

  'vf.machine.intro':
    'ನಿಮ್ಮ ಯಂತ್ರವನ್ನು ಸೇರಿಸಲು ನಾನು ಸಹಾಯ ಮಾಡುತ್ತೇನೆ. ಕೆಲವು ಪ್ರಶ್ನೆಗಳನ್ನು ಕೇಳುತ್ತೇನೆ. ದಯವಿಟ್ಟು ಒಂದೊಂದಾಗಿ ಉತ್ತರಿಸಿ.',
  'vf.machine.type':
    'ನಿಮ್ಮ ಬಳಿ ಯಾವ ಯಂತ್ರ ಇದೆ? ನೀವು ಹೇಳಬಹುದು ಕಂಬೈನ್ ಹಾರ್ವೆಸ್ಟರ್, ಟ್ರ್ಯಾಕ್ಟರ್ ಹಾರ್ವೆಸ್ಟರ್, ರೀಪರ್, ಥ್ರೆಶರ್ ಅಥವಾ ಬೇಲರ್.',
  'vf.machine.typeBad':
    'ಅರ್ಥವಾಗಲಿಲ್ಲ. ದಯವಿಟ್ಟು ಕಂಬೈನ್ ಹಾರ್ವೆಸ್ಟರ್, ಟ್ರ್ಯಾಕ್ಟರ್ ಹಾರ್ವೆಸ್ಟರ್, ರೀಪರ್, ಥ್ರೆಶರ್ ಅಥವಾ ಬೇಲರ್ ಎಂದು ಹೇಳಿ.',
  'vf.machine.unit': 'ನೀವು ಹೇಗೆ ದರ ತೆಗೆದುಕೊಳ್ಳುತ್ತೀರಿ: ಎಕರೆಗೆ, ಗಂಟೆಗೆ ಅಥವಾ ದಿನಕ್ಕೆ?',
  'vf.machine.unitBad': 'ದಯವಿಟ್ಟು ಎಕರೆಗೆ, ಗಂಟೆಗೆ ಅಥವಾ ದಿನಕ್ಕೆ ಎಂದು ಹೇಳಿ.',
  'vf.machine.price':
    '{unit} ನಿಮ್ಮ ದರ ಎಷ್ಟು ರೂಪಾಯಿ? ಒಂದು ಸಂಖ್ಯೆ ಹೇಳಿ, ಉದಾಹರಣೆಗೆ 2500.',
  'vf.machine.priceBad': 'ದಯವಿಟ್ಟು ದರವನ್ನು ಸಂಖ್ಯೆಯಲ್ಲಿ ಹೇಳಿ, ಉದಾಹರಣೆಗೆ 2500.',
  'vf.machine.crops':
    'ನಿಮ್ಮ ಯಂತ್ರ ಯಾವ ಬೆಳೆಗಳಿಗೆ ಕೆಲಸ ಮಾಡುತ್ತದೆ? ಬೆಳೆಗಳ ಹೆಸರು ಹೇಳಿ, ಉದಾಹರಣೆಗೆ ಗೋಧಿ ಮತ್ತು ಭತ್ತ. ಅಥವಾ ಎಲ್ಲಾ ಎಂದು ಹೇಳಿ.',
  'vf.machine.cropsBad':
    'ಬೆಳೆಯ ಹೆಸರು ಕೇಳಿಸಲಿಲ್ಲ. ದಯವಿಟ್ಟು ಗೋಧಿ, ಭತ್ತ ಅಥವಾ ಮೆಕ್ಕೆಜೋಳದಂತಹ ಹೆಸರು ಹೇಳಿ.',
  'vf.machine.village': 'ನಿಮ್ಮ ಯಂತ್ರ ಯಾವ ಊರಿನಲ್ಲಿದೆ? ಊರಿನ ಹೆಸರು ಹೇಳಿ.',
  'vf.machine.district': 'ಆ ಊರು ಯಾವ ಜಿಲ್ಲೆಯಲ್ಲಿದೆ?',
  'vf.machine.state': 'ಯಾವ ರಾಜ್ಯ?',
  'vf.machine.placeBad': 'ದಯವಿಟ್ಟು ಮತ್ತೆ ಹೇಳಿ.',
  'vf.machine.phone':
    'ದಯವಿಟ್ಟು ನಿಮ್ಮ 10 ಅಂಕಿಯ ಮೊಬೈಲ್ ಸಂಖ್ಯೆ ಹೇಳಿ. ರೈತರು ಇದಕ್ಕೆ ಕರೆ ಮಾಡುತ್ತಾರೆ.',
  'vf.machine.summary':
    'ಯಂತ್ರ: {type}. ದರ {unit} {price} ರೂಪಾಯಿ. ಬೆಳೆಗಳು: {crops}. ಊರು {village}, ಜಿಲ್ಲೆ {district}, ರಾಜ್ಯ {state}. ಫೋನ್ {phone}. ಈ ಯಂತ್ರವನ್ನು ಉಳಿಸಲೇ? ಹೌದು ಅಥವಾ ಇಲ್ಲ ಎಂದು ಹೇಳಿ.',
  'vf.machine.saved':
    'ನಿಮ್ಮ ಯಂತ್ರ ಉಳಿಸಲಾಗಿದೆ. ಈಗ ರೈತರು ಇದನ್ನು ಹುಡುಕಬಹುದು. ಫೋಟೋವನ್ನು ನೀವು ನಂತರ ಯಂತ್ರವನ್ನು ಬದಲಿಸಿ ಸೇರಿಸಬಹುದು.',
  'vf.machine.notSaved': 'ಸರಿ, ನಾನು ಉಳಿಸಿಲ್ಲ. ನೀವು ಫಾರ್ಮ್ ನೋಡಿ ನೀವೇ ಉಳಿಸಬಹುದು.',

  'vf.requests.none': 'ನಿಮಗೆ ಯಾವುದೇ ಹೊಸ ವಿನಂತಿ ಇಲ್ಲ.',
  'vf.requests.intro': 'ನಿಮಗೆ {count} ಹೊಸ ವಿನಂತಿಗಳಿವೆ. ನಾನು ಒಂದೊಂದಾಗಿ ಓದುತ್ತೇನೆ.',
  'vf.requests.item':
    'ವಿನಂತಿ {n} / {total}. {farmer} ಅವರಿಗೆ {date} ರಂದು {machine} ಬೇಕು, {acres} ಎಕರೆ {crop}, ಊರು {village}. ನೀವು ಇದನ್ನು ಒಪ್ಪುತ್ತೀರಾ? ಒಪ್ಪಲು ಹೌದು, ತಿರಸ್ಕರಿಸಲು ಇಲ್ಲ, ಅಥವಾ ಬಿಡಿ ಎಂದು ಹೇಳಿ.',
  'vf.requests.confirmAccept':
    'ನೀವು ಈ ವಿನಂತಿಯನ್ನು ಒಪ್ಪಲು ಬಯಸುತ್ತೀರಿ. ಇದು ಸರಿಯೇ? ಹೌದು ಅಥವಾ ಇಲ್ಲ ಎಂದು ಹೇಳಿ.',
  'vf.requests.confirmReject':
    'ನೀವು ಈ ವಿನಂತಿಯನ್ನು ತಿರಸ್ಕರಿಸಲು ಬಯಸುತ್ತೀರಿ. ಇದು ಸರಿಯೇ? ಹೌದು ಅಥವಾ ಇಲ್ಲ ಎಂದು ಹೇಳಿ.',
  'vf.cta.notify': 'ಮಾತನಾಡಿ ತಿಳಿಸಲು ಕೇಳಿ',
  'vf.title.notify': 'ಖಾಲಿಯಾದಾಗ ತಿಳಿಸಿ',
  'vf.notify.intro':
    'ಈ ಯಂತ್ರ ಖಾಲಿಯಾದಾಗ ನಿಮಗೆ ಸೂಚನೆ ನೀಡಲು ನಾನು ಸಹಾಯ ಮಾಡುತ್ತೇನೆ.',
  'vf.notify.prompt':
    'ಈ {machine} ಈಗ ಬೇರೆ ಕೆಲಸದಲ್ಲಿದೆ. ಖಾಲಿಯಾದ ತಕ್ಷಣ ನಿಮಗೆ ತಿಳಿಸಬೇಕೇ? ಹೌದು ಅಥವಾ ಇಲ್ಲ ಎಂದು ಹೇಳಿ.',
  'vf.notify.confirmYes':
    'ಈ ಯಂತ್ರ ಖಾಲಿಯಾದಾಗ ನಿಮಗೆ ತಿಳಿಸಲು ನೀವು ಬಯಸುತ್ತೀರಿ. ಇದು ಸರಿಯೇ? ಹೌದು ಅಥವಾ ಇಲ್ಲ ಎಂದು ಹೇಳಿ.',
  'vf.notify.confirmNo':
    'ನಿಮಗೆ ಸೂಚನೆ ಬೇಡ. ಇದು ಸರಿಯೇ? ಹೌದು ಅಥವಾ ಇಲ್ಲ ಎಂದು ಹೇಳಿ.',
  'vf.notify.cancelled':
    'ಸರಿ, ನಾನು ಸೂಚನೆ ಹೊಂದಿಸಿಲ್ಲ. ನೀವೇ ಬಟನ್ ಒತ್ತಬಹುದು.',
}

const vfHi: Record<keyof typeof vfEn, string> = {
  'vf.cta.book': 'बोलकर बुक करें',
  'vf.cta.machine': 'बोलकर भरें',
  'vf.cta.requests': 'बोलकर अनुरोधों का जवाब दें',
  'vf.title.book': 'आवाज़ से बुकिंग',
  'vf.title.machine': 'आवाज़ से मशीन जोड़ें',
  'vf.title.requests': 'आवाज़ से अनुरोध',
  'vf.status.speaking': 'सुनिए…',
  'vf.status.listening': 'अब बोलिए…',
  'vf.status.working': 'कृपया रुकिए…',
  'vf.status.done': 'हो गया',
  'vf.status.stopped': 'आवाज़ बंद हो गई',
  'vf.heard': 'आपने कहा: {text}',
  'vf.repeat': 'फिर से',
  'vf.skip': 'छोड़ें',
  'vf.close': 'बंद करें',
  'vf.unsupported':
    'यह ब्राउज़र आपकी आवाज़ नहीं सुन सकता। कृपया यह वेबसाइट Google Chrome में खोलें, या फ़ॉर्म लिखकर भरें।',
  'vf.micDenied':
    'माइक्रोफ़ोन बंद है। ब्राउज़र की सेटिंग में इस वेबसाइट के लिए माइक्रोफ़ोन की अनुमति दें, फिर कोशिश करें।',
  'vf.networkError': 'आवाज़ के लिए इंटरनेट चाहिए। कृपया कनेक्शन जाँचें और फिर कोशिश करें।',
  'vf.noSpeech': 'मुझे आपकी आवाज़ नहीं सुनाई दी। कृपया फिर बोलिए।',
  'vf.notUnderstood': 'माफ़ कीजिए, मैं समझा नहीं। कृपया फिर से बोलिए।',
  'vf.tooManyTries': 'ठीक है, इसे छोड़ देते हैं। आप इसे फ़ॉर्म में लिख सकते हैं।',
  'vf.gotIt': 'समझ गया: {value}।',
  'vf.confirmAsk': 'आपने कहा {value}। क्या यह सही है? हाँ या नहीं बोलिए।',
  'vf.confirmRetry': 'ठीक है, फिर से कोशिश करते हैं।',
  'vf.yesNoRetry': 'कृपया हाँ या नहीं बोलिए।',
  'vf.finished': 'सब हो गया। आप यह विंडो बंद कर सकते हैं।',
  'vf.genericError': 'कुछ गड़बड़ हो गई। कृपया फिर कोशिश करें या फ़ॉर्म इस्तेमाल करें।',
  'vf.incomplete':
    'कुछ जवाब नहीं मिले। कृपया फ़ॉर्म देखें, बाकी भरें, और बटन खुद दबाएँ।',
  'vf.noVoice':
    'यह फ़ोन इस भाषा में बोल नहीं सकता। सवाल स्क्रीन पर दिखेंगे। आप फिर भी बोलकर जवाब दे सकते हैं।',

  'vf.book.intro':
    'मैं इस मशीन की बुकिंग में आपकी मदद करूँगा। मैं कुछ सवाल पूछूँगा। कृपया एक-एक करके जवाब दीजिए।',
  'vf.book.date':
    'आपको मशीन किस दिन चाहिए? आप कल बोल सकते हैं, या 15 नवंबर जैसी तारीख़।',
  'vf.book.dateBad':
    'मैं तारीख़ समझ नहीं पाया। कृपया कल बोलिए, या 15 नवंबर जैसी तारीख़।',
  'vf.book.datePast': 'वह दिन निकल चुका है। कृपया आज या उसके बाद का दिन बोलिए।',
  'vf.book.village': 'आपका खेत किस गाँव में है? गाँव का नाम बोलिए।',
  'vf.book.villageBad': 'कृपया गाँव का नाम फिर से बोलिए।',
  'vf.book.acreage': 'आपको कितने एकड़ की कटाई करानी है? कोई संख्या बोलिए, जैसे 5।',
  'vf.book.acreageBad': 'कृपया एकड़ संख्या में बोलिए, जैसे 5 या ढाई।',
  'vf.book.crop': 'आप कौन सी फ़सल उगाते हैं? आप बोल सकते हैं: {crops}।',
  'vf.book.cropBad': 'यह मशीन इन फ़सलों पर चलती है: {crops}। कृपया इनमें से एक बोलिए।',
  'vf.book.phone':
    'कृपया अपना 10 अंकों का मोबाइल नंबर बोलिए। मालिक इसी पर आपको फ़ोन करेंगे।',
  'vf.book.phoneBad':
    'मुझे 10 अंकों का नंबर नहीं मिला। कृपया अंक धीरे-धीरे, एक-एक करके बोलिए।',
  'vf.book.summary':
    '{machine} की बुकिंग {date} को, गाँव {village}। {acres} एकड़ {crop}। आपका फ़ोन नंबर {phone}। क्या मैं अनुरोध भेज दूँ? हाँ या नहीं बोलिए।',
  'vf.book.sent': 'आपका अनुरोध भेज दिया गया है। मालिक देखकर आपको फ़ोन करेंगे।',
  'vf.book.notSent': 'ठीक है, मैंने नहीं भेजा। आप फ़ॉर्म देखकर खुद भेज सकते हैं।',
  'vf.book.signIn': 'इस मशीन को बुक करने के लिए कृपया किसान के रूप में साइन इन करें।',

  'vf.machine.intro':
    'मैं आपकी मशीन जोड़ने में मदद करूँगा। मैं कुछ सवाल पूछूँगा। कृपया एक-एक करके जवाब दीजिए।',
  'vf.machine.type':
    'आपके पास कौन सी मशीन है? आप बोल सकते हैं कंबाइन हार्वेस्टर, ट्रैक्टर हार्वेस्टर, रीपर, थ्रेशर या बेलर।',
  'vf.machine.typeBad':
    'मैं समझा नहीं। कृपया बोलिए कंबाइन हार्वेस्टर, ट्रैक्टर हार्वेस्टर, रीपर, थ्रेशर या बेलर।',
  'vf.machine.unit':
    'आप किस हिसाब से रेट लेते हैं: प्रति एकड़, प्रति घंटा या प्रति दिन?',
  'vf.machine.unitBad': 'कृपया प्रति एकड़, प्रति घंटा या प्रति दिन बोलिए।',
  'vf.machine.price':
    'आपका रेट {unit} कितने रुपये है? कोई संख्या बोलिए, जैसे 2500।',
  'vf.machine.priceBad': 'कृपया रेट संख्या में बोलिए, जैसे 2500।',
  'vf.machine.crops':
    'आपकी मशीन किन फ़सलों के लिए चलती है? फ़सलों के नाम बोलिए, जैसे गेहूं और धान। या बोलिए सभी।',
  'vf.machine.cropsBad':
    'मुझे फ़सल का नाम नहीं सुनाई दिया। कृपया गेहूं, धान या मक्का जैसे नाम बोलिए।',
  'vf.machine.village': 'आपकी मशीन किस गाँव में रहती है? गाँव का नाम बोलिए।',
  'vf.machine.district': 'वह गाँव किस ज़िले में है?',
  'vf.machine.state': 'कौन सा राज्य?',
  'vf.machine.placeBad': 'कृपया फिर से बोलिए।',
  'vf.machine.phone':
    'कृपया अपना 10 अंकों का मोबाइल नंबर बोलिए। किसान इसी पर आपको फ़ोन करेंगे।',
  'vf.machine.summary':
    'मशीन: {type}। रेट {price} रुपये {unit}। फ़सलें: {crops}। गाँव {village}, ज़िला {district}, राज्य {state}। फ़ोन {phone}। क्या मैं यह मशीन सेव कर दूँ? हाँ या नहीं बोलिए।',
  'vf.machine.saved':
    'आपकी मशीन सेव हो गई है। अब किसान इसे ढूँढ सकते हैं। फ़ोटो आप बाद में मशीन बदलकर जोड़ सकते हैं।',
  'vf.machine.notSaved': 'ठीक है, मैंने सेव नहीं किया। आप फ़ॉर्म देखकर खुद सेव कर सकते हैं।',

  'vf.requests.none': 'आपके पास कोई नया अनुरोध नहीं है।',
  'vf.requests.intro': 'आपके पास {count} नए अनुरोध हैं। मैं एक-एक करके पढ़ूँगा।',
  'vf.requests.item':
    'अनुरोध {n} / {total}। {farmer} को {date} के लिए {machine} चाहिए, {acres} एकड़ {crop}, गाँव {village}। क्या आप इसे स्वीकार करेंगे? स्वीकार के लिए हाँ, मना करने के लिए नहीं, या छोड़ें बोलिए।',
  'vf.requests.confirmAccept':
    'आप इस अनुरोध को स्वीकार करना चाहते हैं। क्या यह सही है? हाँ या नहीं बोलिए।',
  'vf.requests.confirmReject':
    'आप इस अनुरोध को मना करना चाहते हैं। क्या यह सही है? हाँ या नहीं बोलिए।',
  'vf.cta.notify': 'बोलकर सूचना पाएँ',
  'vf.title.notify': 'खाली होने पर सूचना',
  'vf.notify.intro':
    'यह मशीन खाली होने पर सूचना सेट करने में मैं आपकी मदद करूँगा।',
  'vf.notify.prompt':
    'यह {machine} अभी काम में है। क्या इसके खाली होते ही आपको सूचना चाहिए? हाँ या नहीं बोलिए।',
  'vf.notify.confirmYes':
    'मशीन खाली होने पर आप सूचना चाहते हैं। क्या यह सही है? हाँ या नहीं बोलिए।',
  'vf.notify.confirmNo':
    'आपको सूचना नहीं चाहिए। क्या यह सही है? हाँ या नहीं बोलिए।',
  'vf.notify.cancelled':
    'ठीक है, मैंने सूचना सेट नहीं की। आप खुद बटन दबा सकते हैं।',
}

const vfTa: Record<keyof typeof vfEn, string> = {
  'vf.cta.book': 'பேசி முன்பதிவு செய்யுங்கள்',
  'vf.cta.machine': 'பேசி நிரப்புங்கள்',
  'vf.cta.requests': 'பேசி கோரிக்கைகளுக்குப் பதிலளியுங்கள்',
  'vf.title.book': 'குரல் மூலம் முன்பதிவு',
  'vf.title.machine': 'குரல் மூலம் இயந்திரத்தைச் சேர்க்கவும்',
  'vf.title.requests': 'குரல் மூலம் கோரிக்கைகள்',
  'vf.status.speaking': 'கேளுங்கள்…',
  'vf.status.listening': 'இப்போது பேசுங்கள்…',
  'vf.status.working': 'சற்று காத்திருங்கள்…',
  'vf.status.done': 'முடிந்தது',
  'vf.status.stopped': 'குரல் நின்றுவிட்டது',
  'vf.heard': 'நீங்கள் சொன்னது: {text}',
  'vf.repeat': 'மீண்டும்',
  'vf.skip': 'தவிர்',
  'vf.close': 'மூடு',
  'vf.unsupported':
    'இந்த உலாவியால் உங்கள் குரலைக் கேட்க முடியாது. இந்த இணையதளத்தை Google Chrome இல் திறக்கவும், அல்லது படிவத்தை தட்டச்சு செய்து நிரப்பவும்.',
  'vf.micDenied':
    'மைக்ரோஃபோன் தடுக்கப்பட்டுள்ளது. உலாவி அமைப்புகளில் இந்த இணையதளத்திற்கு மைக்ரோஃபோனை அனுமதித்து, மீண்டும் முயற்சிக்கவும்.',
  'vf.networkError': 'குரலுக்கு இணையம் தேவை. இணைப்பைச் சரிபார்த்து மீண்டும் முயற்சிக்கவும்.',
  'vf.noSpeech': 'உங்கள் குரல் கேட்கவில்லை. மீண்டும் பேசுங்கள்.',
  'vf.notUnderstood': 'மன்னிக்கவும், எனக்குப் புரியவில்லை. மீண்டும் சொல்லுங்கள்.',
  'vf.tooManyTries': 'சரி, இதைத் தவிர்ப்போம். படிவத்தில் தட்டச்சு செய்யலாம்.',
  'vf.gotIt': 'புரிந்தது: {value}.',
  'vf.confirmAsk': 'நீங்கள் {value} என்று சொன்னீர்கள். சரியா? ஆம் அல்லது இல்லை என்று சொல்லுங்கள்.',
  'vf.confirmRetry': 'சரி, மீண்டும் முயற்சிப்போம்.',
  'vf.yesNoRetry': 'ஆம் அல்லது இல்லை என்று சொல்லுங்கள்.',
  'vf.finished': 'எல்லாம் முடிந்தது. இந்த சாளரத்தை மூடலாம்.',
  'vf.genericError': 'ஏதோ தவறு நடந்துவிட்டது. மீண்டும் முயற்சிக்கவும் அல்லது படிவத்தைப் பயன்படுத்தவும்.',
  'vf.incomplete':
    'சில பதில்கள் இல்லை. படிவத்தைப் பார்த்து, மீதியை நிரப்பி, பொத்தானை நீங்களே அழுத்துங்கள்.',
  'vf.noVoice':
    'இந்த ஃபோனால் இந்த மொழியில் பேச முடியாது. கேள்விகள் திரையில் காட்டப்படும். நீங்கள் இன்னும் பேசி பதிலளிக்கலாம்.',

  'vf.book.intro':
    'இந்த இயந்திரத்தை முன்பதிவு செய்ய நான் உதவுகிறேன். சில கேள்விகள் கேட்பேன். ஒவ்வொன்றாகப் பதிலளியுங்கள்.',
  'vf.book.date':
    'இயந்திரம் எந்த நாளில் தேவை? நாளை என்று சொல்லலாம், அல்லது 15 நவம்பர் போன்ற தேதியைச் சொல்லலாம்.',
  'vf.book.dateBad':
    'தேதி புரியவில்லை. நாளை என்று சொல்லுங்கள், அல்லது 15 நவம்பர் போன்ற தேதியைச் சொல்லுங்கள்.',
  'vf.book.datePast': 'அந்த நாள் கடந்துவிட்டது. இன்று அல்லது அதற்குப் பிந்தைய நாளைச் சொல்லுங்கள்.',
  'vf.book.village': 'உங்கள் வயல் எந்த கிராமத்தில் உள்ளது? கிராமத்தின் பெயரைச் சொல்லுங்கள்.',
  'vf.book.villageBad': 'கிராமத்தின் பெயரை மீண்டும் சொல்லுங்கள்.',
  'vf.book.acreage': 'எத்தனை ஏக்கர் அறுவடை செய்ய வேண்டும்? ஒரு எண்ணைச் சொல்லுங்கள், எ.கா. 5.',
  'vf.book.acreageBad': 'ஏக்கரை எண்ணாகச் சொல்லுங்கள், எ.கா. 5 அல்லது இரண்டரை.',
  'vf.book.crop': 'நீங்கள் எந்தப் பயிரை விளைவிக்கிறீர்கள்? நீங்கள் சொல்லலாம்: {crops}.',
  'vf.book.cropBad': 'இந்த இயந்திரம் இந்தப் பயிர்களுக்கு வேலை செய்யும்: {crops}. இவற்றில் ஒன்றைச் சொல்லுங்கள்.',
  'vf.book.phone':
    'உங்கள் 10 இலக்க மொபைல் எண்ணைச் சொல்லுங்கள். உரிமையாளர் இதில் உங்களை அழைப்பார்.',
  'vf.book.phoneBad':
    '10 இலக்க எண் கிடைக்கவில்லை. இலக்கங்களை மெதுவாக, ஒவ்வொன்றாகச் சொல்லுங்கள்.',
  'vf.book.summary':
    '{machine} முன்பதிவு {date} அன்று, கிராமம் {village}. {acres} ஏக்கர் {crop}. உங்கள் ஃபோன் எண் {phone}. கோரிக்கையை அனுப்பட்டுமா? ஆம் அல்லது இல்லை என்று சொல்லுங்கள்.',
  'vf.book.sent': 'உங்கள் கோரிக்கை அனுப்பப்பட்டது. உரிமையாளர் பார்த்த பிறகு உங்களை அழைப்பார்.',
  'vf.book.notSent': 'சரி, நான் அனுப்பவில்லை. படிவத்தைச் சரிபார்த்து நீங்களே அனுப்பலாம்.',
  'vf.book.signIn': 'இந்த இயந்திரத்தை முன்பதிவு செய்ய விவசாயியாக உள்நுழையுங்கள்.',

  'vf.machine.intro':
    'உங்கள் இயந்திரத்தைச் சேர்க்க நான் உதவுகிறேன். சில கேள்விகள் கேட்பேன். ஒவ்வொன்றாகப் பதிலளியுங்கள்.',
  'vf.machine.type':
    'உங்களிடம் எந்த இயந்திரம் உள்ளது? கம்பைன் ஹார்வெஸ்டர், டிராக்டர் ஹார்வெஸ்டர், ரீப்பர், த்ரெஷர் அல்லது பேலர் என்று சொல்லலாம்.',
  'vf.machine.typeBad':
    'புரியவில்லை. கம்பைன் ஹார்வெஸ்டர், டிராக்டர் ஹார்வெஸ்டர், ரீப்பர், த்ரெஷர் அல்லது பேலர் என்று சொல்லுங்கள்.',
  'vf.machine.unit': 'எப்படிக் கட்டணம் வசூலிக்கிறீர்கள்: ஏக்கருக்கா, மணிக்கா அல்லது நாளுக்கா?',
  'vf.machine.unitBad': 'ஏக்கருக்கு, மணிக்கு அல்லது நாளுக்கு என்று சொல்லுங்கள்.',
  'vf.machine.price':
    '{unit} உங்கள் கட்டணம் எத்தனை ரூபாய்? ஒரு எண்ணைச் சொல்லுங்கள், எ.கா. 2500.',
  'vf.machine.priceBad': 'கட்டணத்தை எண்ணாகச் சொல்லுங்கள், எ.கா. 2500.',
  'vf.machine.crops':
    'உங்கள் இயந்திரம் எந்தப் பயிர்களுக்கு வேலை செய்யும்? பயிர்களின் பெயர்களைச் சொல்லுங்கள், எ.கா. கோதுமை மற்றும் நெல். அல்லது எல்லாம் என்று சொல்லுங்கள்.',
  'vf.machine.cropsBad':
    'பயிரின் பெயர் கேட்கவில்லை. கோதுமை, நெல் அல்லது மக்காச்சோளம் போன்ற பெயர்களைச் சொல்லுங்கள்.',
  'vf.machine.village': 'உங்கள் இயந்திரம் எந்த கிராமத்தில் உள்ளது? கிராமத்தின் பெயரைச் சொல்லுங்கள்.',
  'vf.machine.district': 'அந்த கிராமம் எந்த மாவட்டத்தில் உள்ளது?',
  'vf.machine.state': 'எந்த மாநிலம்?',
  'vf.machine.placeBad': 'மீண்டும் சொல்லுங்கள்.',
  'vf.machine.phone':
    'உங்கள் 10 இலக்க மொபைல் எண்ணைச் சொல்லுங்கள். விவசாயிகள் இதில் உங்களை அழைப்பார்கள்.',
  'vf.machine.summary':
    'இயந்திரம்: {type}. கட்டணம் {unit} {price} ரூபாய். பயிர்கள்: {crops}. கிராமம் {village}, மாவட்டம் {district}, மாநிலம் {state}. ஃபோன் {phone}. இந்த இயந்திரத்தைச் சேமிக்கட்டுமா? ஆம் அல்லது இல்லை என்று சொல்லுங்கள்.',
  'vf.machine.saved':
    'உங்கள் இயந்திரம் சேமிக்கப்பட்டது. இப்போது விவசாயிகள் இதைக் கண்டுபிடிக்கலாம். புகைப்படத்தை பின்னர் இயந்திரத்தைத் திருத்தி சேர்க்கலாம்.',
  'vf.machine.notSaved': 'சரி, நான் சேமிக்கவில்லை. படிவத்தைச் சரிபார்த்து நீங்களே சேமிக்கலாம்.',

  'vf.requests.none': 'உங்களுக்குப் புதிய கோரிக்கைகள் இல்லை.',
  'vf.requests.intro': 'உங்களுக்கு {count} புதிய கோரிக்கைகள் உள்ளன. ஒவ்வொன்றாகப் படிக்கிறேன்.',
  'vf.requests.item':
    'கோரிக்கை {n} / {total}. {farmer} அவர்களுக்கு {date} அன்று {machine} தேவை, {acres} ஏக்கர் {crop}, கிராமம் {village}. இதை ஏற்கிறீர்களா? ஏற்க ஆம், நிராகரிக்க இல்லை, அல்லது தவிர் என்று சொல்லுங்கள்.',
  'vf.requests.confirmAccept':
    'இந்தக் கோரிக்கையை ஏற்க விரும்புகிறீர்கள். சரியா? ஆம் அல்லது இல்லை என்று சொல்லுங்கள்.',
  'vf.requests.confirmReject':
    'இந்தக் கோரிக்கையை நிராகரிக்க விரும்புகிறீர்கள். சரியா? ஆம் அல்லது இல்லை என்று சொல்லுங்கள்.',
  'vf.cta.notify': 'பேசி அறிவிப்பைப் பெறுங்கள்',
  'vf.title.notify': 'காலியானதும் தெரிவிக்கவும்',
  'vf.notify.intro':
    'இந்த இயந்திரம் காலியானதும் அறிவிப்பு அமைக்க நான் உதவுகிறேன்.',
  'vf.notify.prompt':
    'இந்த {machine} இப்போது வேலையில் உள்ளது. காலியானதும் உடனே அறிவிப்பு வேண்டுமா? ஆம் அல்லது இல்லை என்று சொல்லுங்கள்.',
  'vf.notify.confirmYes':
    'இந்த இயந்திரம் காலியானதும் அறிவிப்பு வேண்டும். சரியா? ஆம் அல்லது இல்லை என்று சொல்லுங்கள்.',
  'vf.notify.confirmNo':
    'உங்களுக்கு அறிவிப்பு வேண்டாம். சரியா? ஆம் அல்லது இல்லை என்று சொல்லுங்கள்.',
  'vf.notify.cancelled':
    'சரி, நான் அறிவிப்பை அமைக்கவில்லை. பொத்தானை நீங்களே அழுத்தலாம்.',
}

export { vfEn, vfKn, vfHi, vfTa }
