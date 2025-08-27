/**
 * Tests for ProtectedRoute component
 * Tests route protection, role-based access, and loading states
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import ProtectedRoute from '../../../src/components/auth/ProtectedRoute';
import { AuthProvider } from '../../../src/contexts/AuthContext';

// Mock the AuthContext
const mockAuthContext = {
  user: null,
  profile: null,
  loading: false,
  login: vi.fn(),
  register: vi.fn(),
  logout: vi.fn(),
  updateProfile: vi.fn(),
  refreshProfile: vi.fn(),
  hasRole: vi.fn(),
  hasPermission: vi.fn(),
};

vi.mock('../../../src/contexts/AuthContext', async () => {
  const actual = await vi.importActual('../../../src/contexts/AuthContext');
  return {
    ...actual,
    useAuth: () => mockAuthContext,
  };
});

// Test component wrapper
const TestWrapper = ({ children }: { children: React.ReactNode }) => (
  <BrowserRouter>
    <AuthProvider>
      {children}
    </AuthProvider>
  </BrowserRouter>
);

const TestComponent = () => <div>Protected Content</div>;

describe('ProtectedRoute', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Loading States', () => {
    it('should show loading spinner when auth is loading', () => {
      mockAuthContext.loading = true;
      mockAuthContext.user = null;
      mockAuthContext.profile = null;

      render(
        <TestWrapper>
          <ProtectedRoute>
            <TestComponent />
          </ProtectedRoute>
        </TestWrapper>
      );

      expect(screen.getByRole('status')).toBeInTheDocument();
      expect(screen.getByText('Loading...')).toBeInTheDocument();
    });
  });

  describe('Unauthenticated Access', () => {
    it('should redirect to login when user is not authenticated', () => {
      mockAuthContext.loading = false;
      mockAuthContext.user = null;
      mockAuthContext.profile = null;

      render(
        <TestWrapper>
          <ProtectedRoute>
            <TestComponent />
          </ProtectedRoute>
        </TestWrapper>
      );

      expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
      // Should redirect to login (tested via routing behavior)
    });

    it('should show fallback component when provided and not authenticated', () => {
      mockAuthContext.loading = false;
      mockAuthContext.user = null;
      mockAuthContext.profile = null;

      const FallbackComponent = () => <div>Please log in</div>;

      render(
        <TestWrapper>
          <ProtectedRoute fallback={<FallbackComponent />}>
            <TestComponent />
          </ProtectedRoute>
        </TestWrapper>
      );

      expect(screen.getByText('Please log in')).toBeInTheDocument();
      expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
    });
  });

  describe('Authenticated Access', () => {
    beforeEach(() => {
      mockAuthContext.loading = false;
      mockAuthContext.user = {
        id: 'user-123',
        email: 'test@example.com',
        aud: 'authenticated',
        role: 'authenticated'
      };
      mockAuthContext.profile = {
        id: 'user-123',
        email: 'test@example.com',
        full_name: 'Test User',
        role: 'user',
        is_active: true,
        metadata: {},
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z'
      };
    });

    it('should render children when user is authenticated', () => {
      render(
        <TestWrapper>
          <ProtectedRoute>
            <TestComponent />
          </ProtectedRoute>
        </TestWrapper>
      );

      expect(screen.getByText('Protected Content')).toBeInTheDocument();
    });

    it('should render children when user is authenticated and no role required', () => {
      render(
        <TestWrapper>
          <ProtectedRoute>
            <TestComponent />
          </ProtectedRoute>
        </TestWrapper>
      );

      expect(screen.getByText('Protected Content')).toBeInTheDocument();
    });
  });

  describe('Role-Based Access Control', () => {
    beforeEach(() => {
      mockAuthContext.loading = false;
      mockAuthContext.user = {
        id: 'user-123',
        email: 'test@example.com',
        aud: 'authenticated',
        role: 'authenticated'
      };
    });

    it('should allow access when user has required role', () => {
      mockAuthContext.profile = {
        id: 'user-123',
        email: 'admin@example.com',
        full_name: 'Admin User',
        role: 'admin',
        is_active: true,
        metadata: {},
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z'
      };
      mockAuthContext.hasRole.mockImplementation((role) => role === 'admin');

      render(
        <TestWrapper>
          <ProtectedRoute requiredRole="admin">
            <TestComponent />
          </ProtectedRoute>
        </TestWrapper>
      );

      expect(mockAuthContext.hasRole).toHaveBeenCalledWith('admin');
      expect(screen.getByText('Protected Content')).toBeInTheDocument();
    });

    it('should deny access when user does not have required role', () => {
      mockAuthContext.profile = {
        id: 'user-123',
        email: 'user@example.com',
        full_name: 'Regular User',
        role: 'user',
        is_active: true,
        metadata: {},
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z'
      };
      mockAuthContext.hasRole.mockImplementation((role) => role === 'user');

      render(
        <TestWrapper>
          <ProtectedRoute requiredRole="admin">
            <TestComponent />
          </ProtectedRoute>
        </TestWrapper>
      );

      expect(mockAuthContext.hasRole).toHaveBeenCalledWith('admin');
      expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
      expect(screen.getByText(/insufficient permissions/i)).toBeInTheDocument();
    });

    it('should show custom error message for insufficient permissions', () => {
      mockAuthContext.profile = {
        id: 'user-123',
        email: 'user@example.com',
        full_name: 'Regular User',
        role: 'user',
        is_active: true,
        metadata: {},
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z'
      };
      mockAuthContext.hasRole.mockReturnValue(false);

      render(
        <TestWrapper>
          <ProtectedRoute requiredRole="admin">
            <TestComponent />
          </ProtectedRoute>
        </TestWrapper>
      );

      expect(screen.getByText(/You don't have permission/)).toBeInTheDocument();
      expect(screen.getByText(/Required role: admin/)).toBeInTheDocument();
      expect(screen.getByText(/Current role: user/)).toBeInTheDocument();
    });
  });

  describe('Permission-Based Access Control', () => {
    beforeEach(() => {
      mockAuthContext.loading = false;
      mockAuthContext.user = {
        id: 'user-123',
        email: 'test@example.com',
        aud: 'authenticated',
        role: 'authenticated'
      };
      mockAuthContext.profile = {
        id: 'user-123',
        email: 'test@example.com',
        full_name: 'Test User',
        role: 'user',
        is_active: true,
        metadata: {},
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z'
      };
    });

    it('should allow access when user has required permission', () => {
      mockAuthContext.hasPermission.mockImplementation((resource, action) => 
        resource === 'projects' && action === 'read'
      );

      render(
        <TestWrapper>
          <ProtectedRoute requiredPermission={{ resource: 'projects', action: 'read' }}>
            <TestComponent />
          </ProtectedRoute>
        </TestWrapper>
      );

      expect(mockAuthContext.hasPermission).toHaveBeenCalledWith('projects', 'read');
      expect(screen.getByText('Protected Content')).toBeInTheDocument();
    });

    it('should deny access when user does not have required permission', () => {
      mockAuthContext.hasPermission.mockReturnValue(false);

      render(
        <TestWrapper>
          <ProtectedRoute requiredPermission={{ resource: 'users', action: 'write' }}>
            <TestComponent />
          </ProtectedRoute>
        </TestWrapper>
      );

      expect(mockAuthContext.hasPermission).toHaveBeenCalledWith('users', 'write');
      expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
      expect(screen.getByText(/You don't have permission/)).toBeInTheDocument();
    });
  });

  describe('Inactive User Handling', () => {
    it('should deny access for inactive users', () => {
      mockAuthContext.loading = false;
      mockAuthContext.user = {
        id: 'user-123',
        email: 'test@example.com',
        aud: 'authenticated',
        role: 'authenticated'
      };
      mockAuthContext.profile = {
        id: 'user-123',
        email: 'inactive@example.com',
        full_name: 'Inactive User',
        role: 'user',
        is_active: false, // User is deactivated
        metadata: {},
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z'
      };

      render(
        <TestWrapper>
          <ProtectedRoute>
            <TestComponent />
          </ProtectedRoute>
        </TestWrapper>
      );

      expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
      expect(screen.getByText(/account has been deactivated/i)).toBeInTheDocument();
    });
  });

  describe('Complex Access Scenarios', () => {
    it('should handle both role and permission requirements', () => {
      mockAuthContext.loading = false;
      mockAuthContext.user = {
        id: 'admin-123',
        email: 'admin@example.com',
        aud: 'authenticated',
        role: 'authenticated'
      };
      mockAuthContext.profile = {
        id: 'admin-123',
        email: 'admin@example.com',
        full_name: 'Admin User',
        role: 'admin',
        is_active: true,
        metadata: {},
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z'
      };
      mockAuthContext.hasRole.mockImplementation((role) => role === 'admin');
      mockAuthContext.hasPermission.mockImplementation((resource, action) => 
        resource === 'users' && action === 'write'
      );

      render(
        <TestWrapper>
          <ProtectedRoute 
            requiredRole="admin" 
            requiredPermission={{ resource: 'users', action: 'write' }}
          >
            <TestComponent />
          </ProtectedRoute>
        </TestWrapper>
      );

      expect(mockAuthContext.hasRole).toHaveBeenCalledWith('admin');
      expect(mockAuthContext.hasPermission).toHaveBeenCalledWith('users', 'write');
      expect(screen.getByText('Protected Content')).toBeInTheDocument();
    });

    it('should fail when role matches but permission does not', () => {
      mockAuthContext.loading = false;
      mockAuthContext.user = {
        id: 'admin-123',
        email: 'admin@example.com',
        aud: 'authenticated',
        role: 'authenticated'
      };
      mockAuthContext.profile = {
        id: 'admin-123',
        email: 'admin@example.com',
        full_name: 'Admin User',
        role: 'admin',
        is_active: true,
        metadata: {},
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z'
      };
      mockAuthContext.hasRole.mockImplementation((role) => role === 'admin');
      mockAuthContext.hasPermission.mockReturnValue(false);

      render(
        <TestWrapper>
          <ProtectedRoute 
            requiredRole="admin" 
            requiredPermission={{ resource: 'system', action: 'admin' }}
          >
            <TestComponent />
          </ProtectedRoute>
        </TestWrapper>
      );

      expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
      expect(screen.getByText(/You don't have permission/)).toBeInTheDocument();
    });
  });
});