export { AuthGate } from './AuthGate';
export type { AuthGateCta, AuthGateProps } from './AuthGate';
export { getAuthClient } from './client';
export { ensureSessionReady } from './stores/ensureSessionReady';
export { subscribeSettledSession } from './stores/subscribeSettledSession';
export type { AuthClient, AuthError, Session, User } from './client';
export {
  $passwordRecovery,
  $session,
  $sessionReady,
  resetPassword,
  signIn,
  signInWithOtp,
  signOut,
  signUp,
  updatePassword,
} from './stores/session';
export type { AuthErrorCode, AuthResult, SignUpInput, UserRole } from './stores/session';
export { useSession } from './useSession';
export type { SessionSnapshot } from './useSession';
