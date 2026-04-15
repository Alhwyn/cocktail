#!/usr/bin/env bun
/**
 * Bulk export from TheCocktailDB (free test key tier): merge as many cocktail IDs as
 * possible via search-by-letter and list+filter endpoints, then fetch full details per ID
 * via lookup.php and save /large drink images locally.
 *
 * Note: The public API caps list endpoints and per-filter results; you will not get the
 * full premium catalog without a paid key. This script maximizes what the free API exposes.
 *
 * Usage:
 *   bun scripts/export-cocktaildb.ts
 *   bun scripts/export-cocktaildb.ts --json-only          # no image downloads
 *   bun scripts/export-cocktaildb.ts --stubs-only           # no lookup; stub JSON only (incomplete)
 *
 * Output: data/cocktaildb-export/drinks.json, data/cocktaildb-export/meta.json, images/*
 */

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { COCKTAILDB_BASE, thumbUrl } from "../src/cocktailApi.ts";

const OUT_DIR = path.join(process.cwd(), "data", "cocktaildb-export");
const IMAGES_DIR = path.join(OUT_DIR, "images");

const FIRST_CHARS = [
  ..."abcdefghijklmnopqrstuvwxyz".split(""),
  ..."0123456789".split(""),
];

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

type Stub = { idDrink: string; strDrink?: string; strDrinkThumb?: string | null };

type ApiDrink = Record<string, unknown> & { idDrink?: string; strDrinkThumb?: string | null };

type ExportDrink = ApiDrink & { localImage: string | null };

const jsonOnly = process.argv.includes("--json-only");
const stubsOnly = process.argv.includes("--stubs-only");

function spacesToUnderscores(s: string): string {
  return s.trim().replace(/\s+/g, "_");
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  return res.json() as Promise<T>;
}

async function fetchJsonRetry<T>(url: string, maxAttempts = 8): Promise<T> {
  let attempt = 0;
  while (true) {
    attempt += 1;
    const res = await fetch(url);
    if (res.status === 429 || res.status === 503) {
      const backoff = Math.min(45_000, 800 * 2 ** attempt + Math.random() * 400);
      if (attempt >= maxAttempts) {
        throw new Error(`${url}: HTTP ${res.status} after ${maxAttempts} attempts`);
      }
      console.warn(`  rate limited (${res.status}), waiting ${Math.round(backoff)}ms …`);
      await sleep(backoff);
      continue;
    }
    if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
    return res.json() as Promise<T>;
  }
}

async function searchByFirstChar(c: string): Promise<Stub[]> {
  const url = new URL(`${COCKTAILDB_BASE}/search.php`);
  url.searchParams.set("f", c);
  const data = await fetchJson<{ drinks: ApiDrink[] | null }>(url.toString());
  return (data.drinks ?? []).map(d => ({
    idDrink: String(d.idDrink ?? ""),
    strDrink: d.strDrink as string | undefined,
    strDrinkThumb: d.strDrinkThumb as string | null | undefined,
  }));
}

async function filterCategory(strCategory: string): Promise<Stub[]> {
  const url = new URL(`${COCKTAILDB_BASE}/filter.php`);
  url.searchParams.set("c", spacesToUnderscores(strCategory));
  const data = await fetchJson<{ drinks: Stub[] | null }>(url.toString());
  return data.drinks ?? [];
}

async function filterGlass(strGlass: string): Promise<Stub[]> {
  const url = new URL(`${COCKTAILDB_BASE}/filter.php`);
  url.searchParams.set("g", spacesToUnderscores(strGlass));
  const data = await fetchJson<{ drinks: Stub[] | null }>(url.toString());
  return data.drinks ?? [];
}

async function filterIngredient(name: string): Promise<Stub[]> {
  const url = new URL(`${COCKTAILDB_BASE}/filter.php`);
  url.searchParams.set("i", name);
  const data = await fetchJson<{ drinks: Stub[] | null }>(url.toString());
  return data.drinks ?? [];
}

async function filterAlcoholic(value: string): Promise<Stub[]> {
  const url = new URL(`${COCKTAILDB_BASE}/filter.php`);
  url.searchParams.set("a", spacesToUnderscores(value));
  const data = await fetchJson<{ drinks: Stub[] | null }>(url.toString());
  return data.drinks ?? [];
}

async function lookupDrink(id: string): Promise<ApiDrink | null> {
  const url = new URL(`${COCKTAILDB_BASE}/lookup.php`);
  url.searchParams.set("i", id);
  const data = await fetchJsonRetry<{ drinks: ApiDrink[] | null }>(url.toString());
  const d = data.drinks?.[0];
  return d ?? null;
}

function extFromUrl(imageUrl: string): string {
  try {
    const p = new URL(imageUrl).pathname;
    const ext = path.extname(p);
    return ext || ".jpg";
  } catch {
    return ".jpg";
  }
}

async function downloadThumb(idDrink: string, strDrinkThumb: string | null | undefined) {
  const sized = thumbUrl(strDrinkThumb ?? null, "large");
  if (!sized) return null;

  const ext = extFromUrl(sized);
  const filename = `${idDrink}${ext}`;
  const dest = path.join(IMAGES_DIR, filename);

  let res = await fetch(sized);
  if (res.status === 429 || res.status === 503) {
    await sleep(2000);
    res = await fetch(sized);
  }
  if (!res.ok) {
    console.warn(`  image ${idDrink}: HTTP ${res.status}`);
    return null;
  }

  const buf = Buffer.from(await res.arrayBuffer());
  await writeFile(dest, buf);
  return `images/${filename}`;
}

