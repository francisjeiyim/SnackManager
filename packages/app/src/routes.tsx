import { createBrowserRouter } from "react-router-dom";
import { AppLayout } from "./components/AppLayout";
import { BoardPage } from "./features/board/BoardPage";
import { InvoicesPage } from "./features/invoices/InvoicesPage";
import { LayoutEditorPage } from "./features/layout-editor/LayoutEditorPage";
import { ProductsPage } from "./features/products/ProductsPage";
import { ReportsPage } from "./features/reports/ReportsPage";
import { SettingsPage } from "./features/settings/SettingsPage";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <AppLayout />,
    children: [
      { index: true, element: <BoardPage /> },
      { path: "rooms", element: <LayoutEditorPage /> },
      { path: "invoices", element: <InvoicesPage /> },
      { path: "reports", element: <ReportsPage /> },
      { path: "products", element: <ProductsPage /> },
      { path: "settings", element: <SettingsPage /> },
    ],
  },
]);
