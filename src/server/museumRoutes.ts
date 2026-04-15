import { existsSync } from "node:fs";
import path from "node:path";
import { Database } from "bun:sqlite";

import { getMuseumDataRoot } from "../lib/museumDataRoot";

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

type CocktailPayload = Record<string, unknown>;

function textField(payload: CocktailPayload, key: string): string {
  const value = payload[key];
  return typeof value === "string" ? value.trim() : "";
}

function ingredientsFromPayload(payload: CocktailPayload): string[] {
  const ingredients: string[] = [];
  for (let i = 1; i <= 15; i++) {
    const ingredient = textField(payload, `strIngredient${i}`);
    if (!ingredient) continue;
    const measure = textField(payload, `strMeasure${i}`);
    ingredients.push(measure ? `${measure} ${ingredient}` : ingredient);
  }
  return ingredients;
}

function detailsFromPayload(payloadJson: string): {
  description: string;
  ingredients: string[];
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
  ingredients: string[];
};

export function museumRouteHandlers(): Record<string, unknown> {
  return {
    "/api/museum/cocktails": {
      async GET() {
        const root = getMuseumDataRoot();
        const db = getDb(root);
        if (!db) {
          return Response.json(
            {
              ok: false,
              error: "Museum database not found",
              dataRoot: root,
              cocktails: [] as MuseumCocktailDto[],
            },
            { status: 503 },
          );
        }

        const rows = db
          .query(
            `SELECT id_drink, name, image_local, thumb_url, payload_json
             FROM cocktails
             ORDER BY name COLLATE NOCASE`,
          )
          .all() as Row[];

        const cocktails: MuseumCocktailDto[] = rows.map(row => {
          const details = detailsFromPayload(row.payload_json);
          return {
            id: row.id_drink,
            name: row.name,
            image: imageSrcForRow(root, row),
            description: details.description,
            ingredients: details.ingredients,
          };
        });

        return Response.json({ ok: true, cocktails });
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
