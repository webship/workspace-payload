// What scripts/payload-site.mts uses of the app's own packages. The script runs in the folder of a
// Payload app, with the app's node_modules; the plugin does not install Payload, so its type check
// knows these two modules by this file alone. The script casts what they answer to its own types.

declare module 'payload' {
  /** The app's Local API for a configuration. */
  export function getPayload(options: { config: unknown }): Promise<unknown>;
  /** A request of the Local API made as a user, for the template's seed. */
  export function createLocalReq(options: { user: unknown }, payload: unknown): Promise<unknown>;
}

declare module '@payload-config' {
  /** The app's configuration (payload.config.ts), by the alias of the app's tsconfig. */
  const config: unknown;
  export default config;
}
