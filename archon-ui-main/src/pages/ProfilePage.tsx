import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { User, Mail, Calendar, Shield, Edit2, Save, X, Loader2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import RoleGuard from '../components/auth/RoleGuard';

const ProfilePage: React.FC = () => {
  const { user, profile, updateProfile, refreshProfile } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  
  const [editData, setEditData] = useState({
    full_name: profile?.full_name || '',
    avatar_url: profile?.avatar_url || '',
  });

  const handleEdit = () => {
    setEditData({
      full_name: profile?.full_name || '',
      avatar_url: profile?.avatar_url || '',
    });
    setIsEditing(true);
    setError(null);
    setSuccess(false);
  };

  const handleCancel = () => {
    setEditData({
      full_name: profile?.full_name || '',
      avatar_url: profile?.avatar_url || '',
    });
    setIsEditing(false);
    setError(null);
    setSuccess(false);
  };

  const handleSave = async () => {
    setLoading(true);
    setError(null);

    try {
      const { profile: updatedProfile, error: updateError } = await updateProfile(editData);
      
      if (updateError) {
        setError('Не удалось обновить профиль');
      } else if (updatedProfile) {
        setSuccess(true);
        setIsEditing(false);
        setTimeout(() => setSuccess(false), 3000);
      }
    } catch (err) {
      setError('Произошла неожиданная ошибка');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEditData({
      ...editData,
      [e.target.name]: e.target.value,
    });
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'admin':
        return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400';
      case 'user':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400';
      case 'viewer':
        return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400';
      case 'guest':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400';
    }
  };

  const getRoleDescription = (role: string) => {
    switch (role) {
      case 'admin':
        return 'Полный доступ ко всем функциям системы';
      case 'user':
        return 'Создание и управление собственными проектами';
      case 'viewer':
        return 'Просмотр проектов и ресурсов';
      case 'guest':
        return 'Ограниченный доступ к публичным ресурсам';
      default:
        return 'Роль не определена';
    }
  };

  if (!profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        {/* Header */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden">
          <div className="bg-gradient-to-r from-blue-600 to-purple-600 px-6 py-8">
            <div className="flex items-center space-x-4">
              <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center">
                {profile.avatar_url ? (
                  <img
                    src={profile.avatar_url}
                    alt="Avatar"
                    className="w-full h-full rounded-full object-cover"
                  />
                ) : (
                  <User className="w-10 h-10 text-white" />
                )}
              </div>
              <div className="flex-1">
                <h1 className="text-2xl font-bold text-white">
                  {profile.full_name || 'Пользователь'}
                </h1>
                <p className="text-blue-100">{profile.email}</p>
                <div className="flex items-center space-x-2 mt-2">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getRoleBadgeColor(profile.role)}`}>
                    <Shield className="w-3 h-3 mr-1" />
                    {profile.role}
                  </span>
                  {!profile.is_active && (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300">
                      Неактивен
                    </span>
                  )}
                </div>
              </div>
              {!isEditing && (
                <button
                  onClick={handleEdit}
                  className="bg-white/20 hover:bg-white/30 text-white p-2 rounded-lg transition-colors"
                >
                  <Edit2 className="w-5 h-5" />
                </button>
              )}
            </div>
          </div>

          {/* Content */}
          <div className="p-6">
            {/* Success Message */}
            {success && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-4 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg text-green-700 dark:text-green-400 text-sm"
              >
                Профиль успешно обновлен!
              </motion.div>
            )}

            {/* Error Message */}
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400 text-sm"
              >
                {error}
              </motion.div>
            )}

            <div className="grid md:grid-cols-2 gap-6">
              {/* Profile Information */}
              <div className="space-y-4">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                  Информация профиля
                </h3>

                {/* Full Name */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Полное имя
                  </label>
                  {isEditing ? (
                    <input
                      type="text"
                      name="full_name"
                      value={editData.full_name}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Введите полное имя"
                    />
                  ) : (
                    <p className="text-gray-900 dark:text-white">
                      {profile.full_name || 'Не указано'}
                    </p>
                  )}
                </div>

                {/* Email */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Email
                  </label>
                  <div className="flex items-center text-gray-900 dark:text-white">
                    <Mail className="w-4 h-4 mr-2 text-gray-500" />
                    {profile.email}
                  </div>
                </div>

                {/* Avatar URL */}
                {isEditing && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      URL аватара
                    </label>
                    <input
                      type="url"
                      name="avatar_url"
                      value={editData.avatar_url}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="https://example.com/avatar.jpg"
                    />
                  </div>
                )}

                {/* Edit Actions */}
                {isEditing && (
                  <div className="flex space-x-3 pt-4">
                    <button
                      onClick={handleSave}
                      disabled={loading}
                      className="flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50"
                    >
                      {loading ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <Save className="w-4 h-4 mr-2" />
                      )}
                      Сохранить
                    </button>
                    <button
                      onClick={handleCancel}
                      className="flex items-center px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors"
                    >
                      <X className="w-4 h-4 mr-2" />
                      Отмена
                    </button>
                  </div>
                )}
              </div>

              {/* Account Details */}
              <div className="space-y-4">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                  Детали аккаунта
                </h3>

                {/* Role */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Роль
                  </label>
                  <div className="flex items-center space-x-2">
                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getRoleBadgeColor(profile.role)}`}>
                      <Shield className="w-4 h-4 mr-1" />
                      {profile.role}
                    </span>
                  </div>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    {getRoleDescription(profile.role)}
                  </p>
                </div>

                {/* Registration Date */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Дата регистрации
                  </label>
                  <div className="flex items-center text-gray-900 dark:text-white">
                    <Calendar className="w-4 h-4 mr-2 text-gray-500" />
                    {new Date(profile.created_at).toLocaleDateString('ru-RU')}
                  </div>
                </div>

                {/* Last Updated */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Последнее обновление
                  </label>
                  <div className="flex items-center text-gray-900 dark:text-white">
                    <Calendar className="w-4 h-4 mr-2 text-gray-500" />
                    {new Date(profile.updated_at).toLocaleDateString('ru-RU')}
                  </div>
                </div>

                {/* Account Status */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Статус аккаунта
                  </label>
                  <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                    profile.is_active 
                      ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
                      : 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
                  }`}>
                    {profile.is_active ? 'Активен' : 'Неактивен'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Admin Section */}
        <RoleGuard requiredRole="admin">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="mt-8 bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6"
          >
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
              Панель администратора
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              У вас есть права администратора. Вы можете управлять пользователями и системными настройками.
            </p>
            <div className="flex space-x-3">
              <button className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors">
                Управление пользователями
              </button>
              <button className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors">
                Системные настройки
              </button>
            </div>
          </motion.div>
        </RoleGuard>
      </motion.div>
    </div>
  );
};

export default ProfilePage;