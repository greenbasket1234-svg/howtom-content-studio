/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_UNIVERSE_URL?: string;
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}
