import { getFunctions, connectFunctionsEmulator } from 'firebase/functions';

import app from './client';

const env = import.meta.env as unknown as Record<string, string | boolean | undefined>;
const region = (env.VITE_FUNCTIONS_REGION as string) || 'us-central1';
export const functions = getFunctions(app, region);

if (env.DEV === true && String(env.VITE_FUNCTIONS_EMULATOR) === 'true') {
  const host = (env.VITE_FUNCTIONS_EMULATOR_HOST as string) || 'localhost';
  const port = Number(env.VITE_FUNCTIONS_EMULATOR_PORT || 5001);
  connectFunctionsEmulator(functions, host, port);
}
