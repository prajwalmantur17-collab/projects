/**
 * Re-exports configuration from the self-contained api/speech module.
 */
export {
  type SupportedLanguage,
  MAX_TEXT_LENGTH,
  DEFAULT_MODEL_ID,
  MODEL_SUPPORTED_LANGUAGES,
  DEFAULT_VOICES,
  type SpeechResolution,
  resolveSpeechConfig,
} from './speech.ts'
