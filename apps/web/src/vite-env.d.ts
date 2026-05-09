/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Set to 1 / true / yes to expose quick-start fixtures and pacing on the intake and dashboard surfaces. */
  readonly VITE_ENABLE_DEMO?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
