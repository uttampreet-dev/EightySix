// Dish photography (Wikimedia Commons, CC-licensed) shipped with the app.
// Seeded dishes resolve by slug; dishes created through the menu editor fall
// back to a typographic tile so the grid never breaks.
const SEEDED = new Set([
  "paneer-tikka",
  "hara-bhara-kebab",
  "tandoori-chicken-half",
  "chicken-malai-tikka",
  "mutton-seekh-kebab",
  "butter-paneer",
  "dal-makhani",
  "palak-paneer",
  "kadhai-paneer",
  "chana-masala",
  "rajma-masala",
  "aloo-gobi",
  "butter-chicken",
  "chicken-tikka-masala",
  "mutton-rogan-josh",
  "butter-naan",
  "garlic-naan",
  "tandoori-roti",
  "laccha-paratha",
  "steamed-basmati-rice",
  "jeera-rice",
  "veg-biryani",
  "chicken-biryani",
  "sweet-lassi",
  "mango-lassi",
  "masala-chai",
  "gulab-jamun",
  "kheer",
]);

export function dishSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

// Explicit img column wins; otherwise fall back to the bundled photo.
export function dishImage(dish: { name: string; img?: string | null }): string | null {
  if (dish.img) return dish.img;
  const slug = dishSlug(dish.name);
  return SEEDED.has(slug) ? `/dishes/${slug}.jpg` : null;
}
