import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { KnowledgeBasePage } from './pages/KnowledgeBasePage';
import { SettingsPage } from './pages/SettingsPage';
import { MCPPage } from './pages/MCPPage';
import { OnboardingPage } from './pages/OnboardingPage';
import { MainLayout } from './components/layouts/MainLayout';
import { ThemeProvider } from './contexts/ThemeContext';
import { ToastProvider } from './contexts/ToastContext';
import { SettingsProvider, useSettings } from './contexts/SettingsContext';
import { AuthProvider } from './contexts/AuthContext';
import { ProjectPage } from './pages/ProjectPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import ProfilePage from './pages/ProfilePage';
import ProtectedRoute from './components/auth/ProtectedRoute';
import { DisconnectScreenOverlay } from './components/DisconnectScreenOverlay';
import { ErrorBoundaryWithBugReport } from './components/bug-report/ErrorBoundaryWithBugReport';
import { serverHealthService } from './services/serverHealthService';

const AppRoutes = () => {
  const { projectsEnabled } = useSettings();
  
  return (
    <Routes>
      {/* Public routes */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      
      {/* Protected routes */}
      <Route path="/" element={
        <ProtectedRoute>
          <KnowledgeBasePage />
        </ProtectedRoute>
      } />
      <Route path="/onboarding" element={
        <ProtectedRoute>
          <OnboardingPage />
        </ProtectedRoute>
      } />
      <Route path="/profile" element={
        <ProtectedRoute>
          <ProfilePage />
        </ProtectedRoute>
      } />
      <Route path="/settings" element={
        <ProtectedRoute requiredRole="admin">
          <SettingsPage />
        </ProtectedRoute>
      } />
      <Route path="/mcp" element={
        <ProtectedRoute>
          <MCPPage />
        </ProtectedRoute>
      } />
      {projectsEnabled ? (
        <Route path="/projects" element={
          <ProtectedRoute>
            <ProjectPage />
          </ProtectedRoute>
        } />
      ) : (
        <Route path="/projects" element={<Navigate to="/" replace />} />
      )}
    </Routes>
  );
};

const AppContent = () => {
  const [disconnectScreenActive, setDisconnectScreenActive] = useState(false);
  const [disconnectScreenDismissed, setDisconnectScreenDismissed] = useState(false);
  const [disconnectScreenSettings, setDisconnectScreenSettings] = useState({
    enabled: true,
    delay: 10000
  });

  useEffect(() => {
    // Load initial settings
    const settings = serverHealthService.getSettings();
    setDisconnectScreenSettings(settings);

    // Stop any existing monitoring before starting new one to prevent multiple intervals
    serverHealthService.stopMonitoring();

    // Start health monitoring
    serverHealthService.startMonitoring({
      onDisconnected: () => {
        if (!disconnectScreenDismissed) {
          setDisconnectScreenActive(true);
        }
      },
      onReconnected: () => {
        setDisconnectScreenActive(false);
        setDisconnectScreenDismissed(false);
        // Refresh the page to ensure all data is fresh
        window.location.reload();
      }
    });

    return () => {
      serverHealthService.stopMonitoring();
    };
  }, [disconnectScreenDismissed]);

  const handleDismissDisconnectScreen = () => {
    setDisconnectScreenActive(false);
    setDisconnectScreenDismissed(true);
  };

  return (
    <>
      <Router>
        <ErrorBoundaryWithBugReport>
          <MainLayout>
            <AppRoutes />
          </MainLayout>
        </ErrorBoundaryWithBugReport>
      </Router>
      <DisconnectScreenOverlay
        isActive={disconnectScreenActive && disconnectScreenSettings.enabled}
        onDismiss={handleDismissDisconnectScreen}
      />
    </>
  );
};

export function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <AuthProvider>
          <SettingsProvider>
            <AppContent />
          </SettingsProvider>
        </AuthProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}