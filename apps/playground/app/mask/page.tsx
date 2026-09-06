import { MaskHost } from "../mask-host";

export default function MaskPage() {
  return (
    <main className="min-h-svh bg-background p-4">
      <h1 className="mb-4 text-lg font-semibold">Region mask host</h1>
      <p className="mb-4 max-w-xl text-sm text-muted-foreground">
        This Next playground rasterizes <code>rect</code> and{" "}
        <code>circle</code> mask nodes from document JSON. Canvas does
        not own the bitmap.
      </p>
      <MaskHost className="h-[58svh] min-h-[22.5rem] w-full overflow-hidden rounded-[var(--dc-radius,var(--radius))] border border-border bg-card" />
    </main>
  );
}
