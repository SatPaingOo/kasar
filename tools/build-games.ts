/**
 * Compiles every game, one at a time, each with its own tsconfig.
 *
 * A game is not a package and shares no code with the shell, so there is
 * nothing to orchestrate: find the folders, run tsc in each. One failing
 * game fails the build and names itself, and the rest still compiled.
 */

import { spawnSync } from "node:child_process";
import { readdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const GAMES = join(ROOT, "games");
const TSC = join(ROOT, "node_modules", "typescript", "bin", "tsc");

const folders = await readdir(GAMES, { withFileTypes: true });
const failed: string[] = [];
let built = 0;

for (const folder of folders) {
  if (!folder.isDirectory()) continue;
  const config = join(GAMES, folder.name, "tsconfig.json");

  const run = spawnSync(process.execPath, [TSC, "-p", config], {
    stdio: "inherit",
    cwd: ROOT,
  });
  if (run.status === 0) {
    built += 1;
    continue;
  }
  failed.push(folder.name);
}

console.log(`games built: ${built}${failed.length > 0 ? `, failed: ${failed.join(", ")}` : ""}`);
if (failed.length > 0) process.exit(1);
