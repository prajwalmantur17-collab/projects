export type ParseOutcome<T> = { ok: true; value: T } | { ok: false; message?: string }

type ApplyResult = void | string | Promise<void | string>

/** One question in a voice conversation. Build these with askStep() or sayStep(). */
export interface VoiceStep {
  id: string
  /** "ask" listens for an answer; "say" only speaks. */
  kind?: 'ask' | 'say'
  prompt: string | (() => string)
  /** Return false to skip this step silently. */
  when?: () => boolean
  /** Spoken "skip" moves on without an answer. Default true. */
  allowSkip?: boolean
  parse: (heard: string) => ParseOutcome<unknown>
  /** If set, the answer is read back and the person must say yes. */
  confirmText?: (value: unknown) => string
  /** Short readback after an accepted answer ("Got it: ..."). */
  describe?: (value: unknown) => string
  /** Store the answer. A returned string is spoken and shown instead of the readback. */
  apply: (value: unknown) => ApplyResult
}

interface AskStepDefinition<T> {
  id: string
  prompt: string | (() => string)
  when?: () => boolean
  allowSkip?: boolean
  parse: (heard: string) => ParseOutcome<T>
  confirmText?: (value: T) => string
  describe?: (value: T) => string
  apply: (value: T) => ApplyResult
}

export function askStep<T>(definition: AskStepDefinition<T>): VoiceStep {
  const { confirmText, describe, apply, ...rest } = definition
  return {
    ...rest,
    kind: 'ask',
    confirmText: confirmText ? (value) => confirmText(value as T) : undefined,
    describe: describe ? (value) => describe(value as T) : undefined,
    apply: (value) => apply(value as T),
  }
}

export function sayStep(id: string, prompt: string | (() => string), when?: () => boolean): VoiceStep {
  return {
    id,
    kind: 'say',
    prompt,
    when,
    parse: () => ({ ok: false }),
    apply: () => undefined,
  }
}
