import { SHARED_VERSION } from "@snackmanager/shared";

export function App() {
  return (
    <main className="flex min-h-full flex-col items-center justify-center gap-2 p-8 text-slate-800">
      <h1 className="text-2xl font-semibold">SnackManager</h1>
      <p className="text-sm text-slate-500">
        Scaffold ready — shared core v{SHARED_VERSION}. Screens land in Phase 3.
      </p>
    </main>
  );
}
