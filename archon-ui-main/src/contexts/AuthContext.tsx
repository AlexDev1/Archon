import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { createClient, SupabaseClient, User, Session } from '@supabase/supabase-js';

// Environment variables for Supabase
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

// Check if we have valid configuration
if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('⚠️ Supabase configuration missing! Please set SUPABASE_URL and VITE_SUPABASE_ANON_KEY in root .env file');
}

// User profile interface matching backend
interface UserProfile {
  id: string;
  email: string;
  full_name?: string;
  avatar_url?: string;
  role: 'admin' | 'user' | 'viewer' | 'guest';
  is_active: boolean;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}

// Auth context interface
interface AuthContextType {
  // Supabase client
  supabase: SupabaseClient;
  
  // Auth state
  user: User | null;
  session: Session | null;
  profile: UserProfile | null;
  loading: boolean;
  
  // Auth methods
  signUp: (email: string, password: string, fullName?: string) => Promise<{ user: User | null; error: any }>;
  signIn: (email: string, password: string) => Promise<{ user: User | null; error: any }>;
  signOut: () => Promise<{ error: any }>;
  
  // Profile methods
  updateProfile: (updates: Partial<UserProfile>) => Promise<{ profile: UserProfile | null; error: any }>;
  refreshProfile: () => Promise<void>;
  
  // Permission helpers
  hasRole: (role: string) => boolean;
  isAdmin: () => boolean;
  hasPermission: (resource: string, action: string) => boolean;
}

// Create context
const AuthContext = createContext<AuthContextType | null>(null);

// Provider component
interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [supabase] = useState(() => {
    // Provide fallback values for development
    const url = supabaseUrl || 'https://placeholder.supabase.co';
    const key = supabaseAnonKey || 'placeholder-anon-key';
    
    return createClient(url, key);
  });
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  // Initialize auth state
  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        loadUserProfile(session.user.id);
      }
      setLoading(false);
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user) {
        await loadUserProfile(session.user.id);
      } else {
        setProfile(null);
      }
      
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [supabase]);

  // Load user profile from backend
  const loadUserProfile = async (userId: string) => {
    try {
      const response = await fetch('/api/auth/profile', {
        headers: {
          'Authorization': `Bearer ${session?.access_token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const profileData = await response.json();
        setProfile(profileData);
      } else {
        console.error('Failed to load user profile:', response.statusText);
      }
    } catch (error) {
      console.error('Error loading user profile:', error);
    }
  };

  // Sign up method
  const signUp = async (email: string, password: string, fullName?: string) => {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName || '',
          },
        },
      });

      if (error) {
        console.error('Sign up error:', error);
        return { user: null, error };
      }

      return { user: data.user, error: null };
    } catch (error) {
      console.error('Sign up error:', error);
      return { user: null, error };
    }
  };

  // Sign in method
  const signIn = async (email: string, password: string) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        console.error('Sign in error:', error);
        return { user: null, error };
      }

      return { user: data.user, error: null };
    } catch (error) {
      console.error('Sign in error:', error);
      return { user: null, error };
    }
  };

  // Sign out method
  const signOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      
      if (error) {
        console.error('Sign out error:', error);
      }

      // Clear local state
      setUser(null);
      setSession(null);
      setProfile(null);

      return { error };
    } catch (error) {
      console.error('Sign out error:', error);
      return { error };
    }
  };

  // Update profile method
  const updateProfile = async (updates: Partial<UserProfile>) => {
    try {
      const response = await fetch('/api/auth/profile', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${session?.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates),
      });

      if (response.ok) {
        const updatedProfile = await response.json();
        setProfile(updatedProfile);
        return { profile: updatedProfile, error: null };
      } else {
        const error = await response.text();
        console.error('Update profile error:', error);
        return { profile: null, error };
      }
    } catch (error) {
      console.error('Update profile error:', error);
      return { profile: null, error };
    }
  };

  // Refresh profile method
  const refreshProfile = async () => {
    if (user) {
      await loadUserProfile(user.id);
    }
  };

  // Permission helpers
  const hasRole = (role: string): boolean => {
    return profile?.role === role;
  };

  const isAdmin = (): boolean => {
    return profile?.role === 'admin';
  };

  const hasPermission = (resource: string, action: string): boolean => {
    if (!profile) return false;

    const { role } = profile;

    // Admin has all permissions
    if (role === 'admin') return true;

    // Role-based permissions
    switch (role) {
      case 'user':
        // Users can create/edit their own resources
        return ['create', 'read', 'update'].includes(action);
        
      case 'viewer':
        // Viewers can only read
        return action === 'read';
        
      case 'guest':
        // Guests have very limited access
        return action === 'read' && ['knowledge', 'projects'].includes(resource);
        
      default:
        return false;
    }
  };

  const value: AuthContextType = {
    supabase,
    user,
    session,
    profile,
    loading,
    signUp,
    signIn,
    signOut,
    updateProfile,
    refreshProfile,
    hasRole,
    isAdmin,
    hasPermission,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

// Hook to use auth context
export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

// Higher-order component for protected routes
export const withAuth = <P extends object>(
  Component: React.ComponentType<P>
): React.FC<P> => {
  return (props: P) => {
    const { user, loading } = useAuth();

    if (loading) {
      return (
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      );
    }

    if (!user) {
      // Redirect to login page
      window.location.href = '/login';
      return null;
    }

    return <Component {...props} />;
  };
};

// Hook for role-based access
export const useRoleGuard = (requiredRole: string) => {
  const { profile, hasRole } = useAuth();
  return {
    hasAccess: hasRole(requiredRole),
    currentRole: profile?.role,
  };
};

// Hook for permission-based access
export const usePermissionGuard = (resource: string, action: string) => {
  const { hasPermission } = useAuth();
  return {
    hasAccess: hasPermission(resource, action),
  };
};