import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter, RouterProvider } from 'react-router';
import App from './App.tsx';
import './index.css';
import './nurseflow/styles/theme.css'; // NurseFlow theme

import Upload from "./nurseflow/pages/Upload";
import Processing from "./nurseflow/pages/Processing";
import SchedulePage from "./nurseflow/pages/SchedulePage";
import Dashboard from "./nurseflow/pages/Dashboard";
import SurgEyePage from "./nurseflow/pages/SurgEye";

const router = createBrowserRouter([
  { path: "/", Component: App },
  { path: "/nurseflow", Component: Upload },
  { path: "/nurseflow/upload", Component: Upload },
  { path: "/nurseflow/processing", Component: Processing },
  { path: "/nurseflow/dashboard", Component: Dashboard },
  { path: "/nurseflow/schedule", Component: SchedulePage },
  { path: "/nurseflow/surgeye", Component: SurgEyePage },
  // Map absolute paths used inside nurseflow to /nurseflow prefix to avoid breaking their links, 
  // or better, just provide root aliases for them if they hardcode "/dashboard"
  { path: "/upload", Component: Upload },
  { path: "/processing", Component: Processing },
  { path: "/dashboard", Component: Dashboard },
  { path: "/schedule", Component: SchedulePage },
  { path: "/surgeye", Component: SurgEyePage },
]);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
