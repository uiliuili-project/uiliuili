import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AdminLayout } from './pages/AdminLayout';
import { AnnouncementsPage } from './pages/AnnouncementsPage';
import { AuditPage } from './pages/AuditPage';
import { CategoriesPage } from './pages/CategoriesPage';
import { CommentsPage } from './pages/CommentsPage';
import { DanmakuPage } from './pages/DanmakuPage';
import { DashboardPage } from './pages/DashboardPage';
import { InstallWizard } from './pages/InstallWizard';
import { LoginPage } from './pages/LoginPage';
import { ReportsPage } from './pages/ReportsPage';
import { SettingsPage } from './pages/SettingsPage';
import { SystemPage } from './pages/SystemPage';
import { UsersPage } from './pages/UsersPage';
import { VideosPage } from './pages/VideosPage';

const basename = import.meta.env.BASE_URL.replace(/\/$/, '') || '/';

export function App() {
  return (
    <BrowserRouter basename={basename}>
      <Routes>
        <Route path="/install" element={<InstallWizard />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/" element={<AdminLayout />}>
          <Route index element={<DashboardPage />} />
          <Route path="users" element={<UsersPage />} />
          <Route path="videos" element={<VideosPage />} />
          <Route path="danmaku" element={<DanmakuPage />} />
          <Route path="comments" element={<CommentsPage />} />
          <Route path="reports" element={<ReportsPage />} />
          <Route path="categories" element={<CategoriesPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="system" element={<SystemPage />} />
          <Route path="audit" element={<AuditPage />} />
          <Route path="announcements" element={<AnnouncementsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
