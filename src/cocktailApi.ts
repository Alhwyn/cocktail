export const COCKTAILDB_BASE = "https://www.thecocktaildb.com/api/json/v1/1";

export type CocktailDrink = {
  idDrink: string;
  strDrink: string;
  strDrinkThumb: string | null;
};

type SearchResponse = {
  drinks: CocktailDrink[] | null;
};

function normalizeDrink(raw: CocktailDrink): CocktailDrink {
  return {
    idDrink: String(raw.idDrink ?? ""),
    strDrink: String(raw.strDrink ?? ""),
    strDrinkThumb:
      raw.strDrinkThumb == null || raw.strDrinkThumb === ""
        ? null
        : String(raw.strDrinkThumb),
  };
}

export function thumbUrl(
  url: string | null,
  size: "small" | "medium" | "large" = "small",
): string | null {
  if (!url) return null;
  const trimmed = url.replace(/\/(small|medium|large)\/?$/i, "").replace(/\/$/, "");
  return `${trimmed}/${size}`;
}

export async function searchCocktailsByName(query: string): Promise<CocktailDrink[]> {
  const q = query.trim();
  if (!q) return [];

  const url = new URL(`${COCKTAILDB_BASE}/search.php`);
  url.searchParams.set("s", q);

  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`Search failed: ${res.status}`);

  const data = (await res.json()) as SearchResponse;
  if (!data.drinks?.length) return [];

  return data.drinks.map(normalizeDrink);
}

export async function randomCocktail(): Promise<CocktailDrink | null> {
  const res = await fetch(`${COCKTAILDB_BASE}/random.php`);
  if (!res.ok) throw new Error(`Random failed: ${res.status}`);

  const data = (await res.json()) as SearchResponse;
  const raw = data.drinks?.[0];
  if (!raw) return null;

  return normalizeDrink(raw);
}
