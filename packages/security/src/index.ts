/**
 * Common types/methods for Textile security including authentication and authorization.
 *
 * All methods here should be imported directly from the @textile/hub library.
 *
 * @packageDocumentation
 */
import { HMAC } from 'fast-sha256'
import multibase from 'multibase'

/**
 * UserAuth is a type describing the minimal requirements create a session from a user group key. Generate with {@link createUserAuth}.
 *
 * Optional token generated by {@link https://textileio.github.io/js-threads/classes/_textile_threads_client.client.html#gettoken | Client.getToken} or {@link https://textileio.github.io/js-threads/classes/_textile_threads_client.client.html#gettoken | Client.getTokenChallenge}.
 * @public
 * @example
 * Import
 * ```typescript
 * import {UserAuth} from '@textile/threads';
 * ```
 * @param {string} key - API key. Can be embedded/shared within an app.
 * @param {string} sig - The signature of the authentication message.
 * @param {string} msg - The authentication message.
 * @param {string} token - User verification token generated by {@link https://textileio.github.io/js-threads/classes/_textile_threads_client.client.html#gettoken | Client.getToken} or {@link https://textileio.github.io/js-threads/classes/_textile_threads_client.client.html#gettoken | Client.getTokenChallenge}.
 */
export type UserAuth = {
  key: string
  sig: string
  msg: string
  token?: string
}

/**
 * KeyInfo is a type that contains the API Secret. It should never be shared in insecure environments. Type 0=ACCOUNT, 1=USER.
 * @public
 * @example
 * Import
 * ```typescript
 * import {KeyInfo} from '@textile/threads';
 * ```
 * @param {string} key - API key. Can be embedded/shared within an app.
 * @param {string} secret - User group/account secret. Should not be embedded/shared publicly.
 * @param {number} type - Key type. 0 of ACCOUNT or 1 of USER
 */
export type KeyInfo = {
  /**
   * API key. Can be embedded/shared within an app.
   */
  key: string
  /**
   * User group/account secret. Should not be embedded/shared publicly.
   */
  secret: string
  /**
   * Key type. Zero of ACCOUNT or One of USER
   */
  type: 0 | 1
}

/**
 * Create an API signature for use in authenticated systems. Generate with {@link createAPISig}.
 * @public
 * @example
 * Import
 * ```typescript
 * import {APISig} from '@textile/threads';
 * ```
 * @param {string} sig - The signature of the authentication message.
 * @param {string} msg - The authentication message.
 */
export type APISig = {
  sig: string
  msg: string
}

/**
 * createAPISig generates an authorization signature and message only.
 *
 * This function should NOT be used client-side, as it requires a key secret.
 * @public
 * @example
 * Basic usage
 * ```typescript
 * import {createAPISig, APISig} from '@textile/threads'
 *
 * async function sign (key: string) {
 *   const sig: APISig = await createAPISig(key)
 *   return sig
 * }
 * ```
 * @param {string} secret - The key secret to generate the signature. See KeyInfo for details.
 * @param {Date} date - An optional future Date to use as signature message. Once `date` has passed, this
 * authorization signature and message will expire. Defaults to one minute from `Date.now`.
 */
export async function createAPISig(
  secret: string,
  date: Date = new Date(Date.now() + 1000 * 60),
): Promise<APISig> {
  const sec = multibase.decode(secret)
  const msg = (date ?? new Date()).toISOString()
  const hash = new HMAC(sec)
  const mac = hash.update(Buffer.from(msg)).digest()
  const sig = multibase.encode('base32', Buffer.from(mac)).toString()
  return { sig, msg }
}

/**
 * Generate a UserAuth containing API key, signature, and message.
 *
 * The gRPC APIs will throw (or return an authorization error) if the message date has passed.
 * This function should NOT be used client-side, as it requires a key secret. The result does
 * not contain the secret and therefor CAN be used client side.
 * @public
 * @example
 * Create a new UserAuth
 * ```typescript
 * import {createUserAuth, KeyInfo, UserAuth} from '@textile/threads';
 *
 * async function auth (keyInfo: KeyInfo) {
 *   // Create an expiration and create a signature. 60s or less is recommended.
 *   const expiration = new Date(Date.now() + 60 * 1000)
 *   // Generate a new UserAuth
 *   const userAuth: UserAuth = await createUserAuth(keyInfo.key, keyInfo.secret, expiration)
 *   return userAuth
 * }
 * ```
 *
 * @param {string} key - The API key secret to generate the signature. See KeyInfo for details.
 * @param {string} secret - The API key secret to generate the signature. See KeyInfo for details.
 * @param {Date} date - An optional future Date to use as signature message. Default 1 minute from now.
 * @param {string} token - An optional user API token.
 */
export async function createUserAuth(
  key: string,
  secret: string,
  date: Date = new Date(Date.now() + 1000 * 60),
  token?: string,
): Promise<UserAuth> {
  const partial = await createAPISig(secret, date)
  return {
    ...partial,
    key,
    token,
  }
}

/**
 * expirationError is an error your app will receive anytime your credentials have expired.
 * @public
 */
export const expirationError = new Error(
  'Auth expired. Consider calling withKeyInfo or withAPISig to refresh.',
)
