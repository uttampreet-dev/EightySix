"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import {
  formatINR,
  getIngredients,
  type Ingredient,
  type Restaurant,
} from "@/lib/engine";
import { createIngredient, updateIngredient } from "@/app/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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

function IngredientRow({ ingredient }: { ingredient: Ingredient }) {
  const [stock, setStock] = useState(String(ingredient.stock_qty));
  const [reorder, setReorder] = useState(String(ingredient.reorder_level));
  const [saving, setSaving] = useState(false);

  const [lastServer, setLastServer] = useState({
    stock: ingredient.stock_qty,
    reorder: ingredient.reorder_level,
  });
  if (
    lastServer.stock !== ingredient.stock_qty ||
    lastServer.reorder !== ingredient.reorder_level
  ) {
    setLastServer({ stock: ingredient.stock_qty, reorder: ingredient.reorder_level });
    setStock(String(ingredient.stock_qty));
    setReorder(String(ingredient.reorder_level));
  }

  const dirty =
    Number(stock) !== Number(ingredient.stock_qty) ||
    Number(reorder) !== Number(ingredient.reorder_level);
  const out = Number(ingredient.stock_qty) <= 0;
  const low = !out && Number(ingredient.stock_qty) <= Number(ingredient.reorder_level);

  async function save() {
    setSaving(true);
    const result = await updateIngredient(ingredient.id, {
      stockQty: Number(stock),
      reorderLevel: Number(reorder),
    });
    setSaving(false);
    if (!result.ok) toast.error(result.error);
    else toast.success(`${ingredient.name} updated`);
  }

  return (
    <TableRow>
      <TableCell className="font-medium">{ingredient.name}</TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          <Input
            type="number"
            step="0.1"
            min="0"
            value={stock}
            onChange={(e) => setStock(e.target.value)}
            className="h-8 w-24 tabular-nums"
          />
          <span className="text-xs text-muted-foreground">{ingredient.unit}</span>
        </div>
      </TableCell>
      <TableCell>
        <Input
          type="number"
          step="0.1"
          min="0"
          value={reorder}
          onChange={(e) => setReorder(e.target.value)}
          className="h-8 w-20 tabular-nums"
        />
      </TableCell>
      <TableCell className="tabular-nums text-muted-foreground">
        {formatINR(ingredient.cost_per_unit)}/{ingredient.unit}
      </TableCell>
      <TableCell>
        {out ? (
          <Badge variant="destructive">Out</Badge>
        ) : low ? (
          <Badge className="border-amber-500/40 bg-amber-500/15 text-amber-400">Low</Badge>
        ) : (
          <Badge variant="outline" className="text-muted-foreground">OK</Badge>
        )}
      </TableCell>
      <TableCell className="text-right">
        <Button size="sm" variant="secondary" disabled={!dirty || saving} onClick={save}>
          {saving ? "Saving…" : "Save"}
        </Button>
      </TableCell>
    </TableRow>
  );
}

function AddIngredientDialog({
  restaurantId,
  onCreated,
}: {
  restaurantId: string;
  onCreated: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    name: "",
    unit: "kg",
    stockQty: "0",
    reorderLevel: "1",
    costPerUnit: "0",
  });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const result = await createIngredient(restaurantId, {
      name: form.name,
      unit: form.unit,
      stockQty: Number(form.stockQty),
      reorderLevel: Number(form.reorderLevel),
      costPerUnit: Number(form.costPerUnit),
    });
    setBusy(false);
    if (!result.ok) toast.error(result.error);
    else {
      toast.success(`${form.name} added to inventory`);
      setOpen(false);
      setForm({ name: "", unit: "kg", stockQty: "0", reorderLevel: "1", costPerUnit: "0" });
      onCreated();
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">Add ingredient</Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>New ingredient</DialogTitle>
          <DialogDescription>
            It becomes available in recipes immediately.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="ing-name">Name</Label>
            <Input
              id="ing-name"
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Unit</Label>
              <Select value={form.unit} onValueChange={(v) => setForm({ ...form, unit: v })}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {["kg", "L", "pcs"].map((u) => (
                    <SelectItem key={u} value={u}>
                      {u}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ing-stock">Opening stock</Label>
              <Input
                id="ing-stock"
                type="number"
                step="0.1"
                min="0"
                value={form.stockQty}
                onChange={(e) => setForm({ ...form, stockQty: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ing-reorder">Reorder level</Label>
              <Input
                id="ing-reorder"
                type="number"
                step="0.1"
                min="0"
                value={form.reorderLevel}
                onChange={(e) => setForm({ ...form, reorderLevel: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ing-cost">Cost per unit (₹)</Label>
              <Input
                id="ing-cost"
                type="number"
                step="1"
                min="0"
                value={form.costPerUnit}
                onChange={(e) => setForm({ ...form, costPerUnit: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={busy} className="w-full">
              {busy ? "Adding…" : "Add ingredient"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function InventoryClient({
  restaurant,
  initialIngredients,
}: {
  restaurant: Restaurant;
  initialIngredients: Ingredient[];
}) {
  const [ingredients, setIngredients] = useState(initialIngredients);

  const refetch = useCallback(async () => {
    setIngredients(await getIngredients(createClient(), restaurant.id));
  }, [restaurant.id]);

  useEffect(() => {
    const supabase = createClient();
    let timer: ReturnType<typeof setTimeout> | null = null;
    const schedule = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(refetch, 300);
    };
    const channel = supabase
      .channel(`inventory-${restaurant.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "stock_events", filter: `restaurant_id=eq.${restaurant.id}` },
        schedule
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "ingredients", filter: `restaurant_id=eq.${restaurant.id}` },
        schedule
      )
      .subscribe();
    return () => {
      if (timer) clearTimeout(timer);
      supabase.removeChannel(channel);
    };
  }, [restaurant.id, refetch]);

  const lowCount = ingredients.filter(
    (i) => Number(i.stock_qty) <= Number(i.reorder_level)
  ).length;

  return (
    <div className="mx-auto w-full max-w-5xl">
      <div className="mt-6 flex items-center justify-between">
        <div>
          <h1 className="font-serif text-2xl font-medium tracking-tight">Inventory</h1>
          <p className="text-xs text-muted-foreground">
            {ingredients.length} ingredients · {lowCount} at or below reorder level
          </p>
        </div>
        <AddIngredientDialog restaurantId={restaurant.id} onCreated={refetch} />
      </div>

      <div className="mt-6 rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Ingredient</TableHead>
              <TableHead>Stock</TableHead>
              <TableHead>Reorder at</TableHead>
              <TableHead>Cost</TableHead>
              <TableHead>Status</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {ingredients.map((ingredient) => (
              <IngredientRow key={ingredient.id} ingredient={ingredient} />
            ))}
          </TableBody>
        </Table>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        Stock edits flow through the event ledger — every change is auditable in
        the overview feed, and dish availability recomputes instantly.
      </p>
    </div>
  );
}
