import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import * as auth from '../lib/auth'
import { AuthContext, type AuthState } from '../lib/authContext'
import { migrateLocalAccounts } from '../lib/session'
import { onSyncStatus, pullProfile, startSyncTriggers, type SyncStatus } from '../lib/sync'
import type { Account } from '../lib/auth'

// Holds the signed-in account for the app.
//
// FIRST PAINT IS CACHED, ON PURPOSE. `currentAccount()` reads the session out of
// localStorage synchronously, so the navbar and the dashboard are correct on the
// first frame with no request and no spinner. The token is then checked with the
// server in the background, and only an outright 401 signs anyone out — a failed
// request means the network is down, not that the student is logged out, and
// dropping someone out of their own dashboard on a train would be its own bug.

export default function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Account | null>(() => {
    // Before the first read: retire the short-lived local-only account store, so
    // a student who made one of those keeps their list (as guest data) instead of
    // being signed into an account the server has never heard of.
    migrateLocalAccounts()
    return auth.currentAccount()
  })
  const [verified, setVerified] = useState(false)
  const [sync, setSync] = useState<SyncStatus>('idle')

  useEffect(() => onSyncStatus(setSync), [])
  useEffect(() => startSyncTriggers(), [])

  useEffect(() => {
    let cancelled = false
    auth
      .verifySession()
      .then((account) => {
        if (cancelled) return
        setUser(account)
        setVerified(true)
      })
      .catch(() => {
        // verifySession already decides what a failure means; this is only here
        // so an unexpected throw cannot leave `verified` false forever.
        if (!cancelled) setVerified(true)
      })
    return () => {
      cancelled = true
    }
  }, [])

  // Two tabs, one browser, one localStorage. Without this, signing out in one tab
  // leaves the other showing a signed-in dashboard whose next write lands in a
  // profile the session no longer points at.
  useEffect(() => {
    const resync = () => setUser(auth.currentAccount())
    window.addEventListener('storage', resync)
    return () => window.removeEventListener('storage', resync)
  }, [])

  const signUp = useCallback(async (username: string, password: string) => {
    const { account, adopted } = await auth.signUp(username, password)
    setUser(account)
    setVerified(true)
    return { adopted }
  }, [])

  const signIn = useCallback(async (username: string, password: string) => {
    setUser(await auth.signIn(username, password))
    setVerified(true)
  }, [])

  const signOut = useCallback(async () => {
    // auth.signOut pushes anything unsynced before ending the session, so signing
    // out on a school computer does not lose the last few things they kept.
    await auth.signOut()
    setUser(null)
  }, [])

  // Deliberately does not sign the student out: they changed a password, they did
  // not ask to be thrown back to the sign-in page.
  const changePassword = useCallback(async (current: string, next: string) => {
    await auth.changePassword(current, next)
  }, [])

  const deleteAccount = useCallback(async () => {
    await auth.deleteAccount()
    setUser(null)
  }, [])

  const refresh = useCallback(async () => {
    await pullProfile()
  }, [])

  const value: AuthState = useMemo(
    () => ({ user, verified, sync, signUp, signIn, signOut, changePassword, deleteAccount, refresh }),
    [user, verified, sync, signUp, signIn, signOut, changePassword, deleteAccount, refresh],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
