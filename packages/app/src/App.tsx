import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "react-router-dom";
import "./i18n";
import { AuthProvider, useAuth } from "./auth/AuthContext";
import { LoginPage } from "./auth/LoginPage";
import { RepositoryProvider } from "./data/RepositoryContext";
import { Spinner } from "./components/ui";
import { router } from "./routes";

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 5_000, retry: 1, refetchOnWindowFocus: false } },
});

function Gate(): JSX.Element {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="flex min-h-full items-center justify-center bg-slate-100">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }
  if (!user) return <LoginPage />;
  return <RouterProvider router={router} />;
}

export function App(): JSX.Element {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <RepositoryProvider>
          <Gate />
        </RepositoryProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
