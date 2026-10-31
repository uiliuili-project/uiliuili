import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { CaptchaChallenge } from './CaptchaChallenge';
import { PermissionGate } from './PermissionGate';
import { AdminLayout } from './pages/AdminLayout';
import { AnnouncementsPage } from './pages/AnnouncementsPage';
import { AppealsPage } from './pages/AppealsPage';
import { ArticlesPage } from './pages/ArticlesPage';
import { AuditPage } from './pages/AuditPage';
import { CategoriesPage } from './pages/CategoriesPage';
import { CommentsPage } from './pages/CommentsPage';
import { DanmakuPage } from './pages/DanmakuPage';
import { DashboardPage } from './pages/DashboardPage';
import { InstallGate } from './pages/InstallGate';
import { LoginPage } from './pages/LoginPage';
import { ReportsPage } from './pages/ReportsPage';
import { ReviewCommentsPage } from './pages/ReviewCommentsPage';
import { ReviewOverviewPage } from './pages/ReviewOverviewPage';
import { ReviewVideosPage } from './pages/ReviewVideosPage';
import { SettingsPage } from './pages/SettingsPage';
import { SystemPage } from './pages/SystemPage';
import { UsersPage } from './pages/UsersPage';
import { VideoNodesPage } from './pages/VideoNodesPage';
import { VideosPage } from './pages/VideosPage';

const basename = import.meta.env.BASE_URL.replace(/\/$/, '') || '/';

export function App() {
  return (
    <BrowserRouter basename={basename}>
      <Routes>
        <Route path="/install" element={<InstallGate />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/" element={<AdminLayout />}>
          <Route
            index
            element={
              <PermissionGate permission="audit:read">
                <DashboardPage />
              </PermissionGate>
            }
          />
          <Route
            path="review"
            element={
              <PermissionGate anyOf={['video:review', 'comment:manage', 'report:manage']}>
                <ReviewOverviewPage />
              </PermissionGate>
            }
          />
          <Route
            path="review/videos"
            element={
              <PermissionGate permission="video:review">
                <ReviewVideosPage />
              </PermissionGate>
            }
          />
          <Route
            path="review/comments"
            element={
              <PermissionGate permission="comment:manage">
                <ReviewCommentsPage />
              </PermissionGate>
            }
          />
          <Route
            path="appeals"
            element={
              <PermissionGate permission="video:manage_any">
                <AppealsPage />
              </PermissionGate>
            }
          />
          <Route
            path="articles"
            element={
              <PermissionGate permission="video:review">
                <ArticlesPage />
              </PermissionGate>
            }
          />
          <Route
            path="users"
            element={
              <PermissionGate permission="user:view">
                <UsersPage />
              </PermissionGate>
            }
          />
          <Route
            path="videos"
            element={
              <PermissionGate permission="video:feature">
                <VideosPage />
              </PermissionGate>
            }
          />
          <Route
            path="danmaku"
            element={
              <PermissionGate permission="danmaku:manage">
                <DanmakuPage />
              </PermissionGate>
            }
          />
          <Route
            path="comments"
            element={
              <PermissionGate permission="video:feature">
                <CommentsPage />
              </PermissionGate>
            }
          />
          <Route
            path="reports"
            element={
              <PermissionGate permission="report:manage">
                <ReportsPage />
              </PermissionGate>
            }
          />
          <Route
            path="categories"
            element={
              <PermissionGate permission="category:manage">
                <CategoriesPage />
              </PermissionGate>
            }
          />
          <Route
            path="settings"
            element={
              <PermissionGate
                anyOf={[
                  'settings:site',
                  'settings:content',
                  'settings:integration',
                  'settings:security',
                ]}
              >
                <SettingsPage />
              </PermissionGate>
            }
          />
          <Route
            path="video-nodes"
            element={
              <PermissionGate permission="video_node:manage">
                <VideoNodesPage />
              </PermissionGate>
            }
          />
          <Route
            path="system"
            element={
              <PermissionGate permission="system:view">
                <SystemPage />
              </PermissionGate>
            }
          />
          <Route
            path="audit"
            element={
              <PermissionGate permission="audit:read">
                <AuditPage />
              </PermissionGate>
            }
          />
          <Route
            path="announcements"
            element={
              <PermissionGate permission="announcement:manage">
                <AnnouncementsPage />
              </PermissionGate>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
      <CaptchaChallenge />
    </BrowserRouter>
  );
}
