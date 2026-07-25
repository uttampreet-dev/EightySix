import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-8 px-6 py-24 text-center">
      <Badge variant="outline" className="text-muted-foreground">
        Vibeathon 6.0 · Smart Restaurant Management
      </Badge>

      <div className="space-y-4">
        <h1 className="text-5xl font-semibold tracking-tight sm:text-7xl">
          Eighty<span className="text-destructive">Six</span>
        </h1>
        <p className="mx-auto max-w-xl text-lg text-muted-foreground sm:text-xl">
          The restaurant OS that sees the 86 coming — and acts before it
          happens.
        </p>
      </div>

      <p className="mx-auto max-w-md text-sm text-muted-foreground">
        <span className="font-medium text-foreground">&ldquo;86&rdquo;</span> is
        kitchen slang for a dish that just ran out and got struck off the menu.
      </p>

      <div className="flex flex-wrap items-center justify-center gap-3">
        <Button asChild size="lg">
          <Link href="/r/demo">Enter demo restaurant</Link>
        </Button>
        <Button asChild size="lg" variant="outline">
          <Link href="/kitchen">Kitchen view</Link>
        </Button>
        <Button asChild size="lg" variant="outline">
          <Link href="/dashboard">Owner dashboard</Link>
        </Button>
      </div>
    </main>
  );
}
