import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Apanha apenas testes do código-fonte; ignora artefactos de build em lib/.
    include: ['src/**/*.test.ts'],
    exclude: ['node_modules/**', 'lib/**'],
  },
});
