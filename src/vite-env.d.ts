/// <reference types="vite/client" />

declare module "*.mp3" {
  const src: string;
  export default src;
}

declare module "*.wav" {
  const src: string;
  export default src;
}

declare module "*.ogg" {
  const src: string;
  export default src;
}

declare const __IS_PAGES__: boolean;

interface Window {
  Chart?: unknown;
  confetti?: (options?: unknown) => Promise<null | unknown>;
}
