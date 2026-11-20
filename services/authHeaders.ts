import { getFirebaseToken } from "./firebaseService";

/** Single source for authenticated JSON fetch headers. Replaces the
 *  copy-pasted `token ? { Authorization } : {}` blocks across services. */
export async function getAuthHeaders(): Promise<Record<string, string>> {
  const token = await getFirebaseToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/** Same, but merged over caller-provided headers (caller wins on conflict, except Authorization). */
export async function withAuthHeaders(
  extra?: Record<string, string>
): Promise<Record<string, string>> {
  const auth = await getAuthHeaders();
  return { ...extra, ...auth };
}
