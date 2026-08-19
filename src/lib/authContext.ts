import { createContext, useContext } from 'react'
import type { Account } from './auth'
import type { SyncStatus } from './sync'

// The signed-in account, shared with the whole tree.
//
// Split from `AuthProvider.tsx` for the same reason `dashboard/context.ts` is
// split from the shell: a file that exports both a component and a hook trips
// the only-export-components lint, and the types are useful on their own.
//
// Every mutating call here wraps the matching function in `auth.ts` and then
// updates `user`, which is what makes the rest of the app react to a sign-in.
// Components must not call `auth.ts` directly for anything that changes state —
// storage would be right and the UI would be a version behind.

export type AuthState = {
  /** null when nobody is signed in — a fully supported way to use the site. */
  user: Account | null
  /**
   * False until the stored token has been checked with the server.
   *
   * The UI does not wait on this. `user` is populated synchronously from the
   * session cache, so the navbar and dashboard are right on the first frame; this
   * only tells a component whether that has been confirmed, which the account
   * page uses and nothing else needs.
   */
  verified: boolean
  /** Whether local changes are waiting to reach the server. */
  sync: SyncStatus
  /** `adopted` is true when guest survey data moved into the new account. */
  signUp: (username: string, password: string) => Promise<{ adopted: boolean }>
  signIn: (username: string, password: string) => Promise<void>
  signOut: () => Promise<void>
  changePassword: (current: string, next: string) => Promise<void>
  /** Removes the account and its data, on the server and on this device. */
  deleteAccount: () => Promise<void>
  /** Pull the server's copy over the local one, for an explicit refresh. */
  refresh: () => Promise<void>
}

export const AuthContext = createContext<AuthState | null>(null)

export function useAuth(): AuthState {
  const state = useContext(AuthContext)
  if (!state) throw new Error('useAuth must be used inside <AuthProvider>')
  return state
}
