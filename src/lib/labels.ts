import type { TranslationKey } from '../i18n/en'
import { isCropKey, isMachineType } from './constants'

export function cropLabelKey(value: string): TranslationKey {
  return isCropKey(value) ? `crop.${value}` : 'common.unknown'
}

export function machineTypeLabelKey(value: string): TranslationKey {
  return isMachineType(value) ? `machineType.${value}` : 'common.unknown'
}
