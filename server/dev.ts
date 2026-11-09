// API factory used by the Vite dev server (see vite.config.ts).
import { resolve } from "node:path";
import { createApi } from "./api.ts";
import { JobStore } from "./jobs.ts";

export async function createDevApi() {
  const store = new JobStore(resolve(process.env.CHIZU_DATA ?? "data"));
  await store.load();
  return createApi(store);
}
