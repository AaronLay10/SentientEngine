import { Routes, Route, Navigate } from 'react-router-dom';
import { AppShell } from '@/components/layout/AppShell';
import { ControllersPage } from '@/pages/ControllersPage';
import { PowerPage } from '@/pages/PowerPage';
import { MonitorPage } from '@/pages/MonitorPage';
import { SceneEditorPage } from '@/pages/SceneEditorPage';
import { useWebSocket, useHealthPolling, useAlertAudio } from '@/hooks';

export default function App() {
  // Initialize WebSocket connection and event routing
  useWebSocket();

  // Poll health endpoint
  useHealthPolling();

  // Handle alert audio
  useAlertAudio();

  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<Navigate to="/monitor" replace />} />
        <Route path="/monitor" element={<MonitorPage />} />
        <Route path="/scene-editor" element={<SceneEditorPage />} />
        <Route path="/controllers" element={<ControllersPage />} />
        <Route path="/power" element={<PowerPage />} />
      </Route>
    </Routes>
  );
}
