/**
 * Type augmentation for Cloudflare Workers types
 * This file extends the @cloudflare/workers-types package with missing properties
 */

// Ensure this is treated as a module
export {};

declare global {
  interface R2Object {
    arrayBuffer(): Promise<ArrayBuffer>;
  }
}
