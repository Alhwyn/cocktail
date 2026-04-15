#!/usr/bin/env bun
/**
 * Upsert cocktail rows into Supabase Postgres `public.cocktails` (id_drink, name).
 *
 * Data source: see `loadCocktailSeedRows()` in src/lib/cocktailSeedRows.ts
 *
 * Requires DATABASE_URL (Postgres URI with a role that can write past RLS).
 *
 * Usage:
 *   DATABASE_URL="postgresql://..." bun scripts/upload-cocktails-to-supabase.ts
 *
 * CLI alternative (linked project, no DATABASE_URL):
 *   bun run cocktails:upload:cli
 *
 * Optional:
 *   --dry-run    print counts only, no DB writes
 */

import { sql, type SQL } from "bun";

import { loadCocktailSeedRows, type CocktailSeedRow } from "../src/lib/cocktailSeedRows.ts";

const dryRun = process.argv.includes("--dry-run");

async function upsertBatch(tx: SQL, batch: CocktailSeedRow[]): Promise<void> {
  for (const r of batch) {
    await tx`
      insert into public.cocktails (id_drink, name)
      values (${r.id_drink}, ${r.name})
      on conflict (id_drink) do update set
        name = excluded.name,
        updated_at = now()
    `;
  }
}

async function main(): Promise<void> {
  const rows = await loadCocktailSeedRows({ logSource: true });
  console.log(`Loaded ${rows.length} cocktails (after dedupe).`);

  if (dryRun) {
    console.log("Dry run: no database writes.");
    return;
  }

  if (!process.env.DATABASE_URL?.trim()) {
    throw new Error(
      "DATABASE_URL is not set. Use your Supabase Postgres connection string, or run `bun run cocktails:upload:cli` to load via `supabase db query --linked`.",
    );
  }

  const BATCH = 100;
  await sql.begin(async tx => {
    for (let i = 0; i < rows.length; i += BATCH) {
      const batch = rows.slice(i, i + BATCH);
      await upsertBatch(tx, batch);
      console.log(`Upserted ${Math.min(i + BATCH, rows.length)} / ${rows.length}`);
    }
  });

  console.log("Done.");
  await sql.close({ timeout: 5 });
}

main().catch(err => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
