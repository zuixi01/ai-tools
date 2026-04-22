import { Suspense } from "react";
import { TargetManager } from "@/components/target-manager";

export default function TargetsPage() {
  return (
    <Suspense fallback={<div className="text-sm text-slate-500">Loading targets...</div>}>
      <TargetManager />
    </Suspense>
  );
}
