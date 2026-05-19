import { createBrowserRouter } from "react-router";
import Upload from "./pages/Upload";
import Processing from "./pages/Processing";
import Dashboard from "./pages/Dashboard";
import SchedulePage from "./pages/SchedulePage";
import SurgEyePage from "./pages/SurgEye";

export const router = createBrowserRouter([
  {
    path: "/",
    Component: Upload,
  },
  {
    path: "/upload",
    Component: Upload,
  },
  {
    path: "/processing",
    Component: Processing,
  },
  {
    path: "/dashboard",
    Component: SchedulePage,
  },
  {
    path: "/schedule",
    Component: SchedulePage,
  },
  {
    path: "/surgeye",
    Component: SurgEyePage,
  },
]);
