import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import wasm from 'vite-plugin-wasm';

// El portal del cliente verifica su prueba de inclusion con los circuitos
// puros del contrato compilado, que corren sobre @midnight-ntwrk/compact-runtime
// — y ese runtime es wasm. Sin `vite-plugin-wasm` el build muere en
// "ESM integration proposal for Wasm is not supported currently".
//
// `target: esnext` no es cosmetico: el runtime usa top-level await, y bajarlo
// a es2020 obliga a esbuild a reescribir destructuring del codigo generado,
// cosa que no sabe hacer (58 errores). Con un target moderno el TLA es nativo
// y no hace falta ningun plugin extra. Un navegador que no soporta wasm
// tampoco iba a poder verificar nada.
//
// `fs.allow` es para que el dev server pueda leer contracts/managed, que vive
// fuera de ui/.
export default defineConfig({
  plugins: [react(), wasm()],
  build: { target: 'esnext' },
  server: {
    fs: { allow: ['..'] },
    proxy: { '/api': 'http://localhost:3300' },
  },
});
