import { createBrowserRouter } from "react-router";
import { RedirectIfAuthenticated, RequireAuth } from "./features/auth/RequireAuth";
import { DashboardPage } from "./pages/DashboardPage";
import { EditorPage } from "./pages/EditorPage";
import { LandingPage } from "./pages/LandingPage";
import { LoginPage } from "./pages/LoginPage";
import { NotFoundPage } from "./pages/NotFoundPage";
import { SignupPage } from "./pages/SignupPage";

export const router = createBrowserRouter([
  { path: "/", element: <LandingPage /> },
  {
    element: <RedirectIfAuthenticated />,
    children: [
      { path: "/login", element: <LoginPage /> },
      { path: "/signup", element: <SignupPage /> },
    ],
  },
  {
    element: <RequireAuth />,
    children: [
      { path: "/books", element: <DashboardPage /> },
      { path: "/books/:bookId", element: <EditorPage /> },
    ],
  },
  { path: "*", element: <NotFoundPage /> },
]);
