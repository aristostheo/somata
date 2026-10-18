export type FirebaseClientConfig = { apiKey: string; authDomain: string; projectId: string; storageBucket: string; messagingSenderId: string; appId: string; measurementId?: string };
export type BackendConfig = { environment: string; functionsRegion: string; projectId?: string; firebase?: FirebaseClientConfig };
export const FUNCTIONS_REGION: string;
export const STAGING_FUNCTIONS_REGION: string;
export function socialProvidersAllowed(manifestMode: unknown, bundledMode: unknown, channel?: string | null): boolean;
export function stagingProject(value: unknown): string;
export function resolveBackendConfig(env: Record<string, string | undefined>): BackendConfig;
export function resolveRuntimeBackend(manifest: unknown, bundledMode: string | undefined, bundledProjectId: string | undefined, emulator: { projectId: string } | null, nativeChannel?: string | null): { firebase: FirebaseClientConfig; functionsRegion: string };
