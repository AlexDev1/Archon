import React from 'react';
import { motion } from 'framer-motion';
import { Lock, AlertCircle } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

interface RoleGuardProps {
  children: React.ReactNode;
  requiredRole: string | string[];
  fallback?: React.ReactNode;
  showError?: boolean;
}

const RoleGuard: React.FC<RoleGuardProps> = ({
  children,
  requiredRole,
  fallback = null,
  showError = false,
}) => {
  const { profile, hasRole } = useAuth();

  const hasRequiredRole = () => {
    if (Array.isArray(requiredRole)) {
      return requiredRole.some(role => hasRole(role));
    }
    return hasRole(requiredRole);
  };

  if (!hasRequiredRole()) {
    if (fallback) {
      return <>{fallback}</>;
    }

    if (showError) {
      return (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4"
        >
          <div className="flex items-center text-red-700 dark:text-red-400">
            <Lock className="w-5 h-5 mr-2" />
            <div>
              <p className="font-medium">Доступ ограничен</p>
              <p className="text-sm">
                Требуется роль: {Array.isArray(requiredRole) ? requiredRole.join(' или ') : requiredRole}
              </p>
              <p className="text-sm">Ваша роль: {profile?.role || 'не определена'}</p>
            </div>
          </div>
        </motion.div>
      );
    }

    return null;
  }

  return <>{children}</>;
};

export default RoleGuard;