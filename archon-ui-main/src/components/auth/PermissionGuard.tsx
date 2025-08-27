import React from 'react';
import { motion } from 'framer-motion';
import { Shield, AlertCircle } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

interface PermissionGuardProps {
  children: React.ReactNode;
  resource: string;
  action: string;
  fallback?: React.ReactNode;
  showError?: boolean;
}

const PermissionGuard: React.FC<PermissionGuardProps> = ({
  children,
  resource,
  action,
  fallback = null,
  showError = false,
}) => {
  const { profile, hasPermission } = useAuth();

  if (!hasPermission(resource, action)) {
    if (fallback) {
      return <>{fallback}</>;
    }

    if (showError) {
      return (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4"
        >
          <div className="flex items-center text-yellow-700 dark:text-yellow-400">
            <Shield className="w-5 h-5 mr-2" />
            <div>
              <p className="font-medium">Недостаточно прав</p>
              <p className="text-sm">
                Требуется разрешение: <code className="bg-yellow-100 dark:bg-yellow-800 px-1 rounded">{action}</code> на <code className="bg-yellow-100 dark:bg-yellow-800 px-1 rounded">{resource}</code>
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

export default PermissionGuard;