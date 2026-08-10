import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import wasm from 'vite-plugin-wasm';
import topLevelAwait from 'vite-plugin-top-level-await';

// El portal del cliente verifica su prueba de inclusion con los circuitos
// puros del contrato compilado, que corren sobre @midnight-ntwrk/compact-runtime
// — y ese runtime es wasm. Sin estos dos plugins el build muere en
// "ESM integration proposal for Wasm is not supported currently".
// `fs.allow` es para que el dev server pueda leer contracts/managed, que vive
// fuera de ui/.
export default defineConfig({
  plugins: [react(), wasm(), topLevelAwait()],
  server: {
    fs: { allow: ['..'] },
    proxy: { '/api': 'http://localhost:3300' },
  },
});
