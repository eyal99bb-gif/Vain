import { midaEnv } from "../../env";
import type { Repos } from "./types";

let repos: Repos | null = null;

export async function getRepos(): Promise<Repos> {
  if (!repos) {
    if (midaEnv.dbMode === "postgres") {
      const { createDrizzleRepos } = await import("./drizzle");
      repos = createDrizzleRepos();
    } else {
      const { createFileRepos } = await import("./file");
      repos = createFileRepos();
    }
  }
  return repos;
}

export type { Repos } from "./types";
