import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter, redirect, RouterProvider } from 'react-router';
import App from './App.tsx';
import './index.css';
import './nurseflow/styles/theme.css';

import Upload from "./nurseflow/pages/Upload";
import Processing from "./nurseflow/pages/Processing";
import SchedulePage from "./nurseflow/pages/SchedulePage";
import Dashboard from "./nurseflow/pages/Dashboard";
import SurgEyePage from "./nurseflow/pages/SurgEye";
import PatientsPage from "./nurseflow/pages/Patients";
import NurseflowLayout from "./nurseflow/components/NurseflowLayout";

const router = createBrowserRouter([
  { path: "/", Component: App },
  { path: "/patients", Component: PatientsPage },
  {
    path: "/nurseflow",
    Component: NurseflowLayout,
    children: [
      { index: true, Component: Upload },
      { path: "upload", Component: Upload },
      { path: "processing", Component: Processing },
      { path: "dashboard", Component: Dashboard },
      { path: "schedule", Component: SchedulePage },
      { path: "patients", Component: PatientsPage },
    ],
  },
  {
    Component: NurseflowLayout,
    children: [
      { path: "/upload", Component: Upload },
      { path: "/schedule", Component: SchedulePage },
    ],
  },
  { path: "/processing", loader: () => redirect("/nurseflow/processing") },
  { path: "/dashboard", loader: () => redirect("/nurseflow/dashboard") },
  { path: "/nurseflow/surgeye", Component: SurgEyePage },
  { path: "/surgeye", Component: SurgEyePage },
]);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
