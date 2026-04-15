export type CocktailCard = {
  id: string;
  name: string;
  image: string;
  description: string;
  ingredients: string[];
  x: number;
  y: number;
};

export type MuseumCocktailInput = {
  id: string;
  name: string;
  image: string;
  description: string;
  ingredients: string[];
};

function jitter(seed: number): number {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

const COLS = 10;
const CELL_X = 240;
const CELL_Y = 300;

export function museumLayoutFromItems(items: MuseumCocktailInput[]): {
  cocktails: CocktailCard[];
  width: number;
  height: number;
} {
  const cocktails: CocktailCard[] = items.map((item, i) => {
    const col = i % COLS;
    const row = Math.floor(i / COLS);
    const jx = (jitter(i) - 0.5) * 72;
    const jy = (jitter(i + 31) - 0.5) * 56;
    return {
      id: item.id,
      name: item.name,
      image: item.image,
      description: item.description,
      ingredients: item.ingredients,
      x: col * CELL_X + jx + 80,
      y: row * CELL_Y + jy + 80,
    };
  });

  const n = Math.max(items.length, 1);
  return {
    cocktails,
    width: COLS * CELL_X + 320,
    height: Math.ceil(n / COLS) * CELL_Y + 320,
  };
}

export function museumStats(drinkCount: number) {
  return {
    drinks: drinkCount,
    recipes: drinkCount * 2,
  };
}
