import { existsSync } from "node:fs";
import path from "node:path";

const SQLITE = "cocktails.sqlite";

/** Override with absolute path to the folder containing cocktails.sqlite and images/. */
export function getMuseumDataRoot(): string {
  const env = process.env.COCKTAIL_MUSEUM_DATA?.trim();
  if (env) {
    const resolved = path.resolve(env);
    if (existsSync(path.join(resolved, SQLITE))) return resolved;
  }

  const sibling = path.resolve(process.cwd(), "../cocktail-app/data");
  if (existsSync(path.join(sibling, SQLITE))) return sibling;

  return path.join(process.cwd(), "data", "museum");
}

export function museumSqlitePath(): string {
  return path.join(getMuseumDataRoot(), SQLITE);
}
