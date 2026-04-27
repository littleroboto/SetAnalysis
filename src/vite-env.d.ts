/// <reference types="vite/client" />
/// <reference types="vitest/globals" />

declare module "*.yaml?raw" {
  const content: string;
  export default content;
}
