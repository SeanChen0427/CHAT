/// <reference types="vite/client" />

// Sean 版（Supabase）：建置時指定的 API 網址。
interface ImportMetaEnv {
  readonly VITE_API_BASE?: string;
}
