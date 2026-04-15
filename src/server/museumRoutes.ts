import { existsSync } from "node:fs";
import path from "node:path";
import { sql } from "bun";
import { Database } from "bun:sqlite";

import { getMuseumDataRoot } from "../lib/museumDataRoot";

function usePostgresForMuseum(): boolean {
  return Boolean(process.env.DATABASE_URL?.trim());
}

type Row = {
  id_drink: string;
  name: string;
  image_local: string | null;
  thumb_url: string | null;
  payload_json: string;
};

let dbCache: Database | null = null;
let dbRootCache: string | null = null;

function getDb(root: string): Database | null {
  const dbPath = path.join(root, "cocktails.sqlite");
  if (!existsSync(dbPath)) return null;
  if (dbCache && dbRootCache === root) return dbCache;
  try {
    dbCache?.close();
  } catch {
    /* ignore */
  }
  dbCache = new Database(dbPath, { readonly: true });
  dbRootCache = root;
  return dbCache;
}

function imageSrcForRow(root: string, row: Row): string {
  if (row.image_local) {
    const abs = path.join(root, row.image_local);
    if (existsSync(abs)) {
      return `/api/museum/drink-image/${encodeURIComponent(row.id_drink)}`;
    }
  }
  return row.thumb_url ?? "";
}

/** Thumbnail URLs only — for static hosting there is no `/api/museum/drink-image` route. */
function imageSrcForStaticExport(root: string, row: Row): string {
  if (row.image_local) {
    const abs = path.join(root, row.image_local);
    if (existsSync(abs)) {
      return row.thumb_url ?? "";
    }
  }
  return row.thumb_url ?? "";
}

type CocktailPayload = Record<string, unknown>;

type CocktailIngredientDto = {
  name: string;
  measure: string;
  image: string;
};

function textField(payload: CocktailPayload, key: string): string {
  const value = payload[key];
  return typeof value === "string" ? value.trim() : "";
}

function ingredientImageSrc(name: string): string {
  return `https://www.thecocktaildb.com/images/ingredients/${encodeURIComponent(name)}-small.png`;
}

function ingredientsFromPayload(payload: CocktailPayload): CocktailIngredientDto[] {
  const ingredients: CocktailIngredientDto[] = [];
  for (let i = 1; i <= 15; i++) {
    const name = textField(payload, `strIngredient${i}`);
    if (!name) continue;
    const measure = textField(payload, `strMeasure${i}`);
    ingredients.push({
      name,
      measure,
      image: ingredientImageSrc(name),
    });
  }
  return ingredients;
}

function detailsFromPayload(payloadJson: string): {
  description: string;
  ingredients: CocktailIngredientDto[];
} {
  try {
    const payload = JSON.parse(payloadJson) as CocktailPayload;
    return {
      description: textField(payload, "strInstructions"),
      ingredients: ingredientsFromPayload(payload),
    };
  } catch {
    return {
      description: "",
      ingredients: [],
    };
  }
}

export type MuseumCocktailDto = {
  id: string;
  name: string;
  image: string;
  description: string;
  ingredients: CocktailIngredientDto[];
};

export type MuseumCocktailsPayload =
  | { ok: true; cocktails: MuseumCocktailDto[] }
  | {
      ok: false;
      error: string;
      dataRoot: string;
      cocktails: [];
    };

/** When `DATABASE_URL` is set, reads `public.cocktails` (id_drink, name only — no payload in Postgres yet). */
async function getMuseumCocktailsFromPostgres(): Promise<MuseumCocktailsPayload> {
  const root = getMuseumDataRoot();
  try {
    const rows = await sql<{ id_drink: string; name: string }[]>`
      select id_drink, name
      from public.cocktails
      order by lower(name)
    `;
    const cocktails: MuseumCocktailDto[] = rows.map(r => ({
      id: String(r.id_drink ?? "").trim(),
      name: String(r.name ?? "").trim(),
      image: "",
      description: "",
      ingredients: [],
    }));
    return { ok: true, cocktails };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return {
      ok: false,
      error: `Postgres (DATABASE_URL): ${msg}`,
      dataRoot: root,
      cocktails: [],
    };
  }
}

export function getMuseumCocktailsPayload(staticExport: boolean): MuseumCocktailsPayload {
  const root = getMuseumDataRoot();
  const db = getDb(root);
  if (!db) {
    return {
      ok: false,
      error: "Museum database not found",
      dataRoot: root,
      cocktails: [],
    };
  }

  const rows = db
    .query(
      `SELECT id_drink, name, image_local, thumb_url, payload_json
       FROM cocktails
       ORDER BY name COLLATE NOCASE`,
    )
    .all() as Row[];

  const pickImage = staticExport ? imageSrcForStaticExport : imageSrcForRow;
  const cocktails: MuseumCocktailDto[] = rows.map(row => {
    const details = detailsFromPayload(row.payload_json);
    return {
      id: row.id_drink,
      name: row.name,
      image: pickImage(root, row),
      description: details.description,
      ingredients: details.ingredients,
    };
  });

  return { ok: true, cocktails };
}

export async function getMuseumCocktailsPayloadResolved(
  staticExport: boolean,
): Promise<MuseumCocktailsPayload> {
  if (usePostgresForMuseum()) {
    return getMuseumCocktailsFromPostgres();
  }
  return getMuseumCocktailsPayload(staticExport);
}

export function museumRouteHandlers(): Record<string, unknown> {
  return {
    "/api/museum/cocktails": {
      async GET() {
        const payload = await getMuseumCocktailsPayloadResolved(false);
        if (!payload.ok) {
          return Response.json(payload, { status: 503 });
        }
        return Response.json(payload);
      },
    },

    "/api/museum/drink-image/:id": async (req: { params: { id: string } }) => {
      const id = req.params.id;
      if (!/^\d+$/.test(id)) {
        return new Response("Invalid id", { status: 400 });
      }
      const root = getMuseumDataRoot();
      const rel = path.join("images", "drinks", `${id}.jpg`);
      const abs = path.join(root, rel);
      if (!existsSync(abs)) {
        return new Response("Not found", { status: 404 });
      }
      return new Response(Bun.file(abs), {
        headers: {
          "Content-Type": "image/jpeg",
          "Cache-Control": "public, max-age=86400",
        },
      });
    },
  };
}
