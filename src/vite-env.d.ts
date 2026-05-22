/// <reference types="vite/client" />

// Импорт .wasm как URL (Vite). CanvasKit грузит wasm-файл по этому адресу.
declare module '*.wasm?url' {
  const src: string;
  export default src;
}
