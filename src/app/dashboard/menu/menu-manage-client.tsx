"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import {
  CATEGORY_ORDER,
  categoryRank,
  formatINR,
  getDishRisk,
  getIngredients,
  type DishRisk,
  type Ingredient,
  type Restaurant,
} from "@/lib/engine";
import { setDishActive, upsertDish } from "@/app/actions";
import { CATEGORY_TINT } from "@/lib/status-colors";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type RecipeDraft = { ingredientId: string; qty: string };

type DishDraft = {
  id?: string;
  name: string;
  price: string;
  category: string;
  veg: boolean;
  recipe: RecipeDraft[];
};

const EMPTY_DRAFT: DishDraft = {
  name: "",
  price: "",
  category: CATEGORY_ORDER[0],
  veg: true,
  recipe: [{ ingredientId: "", qty: "" }],
};

function DishDialog({
  restaurantId,
  ingredients,
  draft,
  onClose,
  onSaved,
}: {
  restaurantId: string;
  ingredients: Ingredient[];
  draft: DishDraft | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<DishDraft>(draft ?? EMPTY_DRAFT);
  const [busy, setBusy] = useState(false);

  const [lastDraft, setLastDraft] = useState(draft);
  if (draft !== lastDraft) {
    setLastDraft(draft);
    setForm(draft ?? EMPTY_DRAFT);
  }

  const setRecipeRow = (i: number, patch: Partial<RecipeDraft>) =>
    setForm((f) => ({
      ...f,
      recipe: f.recipe.map((r, idx) => (idx === i ? { ...r, ...patch } : r)),
    }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const recipe = form.recipe
      .filter((r) => r.ingredientId && Number(r.qty) > 0)
      .map((r) => ({ ingredientId: r.ingredientId, qty: Number(r.qty) }));
    setBusy(true);
    const result = await upsertDish(
      restaurantId,
      {
        id: form.id,
        name: form.name,
        price: Number(form.price),
        category: form.category,
        veg: form.veg,
      },
      recipe
    );
    setBusy(false);
    if (!result.ok) toast.error(result.error);
    else {
      toast.success(form.id ? `${form.name} updated — availability recomputed` : `${form.name} added to the menu`);
      onSaved();
      onClose();
    }
  }

  const usedIds = new Set(form.recipe.map((r) => r.ingredientId));

  return (
    <Dialog open={draft !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{form.id ? `Edit ${form.name || "dish"}` : "New dish"}</DialogTitle>
          <DialogDescription>
            Availability is computed from the recipe — change a quantity and
            portions-left recalculates everywhere, live.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 space-y-1.5">
              <Label htmlFor="dish-name">Name</Label>
              <Input
                id="dish-name"
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="dish-price">Price (₹)</Label>
              <Input
                id="dish-price"
                type="number"
                min="1"
                required
                value={form.price}
                onChange={(e) => setForm({ ...form, price: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Category</Label>
              <Select
                value={form.category}
                onValueChange={(v) => setForm({ ...form, category: v })}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORY_ORDER.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label>Type</Label>
              <Select
                value={form.veg ? "veg" : "nonveg"}
                onValueChange={(v) => setForm({ ...form, veg: v === "veg" })}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="veg">Vegetarian</SelectItem>
                  <SelectItem value="nonveg">Non-vegetarian</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label className="mb-2 block">Recipe (per portion)</Label>
            <div className="space-y-2">
              {form.recipe.map((row, i) => {
                const ing = ingredients.find((x) => x.id === row.ingredientId);
                return (
                  <div key={i} className="flex items-center gap-2">
                    <Select
                      value={row.ingredientId || undefined}
                      onValueChange={(v) => setRecipeRow(i, { ingredientId: v })}
                    >
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder="Ingredient" />
                      </SelectTrigger>
                      <SelectContent>
                        {ingredients
                          .filter((x) => x.id === row.ingredientId || !usedIds.has(x.id))
                          .map((x) => (
                            <SelectItem key={x.id} value={x.id}>
                              {x.name}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                    <Input
                      type="number"
                      step="0.001"
                      min="0"
                      placeholder="qty"
                      value={row.qty}
                      onChange={(e) => setRecipeRow(i, { qty: e.target.value })}
                      className="w-24 tabular-nums"
                    />
                    <span className="w-8 shrink-0 text-xs text-muted-foreground">
                      {ing?.unit ?? ""}
                    </span>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 shrink-0"
                      onClick={() =>
                        setForm((f) => ({
                          ...f,
                          recipe:
                            f.recipe.length > 1
                              ? f.recipe.filter((_, idx) => idx !== i)
                              : f.recipe,
                        }))
                      }
                    >
                      ×
                    </Button>
                  </div>
                );
              })}
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="mt-2"
              onClick={() =>
                setForm((f) => ({
                  ...f,
                  recipe: [...f.recipe, { ingredientId: "", qty: "" }],
                }))
              }
            >
              + Add ingredient
            </Button>
          </div>

          <DialogFooter>
            <Button type="submit" disabled={busy} className="w-full">
              {busy ? "Saving…" : form.id ? "Save changes" : "Add dish"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function MenuManageClient({
  restaurant,
  initialRisk,
  initialIngredients,
}: {
  restaurant: Restaurant;
  initialRisk: DishRisk[];
  initialIngredients: Ingredient[];
}) {
  const [risk, setRisk] = useState(initialRisk);
  const [ingredients, setIngredients] = useState(initialIngredients);
  const [draft, setDraft] = useState<DishDraft | null>(null);

  const refetch = useCallback(async () => {
    const supabase = createClient();
    const [freshRisk, freshIngredients] = await Promise.all([
      getDishRisk(supabase, restaurant.id),
      getIngredients(supabase, restaurant.id),
    ]);
    setRisk(freshRisk);
    setIngredients(freshIngredients);
  }, [restaurant.id]);

  useEffect(() => {
    const supabase = createClient();
    let timer: ReturnType<typeof setTimeout> | null = null;
    const schedule = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(refetch, 300);
    };
    const channel = supabase
      .channel(`menu-manage-${restaurant.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "dishes", filter: `restaurant_id=eq.${restaurant.id}` },
        schedule
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "stock_events", filter: `restaurant_id=eq.${restaurant.id}` },
        schedule
      )
      .subscribe();
    return () => {
      if (timer) clearTimeout(timer);
      supabase.removeChannel(channel);
    };
  }, [restaurant.id, refetch]);

  async function openEdit(dish: DishRisk) {
    const supabase = createClient();
    const { data: recipe } = await supabase
      .from("recipe_items")
      .select("ingredient_id, qty_per_portion")
      .eq("dish_id", dish.id);
    setDraft({
      id: dish.id,
      name: dish.name,
      price: String(dish.price),
      category: dish.category,
      veg: dish.veg,
      recipe:
        recipe && recipe.length > 0
          ? recipe.map((r) => ({
              ingredientId: r.ingredient_id,
              qty: String(r.qty_per_portion),
            }))
          : [{ ingredientId: "", qty: "" }],
    });
  }

  const sorted = [...risk].sort(
    (a, b) =>
      categoryRank(a.category) - categoryRank(b.category) ||
      a.name.localeCompare(b.name)
  );

  return (
    <div className="mx-auto w-full max-w-5xl">
      <div className="mt-6 flex items-center justify-between">
        <div>
          <h1 className="font-serif text-2xl font-medium tracking-tight">Menu</h1>
          <p className="text-xs text-muted-foreground">
            {risk.length} dishes · recipes drive availability
          </p>
        </div>
        <Button size="sm" onClick={() => setDraft(EMPTY_DRAFT)}>
          Add dish
        </Button>
      </div>

      <div className="mt-6 rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Dish</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Price</TableHead>
              <TableHead>Portions</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.map((dish) => {
              const out = dish.portions_left <= 0;
              return (
                <TableRow key={dish.id} className={!dish.is_active ? "opacity-60" : ""}>
                  <TableCell className="font-medium">
                    <span className={!dish.is_active ? "line-through decoration-brass/60" : ""}>
                      {dish.name}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={`font-normal ${CATEGORY_TINT[dish.category] ?? "text-muted-foreground"}`}
                    >
                      {dish.category}
                    </Badge>
                  </TableCell>
                  <TableCell className="tabular-nums text-muted-foreground">
                    {formatINR(dish.price)}
                  </TableCell>
                  <TableCell className="tabular-nums">{dish.portions_left}</TableCell>
                  <TableCell>
                    {!dish.is_active ? (
                      <Badge variant="destructive" className="font-mono">86&apos;d manually</Badge>
                    ) : out ? (
                      <Badge variant="destructive" className="font-mono">86&apos;d — no stock</Badge>
                    ) : (
                      <Badge variant="outline" className="text-muted-foreground">On menu</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1.5">
                      <Button size="sm" variant="outline" onClick={() => openEdit(dish)}>
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant={dish.is_active ? "outline" : "secondary"}
                        className={dish.is_active ? "text-red-400" : ""}
                        onClick={async () => {
                          const result = await setDishActive(dish.id, !dish.is_active);
                          if (!result.ok) toast.error(result.error);
                          else
                            toast.success(
                              dish.is_active
                                ? `${dish.name} struck off the menu`
                                : `${dish.name} is back on the menu`
                            );
                          refetch();
                        }}
                      >
                        {dish.is_active ? "86 it" : "Bring back"}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        Edit a recipe quantity and watch portions-left recompute across every
        screen — the availability engine reads recipes live.
      </p>

      <DishDialog
        restaurantId={restaurant.id}
        ingredients={ingredients}
        draft={draft}
        onClose={() => setDraft(null)}
        onSaved={refetch}
      />
    </div>
  );
}
