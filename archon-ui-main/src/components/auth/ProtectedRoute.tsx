import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Loader2, Lock, AlertCircle } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireAuth?: boolean;
  requiredRole?: string;
  requiredPermission?: {
    resource: string;
    action: string;
  };
  fallback?: React.ReactNode;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  requireAuth = true,
  requiredRole,
  requiredPermission,
  fallback,
}) => {
  const { user, profile, loading, hasRole, hasPermission } = useAuth();
  const location = useLocation();

  // Show loading spinner while checking auth state
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center"
        >
          <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">Проверка авторизации...</p>
        </motion.div>
      </div>
    );
  }

  // Check if authentication is required
  if (requireAuth && !user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Check role-based access
  if (requiredRole && !hasRole(requiredRole)) {
    if (fallback) {
      return <>{fallback}</>;
    }

    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center max-w-md mx-auto"
        >
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8">
            <Lock className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              Доступ запрещен
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              У вас нет необходимых прав доступа к этой странице.
            </p>
            <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-3 mb-4">
              <div className="flex items-center text-red-700 dark:text-red-400 text-sm">
                <AlertCircle className="w-4 h-4 mr-2" />
                <span>Требуется роль: <strong>{requiredRole}</strong></span>
              </div>
              <div className="text-red-600 dark:text-red-400 text-sm mt-1">
                Ваша роль: <strong>{profile?.role || 'не определена'}</strong>
              </div>
            </div>
            <button
              onClick={() => window.history.back()}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
            >
              Назад
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  // Check permission-based access
  if (requiredPermission && !hasPermission(requiredPermission.resource, requiredPermission.action)) {
    if (fallback) {
      return <>{fallback}</>;
    }

    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center max-w-md mx-auto"
        >
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8">
            <Lock className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              Недостаточно прав
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              У вас нет прав для выполнения этого действия.
            </p>
            <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-3 mb-4">
              <div className="flex items-center text-red-700 dark:text-red-400 text-sm">
                <AlertCircle className="w-4 h-4 mr-2" />
                <span>
                  Требуется: <strong>{requiredPermission.action}</strong> на <strong>{requiredPermission.resource}</strong>
                </span>
              </div>
              <div className="text-red-600 dark:text-red-400 text-sm mt-1">
                Ваша роль: <strong>{profile?.role || 'не определена'}</strong>
              </div>
            </div>
            <button
              onClick={() => window.history.back()}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
            >
              Назад
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  // User has required access, render children
  return <>{children}</>;
};

export default ProtectedRoute;