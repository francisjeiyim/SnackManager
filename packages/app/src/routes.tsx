import { createBrowserRouter } from "react-router-dom";
import { AppLayout } from "./components/AppLayout";
import { BoardPage } from "./features/board/BoardPage";
import { InvoicesPage } from "./features/invoices/InvoicesPage";
import { ProductsPage } from "./features/products/ProductsPage";
import { SettingsPage } from "./features/settings/SettingsPage";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <AppLayout />,
    children: [
      { index: true, element: <BoardPage /> },
      { path: "invoices", element: <InvoicesPage /> },
      { path: "products", element: <ProductsPage /> },
      { path: "settings", element: <SettingsPage /> },
    ],
  },
]);
