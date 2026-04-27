/// <reference types="vite/client" />
/// <reference types="vitest/globals" />

declare module "*.yaml?raw" {
  const content: string;
  export default content;
}

declare const __GIT_SHA__: string;
declare const __GIT_SUBJECT__: string;
declare const __GIT_DATE__: string;
