"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createStaff } from "@/app/actions";
import { formatDate, formatDateTime } from "@/lib/engine";
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
import type { StaffMember } from "./page";

export function StaffClient({ staff }: { staff: StaffMember[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    email: "",
    password: "",
    role: "kitchen" as "owner" | "kitchen" | "waiter",
  });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const result = await createStaff(form.email, form.password, form.role);
    setBusy(false);
    if (!result.ok) toast.error(result.error);
    else {
      toast.success(`${form.role} account created`, {
        description: `Hand over: ${form.email} / ${form.password}`,
        duration: 12000,
      });
      setOpen(false);
      setForm({ email: "", password: "", role: "kitchen" });
      router.refresh();
    }
  }

  return (
    <div className="mx-auto w-full max-w-4xl">
      <div className="mt-6 flex items-center justify-between">
        <div>
          <h1 className="font-serif text-2xl font-medium tracking-tight">Staff</h1>
          <p className="text-xs text-muted-foreground">
            Owners see everything; kitchen accounts land on the kitchen board; waiters land on the floor view.
            Access is scoped by row-level security.
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm">Add staff</Button>
          </DialogTrigger>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>New staff account</DialogTitle>
              <DialogDescription>
                The account is ready to sign in immediately — share the
                credentials with your staff member.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={submit} className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="staff-email">Email</Label>
                <Input
                  id="staff-email"
                  type="email"
                  required
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="staff-password">Temporary password</Label>
                <Input
                  id="staff-password"
                  required
                  minLength={8}
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Role</Label>
                <Select
                  value={form.role}
                  onValueChange={(v) => setForm({ ...form, role: v as typeof form.role })}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="kitchen">Kitchen</SelectItem>
                    <SelectItem value="waiter">Waiter / Floor</SelectItem>
                    <SelectItem value="owner">Owner / Manager</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <DialogFooter>
                <Button type="submit" disabled={busy} className="w-full">
                  {busy ? "Creating…" : "Create account"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="mt-6 rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Added</TableHead>
              <TableHead>Last sign-in</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {staff.map((member) => (
              <TableRow key={member.id}>
                <TableCell className="font-medium">{member.email}</TableCell>
                <TableCell>
                  <Badge
                    variant="outline"
                    className={member.role === "owner" ? "text-brass" : "text-muted-foreground"}
                  >
                    {member.role}
                  </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {formatDate(member.created_at)}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {member.lastSignIn
                    ? formatDateTime(member.lastSignIn)
                    : "Never"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
