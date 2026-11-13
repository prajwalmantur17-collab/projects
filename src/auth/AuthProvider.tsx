import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import type { ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { hasStoredLanguage } from '../i18n'
import type { TranslationKey } from '../i18n'
import { logError, mapErrorToKey } from '../lib/errors'
import { env } from '../lib/env'
import { requireSupabase, supabase } from '../lib/supabase'
import { markUnlocked } from '../lib/patternLock'
import { clearHiddenBookingsForUser } from '../services/bookings'
import { ensureProfile, getProfile, updateProfile } from '../services/profiles'
import type { Language, Profile } from '../types'

interface AuthContextValue {
  configured: boolean
  initializing: boolean
  session: Session | null
  profile: Profile | null
  profileLoading: boolean
  profileError: TranslationKey | null
  refreshProfile: () => Promise<Profile | null>
  signInWithPassword: (email: string, password: string) => Promise<void>
  signUpWithPassword: (
    email: string,
    password: string,
    fullName: string,
  ) => Promise<{ needsEmailConfirmation: boolean }>
  /** True after the user opens a password-reset email link, until they finish or sign out. */
  recovering: boolean
  requestPasswordReset: (email: string) => Promise<void>
  updatePassword: (password: string) => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [initializing, setInitializing] = useState(env.isConfigured)
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [profileLoading, setProfileLoading] = useState(false)
  const [profileError, setProfileError] = useState<TranslationKey | null>(null)
  const [profileVersion, setProfileVersion] = useState(0)
  const [recovering, setRecovering] = useState(false)

  useEffect(() => {
    if (!supabase) {
      setInitializing(false)
      return
    }
    let mounted = true

    const { data } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!mounted) return
      setSession(nextSession)
      if (event === 'PASSWORD_RECOVERY') setRecovering(true)
      if (event === 'SIGNED_OUT' || !nextSession) {
        setRecovering(false)
        setProfile(null)
        setProfileError(null)
        setProfileLoading(false)
        try {
          window.localStorage.removeItem('hr_user_role')
        } catch {
          // localStorage disabled
        }
      }
    })

    supabase.auth
      .getSession()
      .then(({ data: sessionData, error }) => {
        if (!mounted) return
        if (error) logError('auth.getSession', error)
        setSession(sessionData.session ?? null)
        setInitializing(false)
      })
      .catch((caught: unknown) => {
        logError('auth.getSession', caught)
        if (mounted) setInitializing(false)
      })

    return () => {
      mounted = false
      data.subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    const userId = session?.user.id
    if (!userId) {
      setProfile(null)
      setProfileLoading(false)
      setProfileError(null)
      return
    }

    let cancelled = false
    setProfileLoading(true)
    setProfileError(null)

    ;(async () => {
      try {
        let loaded = await getProfile(userId)
        if (!loaded) loaded = await ensureProfile()
        if (!cancelled) {
          setProfile(loaded)
          try {
            if (loaded?.role) {
              window.localStorage.setItem('hr_user_role', loaded.role)
            }
          } catch {
            // ignore
          }
        }
      } catch (caught) {
        logError('auth.loadProfile', caught)
        if (!cancelled) setProfileError(mapErrorToKey(caught, 'error.profileLoad'))
      } finally {
        if (!cancelled) setProfileLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [session?.user.id, profileVersion])

  const refreshProfile = useCallback(async (): Promise<Profile | null> => {
    const userId = session?.user.id
    if (!userId) {
      setProfile(null)
      return null
    }
    try {
      const loaded = await getProfile(userId)
      if (loaded) {
        setProfile(loaded)
        setProfileError(null)
        try {
          if (loaded?.role) {
            window.localStorage.setItem('hr_user_role', loaded.role)
          }
        } catch {
          // ignore
        }
        return loaded
      }
      setProfileVersion((value) => value + 1)
      return null
    } catch (caught) {
      logError('auth.refreshProfile', caught)
      setProfileError(mapErrorToKey(caught, 'error.profileLoad'))
      return null
    }
  }, [session?.user.id])

  const signInWithPassword = useCallback(async (email: string, password: string) => {
    const result = await requireSupabase().auth.signInWithPassword({ email, password })
    const error = result.error
    // A fresh password sign-in already proves who the user is, so skip the pattern once.
    if (!error && result.data.user) markUnlocked(result.data.user.id)
    if (error) throw error
  }, [])

  const signUpWithPassword = useCallback(
    async (email: string, password: string, fullName: string) => {
      const { data, error } = await requireSupabase().auth.signUp({
        email,
        password,
        options: { data: { full_name: fullName } },
      })
      if (error) throw error
      return { needsEmailConfirmation: data.session === null }
    },
    [],
  )

  const requestPasswordReset = useCallback(async (email: string) => {
    const { error } = await requireSupabase().auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    if (error) throw error
  }, [])

  const updatePassword = useCallback(async (password: string) => {
    const result = await requireSupabase().auth.updateUser({ password })
    const error = result.error
    if (!error && result.data.user) markUnlocked(result.data.user.id)
    if (error) throw error
    setRecovering(false)
  }, [])

  const signOut = useCallback(async () => {
    try {
      clearHiddenBookingsForUser()
      const { error } = await requireSupabase().auth.signOut()
      if (error) throw error
    } finally {
      setProfile(null)
      setSession(null)
    }
  }, [])

  /**
   * Applies the server-stored language once per signed-in user, or pushes a
   * language chosen before sign-in to the profile. This never runs on every
   * language change (LanguageSelector handles that) so it cannot loop.
   */
  const [languageInitializedFor, setLanguageInitializedFor] = useState<string | null>(null)
  useEffect(() => {
    if (!profile) {
      setLanguageInitializedFor(null)
      return
    }
    if (languageInitializedFor === profile.id) return
    setLanguageInitializedFor(profile.id)
    if (hasStoredLanguage()) {
      const stored = window.localStorage.getItem('harvest-rentals-language')
      const storedLanguage =
        stored === 'kn' || stored === 'hi' || stored === 'en' || stored === 'ta' ? stored : null
      if (storedLanguage && storedLanguage !== profile.preferred_language) {
        void updateProfile(profile.id, { preferred_language: storedLanguage as Language })
          .then(() => refreshProfile())
          .catch((caught: unknown) => logError('auth.syncLanguage', caught))
      }
    }
  }, [profile, languageInitializedFor, refreshProfile])

  const value = useMemo<AuthContextValue>(
    () => ({
      configured: env.isConfigured,
      initializing,
      session,
      profile,
      profileLoading,
      profileError,
      refreshProfile,
      signInWithPassword,
      signUpWithPassword,
      recovering,
      requestPasswordReset,
      updatePassword,
      signOut,
    }),
    [
      initializing,
      session,
      profile,
      profileLoading,
      profileError,
      refreshProfile,
      signInWithPassword,
      signUpWithPassword,
      recovering,
      requestPasswordReset,
      updatePassword,
      signOut,
    ],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used inside AuthProvider')
  return context
}
