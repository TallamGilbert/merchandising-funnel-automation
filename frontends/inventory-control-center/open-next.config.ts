import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// Every page fetches from the backend APIs in the browser, so there is no
// ISR/data cache to back with R2 — the default in-memory config is enough.
export default defineCloudflareConfig({});
