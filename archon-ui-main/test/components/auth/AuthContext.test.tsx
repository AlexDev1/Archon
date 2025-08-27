/**
 * Comprehensive tests for AuthContext
 * Tests authentication state management, Supabase integration, and permission checking
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, renderHook, act } from '@testing-library/react';
import { AuthProvider, useAuth } from '../../../src/contexts/AuthContext';
import { createClient } from '@supabase/supabase-js';

// Mock Supabase client
vi.mock('@supabase/supabase-js');

const mockSupabaseClient = {
  auth: {
    getSession: vi.fn(),
    getUser: vi.fn(),
    onAuthStateChange: vi.fn(),
    signInWithPassword: vi.fn(),
    signUp: vi.fn(),
    signOut: vi.fn(),
  },
  from: vi.fn(() => ({
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        single: vi.fn(),
      })),
    })),
    update: vi.fn(() => ({
      eq: vi.fn(() => ({
        select: vi.fn(),
      })),
    })),
  })),
};

const mockCreateClient = vi.mocked(createClient);
mockCreateClient.mockReturnValue(mockSupabaseClient as any);

// Test wrapper component
const TestWrapper = ({ children }: { children: React.ReactNode }) => (
  <AuthProvider>{children}</AuthProvider>
);

describe('AuthContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock environment variables
    vi.stubEnv('VITE_SUPABASE_URL', 'https://test.supabase.co');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'test-anon-key');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe('Initialization', () => {
    it('should initialize with loading state', () => {
      const { result } = renderHook(() => useAuth(), { wrapper: TestWrapper });
      
      expect(result.current.loading).toBe(true);
      expect(result.current.user).toBeNull();
      expect(result.current.profile).toBeNull();
    });

    it('should initialize Supabase client with correct config', () => {
      renderHook(() => useAuth(), { wrapper: TestWrapper });
      
      expect(mockCreateClient).toHaveBeenCalledWith(
        'https://test.supabase.co',
        'test-anon-key'
      );
    });
  });

  describe('Authentication State', () => {
    it('should handle successful authentication', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        aud: 'authenticated',
        role: 'authenticated',
        created_at: '2024-01-01T00:00:00Z'
      };

      const mockProfile = {
        id: 'user-123',
        email: 'test@example.com',
        full_name: 'Test User',
        role: 'user',
        is_active: true,
        metadata: {},
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z'
      };

      mockSupabaseClient.auth.getSession.mockResolvedValue({
        data: { session: { user: mockUser, access_token: 'token' } },
        error: null
      });

      mockSupabaseClient.from().select().eq().single.mockResolvedValue({
        data: mockProfile,
        error: null
      });

      const { result } = renderHook(() => useAuth(), { wrapper: TestWrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.user).toEqual(mockUser);
      expect(result.current.profile).toEqual(mockProfile);
    });

    it('should handle authentication error', async () => {
      const mockError = new Error('Authentication failed');
      
      mockSupabaseClient.auth.getSession.mockResolvedValue({
        data: { session: null },
        error: mockError
      });

      const { result } = renderHook(() => useAuth(), { wrapper: TestWrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.user).toBeNull();
      expect(result.current.profile).toBeNull();
    });
  });

  describe('Login Function', () => {
    it('should handle successful login', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        aud: 'authenticated',
        role: 'authenticated'
      };

      mockSupabaseClient.auth.signInWithPassword.mockResolvedValue({
        data: { user: mockUser, session: { access_token: 'token' } },
        error: null
      });

      const { result } = renderHook(() => useAuth(), { wrapper: TestWrapper });

      let loginResult;
      await act(async () => {
        loginResult = await result.current.login('test@example.com', 'password');
      });

      expect(mockSupabaseClient.auth.signInWithPassword).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'password'
      });
      expect(loginResult.user).toEqual(mockUser);
      expect(loginResult.error).toBeNull();
    });

    it('should handle login error', async () => {
      const mockError = { message: 'Invalid credentials' };
      
      mockSupabaseClient.auth.signInWithPassword.mockResolvedValue({
        data: { user: null, session: null },
        error: mockError
      });

      const { result } = renderHook(() => useAuth(), { wrapper: TestWrapper });

      let loginResult;
      await act(async () => {
        loginResult = await result.current.login('test@example.com', 'wrong-password');
      });

      expect(loginResult.user).toBeNull();
      expect(loginResult.error).toEqual(mockError);
    });
  });

  describe('Registration Function', () => {
    it('should handle successful registration', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'newuser@example.com',
        aud: 'authenticated',
        role: 'authenticated'
      };

      mockSupabaseClient.auth.signUp.mockResolvedValue({
        data: { user: mockUser, session: null },
        error: null
      });

      const { result } = renderHook(() => useAuth(), { wrapper: TestWrapper });

      let registerResult;
      await act(async () => {
        registerResult = await result.current.register('newuser@example.com', 'password', 'New User');
      });

      expect(mockSupabaseClient.auth.signUp).toHaveBeenCalledWith({
        email: 'newuser@example.com',
        password: 'password',
        options: {
          data: {
            full_name: 'New User'
          }
        }
      });
      expect(registerResult.user).toEqual(mockUser);
      expect(registerResult.error).toBeNull();
    });
  });

  describe('Logout Function', () => {
    it('should handle successful logout', async () => {
      mockSupabaseClient.auth.signOut.mockResolvedValue({
        error: null
      });

      const { result } = renderHook(() => useAuth(), { wrapper: TestWrapper });

      await act(async () => {
        await result.current.logout();
      });

      expect(mockSupabaseClient.auth.signOut).toHaveBeenCalled();
    });
  });

  describe('Profile Update', () => {
    it('should handle successful profile update', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        aud: 'authenticated',
        role: 'authenticated'
      };

      const updatedProfile = {
        id: 'user-123',
        email: 'test@example.com',
        full_name: 'Updated Name',
        role: 'user',
        is_active: true,
        metadata: {},
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T01:00:00Z'
      };

      mockSupabaseClient.from().update().eq().select.mockResolvedValue({
        data: [updatedProfile],
        error: null
      });

      const { result } = renderHook(() => useAuth(), { wrapper: TestWrapper });
      
      // Set initial user state
      act(() => {
        result.current.user = mockUser;
      });

      let updateResult;
      await act(async () => {
        updateResult = await result.current.updateProfile({ full_name: 'Updated Name' });
      });

      expect(updateResult.profile).toEqual(updatedProfile);
      expect(updateResult.error).toBeNull();
    });

    it('should handle profile update error when user not logged in', async () => {
      const { result } = renderHook(() => useAuth(), { wrapper: TestWrapper });

      let updateResult;
      await act(async () => {
        updateResult = await result.current.updateProfile({ full_name: 'Updated Name' });
      });

      expect(updateResult.profile).toBeNull();
      expect(updateResult.error).toEqual({ message: 'User not authenticated' });
    });
  });

  describe('Permission Checking', () => {
    it('should check role permissions correctly', () => {
      const { result } = renderHook(() => useAuth(), { wrapper: TestWrapper });
      
      // Mock profile with specific role
      act(() => {
        result.current.profile = {
          id: 'user-123',
          email: 'admin@example.com',
          full_name: 'Admin User',
          role: 'admin',
          is_active: true,
          metadata: {},
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z'
        };
      });

      expect(result.current.hasRole('admin')).toBe(true);
      expect(result.current.hasRole('user')).toBe(false);
      expect(result.current.hasRole('viewer')).toBe(false);
    });

    it('should check permissions correctly', () => {
      const { result } = renderHook(() => useAuth(), { wrapper: TestWrapper });
      
      // Mock admin profile
      act(() => {
        result.current.profile = {
          id: 'admin-123',
          email: 'admin@example.com',
          full_name: 'Admin User',
          role: 'admin',
          is_active: true,
          metadata: {},
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z'
        };
      });

      // Admin should have all permissions
      expect(result.current.hasPermission('users', 'read')).toBe(true);
      expect(result.current.hasPermission('users', 'write')).toBe(true);
      expect(result.current.hasPermission('projects', 'delete')).toBe(true);

      // Mock regular user profile
      act(() => {
        result.current.profile = {
          id: 'user-123',
          email: 'user@example.com',
          full_name: 'Regular User',
          role: 'user',
          is_active: true,
          metadata: {},
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z'
        };
      });

      // Regular user should have limited permissions
      expect(result.current.hasPermission('users', 'read')).toBe(false);
      expect(result.current.hasPermission('projects', 'read')).toBe(true);
      expect(result.current.hasPermission('projects', 'write')).toBe(true);
    });

    it('should return false for permissions when no profile', () => {
      const { result } = renderHook(() => useAuth(), { wrapper: TestWrapper });

      expect(result.current.hasRole('admin')).toBe(false);
      expect(result.current.hasPermission('users', 'read')).toBe(false);
    });
  });

  describe('Auth State Changes', () => {
    it('should handle auth state change callback', () => {
      let authCallback: any;
      
      mockSupabaseClient.auth.onAuthStateChange.mockImplementation((callback) => {
        authCallback = callback;
        return { data: { subscription: { unsubscribe: vi.fn() } } };
      });

      renderHook(() => useAuth(), { wrapper: TestWrapper });

      expect(mockSupabaseClient.auth.onAuthStateChange).toHaveBeenCalled();
      expect(authCallback).toBeTypeOf('function');
    });
  });

  describe('Error Handling', () => {
    it('should handle network errors gracefully', async () => {
      mockSupabaseClient.auth.getSession.mockRejectedValue(new Error('Network error'));

      const { result } = renderHook(() => useAuth(), { wrapper: TestWrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.user).toBeNull();
      expect(result.current.profile).toBeNull();
    });

    it('should handle profile loading errors', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        aud: 'authenticated',
        role: 'authenticated'
      };

      mockSupabaseClient.auth.getSession.mockResolvedValue({
        data: { session: { user: mockUser, access_token: 'token' } },
        error: null
      });

      mockSupabaseClient.from().select().eq().single.mockResolvedValue({
        data: null,
        error: { message: 'Profile not found' }
      });

      const { result } = renderHook(() => useAuth(), { wrapper: TestWrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.user).toEqual(mockUser);
      expect(result.current.profile).toBeNull();
    });
  });
});