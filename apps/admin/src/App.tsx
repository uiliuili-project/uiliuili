import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AdminLayout } from './pages/AdminLayout';
import { DashboardPage } from './pages/DashboardPage';
import { InstallWizard } from './pages/InstallWizard';
import { LoginPage } from './pages/LoginPage';
import { PlaceholderPage } from './pages/PlaceholderPage';

const basename = import.meta.env.BASE_URL.replace(/\/$/, '') || '/';

export function App() {
  return (
    <BrowserRouter basename={basename}>
      <Routes>
        <Route path="/install" element={<InstallWizard />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/" element={<AdminLayout />}>
          <Route index element={<DashboardPage />} />
          <Route path="users" element={<PlaceholderPage title="用户管理" />} />
          <Route path="videos" element={<PlaceholderPage title="视频管理" />} />
          <Route path="danmaku" element={<PlaceholderPage title="弹幕管理" />} />
          <Route path="comments" element={<PlaceholderPage title="评论管理" />} />
          <Route path="reports" element={<PlaceholderPage title="举报处理" />} />
          <Route path="categories" element={<PlaceholderPage title="分区与标签" />} />
          <Route path="settings" element={<PlaceholderPage title="站点设置" />} />
          <Route path="system" element={<PlaceholderPage title="系统状态" />} />
          <Route path="audit" element={<PlaceholderPage title="审计日志" />} />
          <Route path="announcements" element={<PlaceholderPage title="公告管理" />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