async function poolMap<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let i = 0;

  async function worker() {
    while (true) {
      const j = i++;
      if (j >= items.length) break;
      results[j] = await fn(items[j]!, j);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, () => worker()),
  );
  return results;
}

async function collectStubIds(): Promise<Map<string, Stub>> {
  const byId = new Map<string, Stub>();

  function addAll(stubs: Stub[]) {
    for (const s of stubs) {
      const id = s.idDrink;
      if (!id) continue;
      if (!byId.has(id)) byId.set(id, s);
    }
  }

  console.log("— By first letter / digit (search.php?f=)");
  for (const c of FIRST_CHARS) {
    process.stdout.write(`  f=${c} … `);
    const list = await searchByFirstChar(c);
    console.log(`${list.length}`);
    addAll(list);
    await sleep(100);
  }

  console.log("— By category (list.php?c=list + filter.php?c=)");
  const catList = await fetchJson<{ drinks: { strCategory: string }[] | null }>(
    `${COCKTAILDB_BASE}/list.php?c=list`,
  );
  for (const row of catList.drinks ?? []) {
    const label = row.strCategory;
    process.stdout.write(`  ${label} … `);
    const list = await filterCategory(label);
    console.log(`${list.length}`);
    addAll(list);
    await sleep(100);
  }

  console.log("— By glass (list.php?g=list + filter.php?g=)");
  const glassList = await fetchJson<{ drinks: { strGlass: string }[] | null }>(
    `${COCKTAILDB_BASE}/list.php?g=list`,
  );
  for (const row of glassList.drinks ?? []) {
    const label = row.strGlass;
    process.stdout.write(`  ${label} … `);
    const list = await filterGlass(label);
    console.log(`${list.length}`);
    addAll(list);
    await sleep(100);
  }

  console.log("— By ingredient (list.php?i=list + filter.php?i=)");
  const ingList = await fetchJson<{ drinks: { strIngredient1: string }[] | null }>(
    `${COCKTAILDB_BASE}/list.php?i=list`,
  );
  for (const row of ingList.drinks ?? []) {
    const label = row.strIngredient1;
    process.stdout.write(`  ${label.slice(0, 28).padEnd(28, " ")} … `);
    const list = await filterIngredient(label);
    console.log(`${list.length}`);
    addAll(list);
    await sleep(100);
  }

  console.log("— By alcohol flag (list.php?a=list + filter.php?a=)");
  const alcList = await fetchJson<{ drinks: { strAlcoholic: string }[] | null }>(
    `${COCKTAILDB_BASE}/list.php?a=list`,
  );
  for (const row of alcList.drinks ?? []) {
    const label = row.strAlcoholic;
    process.stdout.write(`  ${label} … `);
    const list = await filterAlcoholic(label);
    console.log(`${list.length}`);
    addAll(list);
    await sleep(100);
  }

  return byId;
}

async function main() {
  console.log(`Export dir: ${OUT_DIR}`);
  await mkdir(IMAGES_DIR, { recursive: true });

  const stubs = await collectStubIds();
  const ids = [...stubs.keys()].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  console.log(`\nUnique stub IDs: ${ids.length}`);

  let drinks: ExportDrink[];

  if (stubsOnly) {
    drinks = [...stubs.values()].map(s => ({
      ...(s as unknown as ApiDrink),
      localImage: null,
    }));
    drinks.sort((a, b) =>
      String(a.strDrink ?? "").localeCompare(String(b.strDrink ?? ""), undefined, {
        sensitivity: "base",
      }),
    );
  } else {
    console.log("\nFetching full records (lookup.php?i=) …");
    let done = 0;
    const full = await poolMap(ids, 2, async id => {
      const d = await lookupDrink(id);
      done += 1;
      if (done % 50 === 0 || done === ids.length) {
        console.log(`  lookup ${done}/${ids.length}`);
      }
      await sleep(150);
      return d;
    });

    const missing = full.filter(d => !d).length;
    if (missing) console.warn(`  missing lookups: ${missing}`);

    drinks = full
      .map((d, i) => {
        const id = ids[i]!;
        const base =
          d ?? ({ ...(stubs.get(id) as unknown as ApiDrink) } as ApiDrink);
        return { ...base, localImage: null as string | null };
      })
      .map(d => d as ExportDrink);

    drinks.sort((a, b) =>
      String(a.strDrink ?? "").localeCompare(String(b.strDrink ?? ""), undefined, {
        sensitivity: "base",
      }),
    );
  }

  if (!jsonOnly) {
    console.log("\nDownloading images (/large) …");
    drinks = await poolMap(drinks, 3, async d => {
      const id = String(d.idDrink ?? "");
      const local = await downloadThumb(id, d.strDrinkThumb);
      await sleep(120);
      return { ...d, localImage: local };
    });
  }

  const outPath = path.join(OUT_DIR, "drinks.json");
  await writeFile(outPath, JSON.stringify(drinks, null, 2), "utf8");

  const meta = {
    exportedAt: new Date().toISOString(),
    source: COCKTAILDB_BASE,
    uniqueIds: stubsOnly ? stubs.size : ids.length,
    drinkRecords: drinks.length,
    stubsOnly,
    jsonOnly,
    note:
      "Free-tier API limits how many items list/filter return per call; this export unions those views then lookup-by-id. For the full database, CocktailDB requires a premium key.",
  };
  await writeFile(path.join(OUT_DIR, "meta.json"), JSON.stringify(meta, null, 2), "utf8");

  console.log(`\nWrote ${outPath}`);
  console.log(`Wrote ${path.join(OUT_DIR, "meta.json")}`);
  if (!jsonOnly) {
    const withImg = drinks.filter(d => d.localImage).length;
    console.log(`Images saved: ${withImg} / ${drinks.length}`);
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
