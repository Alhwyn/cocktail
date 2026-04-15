import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { museumSqlitePath } from "./museumDataRoot.ts";

export type CocktailSeedRow = { id_drink: string; name: string };

async function loadFromSqlite(dbPath: string): Promise<CocktailSeedRow[]> {
  const { Database } = await import("bun:sqlite");
  const db = new Database(dbPath, { readonly: true });
  try {
    const rows = db
      .query<{ id_drink: string; name: string }, []>(
        "SELECT id_drink, name FROM cocktails ORDER BY name",
      )
      .all();
    return rows.map(r => ({
      id_drink: String(r.id_drink ?? "").trim(),
      name: String(r.name ?? "").trim(),
    }));
  } finally {
    db.close();
  }
}

async function loadFromExportJson(filePath: string): Promise<CocktailSeedRow[]> {
  const raw = await readFile(filePath, "utf8");
  const drinks = JSON.parse(raw) as Array<Record<string, unknown>>;
  return drinks.map(d => ({
    id_drink: String(d.idDrink ?? "").trim(),
    name: String(d.strDrink ?? "").trim(),
  }));
}

function dedupeAndFilter(rows: CocktailSeedRow[]): CocktailSeedRow[] {
  const map = new Map<string, string>();
  for (const r of rows) {
    if (!r.id_drink) continue;
    const name = r.name || "Unknown";
    map.set(r.id_drink, name);
  }
  return [...map.entries()].map(([id_drink, name]) => ({ id_drink, name }));
}

/** SQLite museum DB first, else CocktailDB export JSON. */
export async function loadCocktailSeedRows(options?: {
  logSource?: boolean;
}): Promise<CocktailSeedRow[]> {
  const sqlitePath = museumSqlitePath();
  if (existsSync(sqlitePath)) {
    if (options?.logSource) console.log(`Source: SQLite ${sqlitePath}`);
    return dedupeAndFilter(await loadFromSqlite(sqlitePath));
  }

  const jsonPath = path.join(process.cwd(), "data", "cocktaildb-export", "drinks.json");
  if (existsSync(jsonPath)) {
    if (options?.logSource) console.log(`Source: ${jsonPath}`);
    return dedupeAndFilter(await loadFromExportJson(jsonPath));
  }

  throw new Error(
    "No cocktail data found. Put cocktails.sqlite on the museum data path (see COCKTAIL_MUSEUM_DATA / museumDataRoot), or run `bun run export:cocktaildb` to create data/cocktaildb-export/drinks.json.",
  );
}
