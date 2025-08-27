# Archon Frontend Architecture Document

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2025-08-26 | 1.0 | Initial frontend architecture for multi-user authentication | Winston (Architect AI) |

## Template and Framework Selection

### Current Framework Analysis

The Archon project uses a modern React-based frontend stack:

- **React 18.3.1** with TypeScript 5.5.4
- **Vite 5.2.0** as build tool and development server
- **TailwindCSS 3.4.17** for utility-first styling
- **React Router DOM 6.26.2** for client-side routing
- **Socket.IO Client** for real-time updates
- **Framer Motion** for animations
- **React DND** for drag-and-drop functionality

### Multi-User Authentication Integration Strategy

The current single-user system will be extended to support multi-user authentication while maintaining backward compatibility. No starter template changes are needed as the existing Vite + React setup provides all necessary tooling.

## Frontend Tech Stack

| Category | Technology | Version | Purpose | Rationale |
|----------|------------|---------|---------|-----------|
| Framework | React | 18.3.1 | UI component library | Industry standard, excellent TypeScript support, existing codebase |
| UI Library | TailwindCSS | 3.4.17 | Utility-first CSS framework | Already integrated, consistent design system |
| State Management | React Context + useReducer | Built-in | Authentication and global state | Sufficient for auth complexity, no Redux needed |
| Routing | React Router DOM | 6.26.2 | Client-side routing | Already integrated, supports protected routes |
| Build Tool | Vite | 5.2.0 | Fast development and building | Already configured, excellent TypeScript support |
| Styling | TailwindCSS + CSS Variables | 3.4.17 | Component styling | Existing approach, supports theming |
| Testing | Vitest + React Testing Library | 1.6.0 | Component and integration testing | Modern, fast, Jest-compatible |
| Component Library | Custom Components | N/A | Reusable UI components | Existing component system |
| Form Handling | Native React + Custom Hooks | Built-in | Form validation and submission | Lightweight, TypeScript-friendly |
| Animation | Framer Motion | 11.5.4 | UI animations and transitions | Already integrated |
| Dev Tools | TypeScript + ESLint + Vitest | 5.5.4 | Development tooling | Comprehensive type safety and testing |

## Project Structure

```
archon-ui-main/
├── src/
│   ├── components/
│   │   ├── auth/                    # Authentication components
│   │   │   ├── LoginForm.tsx
│   │   │   ├── ProtectedRoute.tsx
│   │   │   ├── UserProfile.tsx
│   │   │   └── AuthGuard.tsx
│   │   ├── common/                  # Shared UI components
│   │   ├── layouts/
│   │   │   └── MainLayout.tsx       # Existing layout with auth integration
│   │   └── ui/                      # Base UI components
│   ├── contexts/
│   │   ├── AuthContext.tsx          # Authentication state management
│   │   ├── ThemeContext.tsx         # Existing theme context
│   │   ├── ToastContext.tsx         # Existing toast notifications
│   │   └── SettingsContext.tsx      # Existing settings context
│   ├── hooks/
│   │   ├── useAuth.ts              # Authentication hook
│   │   ├── useApi.ts               # API client hook
│   │   └── useProtectedRoute.ts     # Route protection logic
│   ├── services/
│   │   ├── apiClient.ts            # HTTP client with auth interceptors
│   │   ├── authService.ts          # Authentication API calls
│   │   └── tokenService.ts         # Token management utilities
│   ├── types/
│   │   ├── auth.ts                 # Authentication type definitions
│   │   ├── api.ts                  # API response types
│   │   └── user.ts                 # User data types
│   ├── utils/
│   │   ├── auth.ts                 # Authentication utilities
│   │   ├── errorHandling.ts        # Error handling utilities
│   │   └── constants.ts            # Application constants
│   ├── pages/                      # Existing pages with auth integration
│   │   ├── LoginPage.tsx           # New login page
│   │   ├── KnowledgeBasePage.tsx   # Updated with auth
│   │   ├── ProjectPage.tsx         # Updated with auth
│   │   └── SettingsPage.tsx        # Updated with user management
│   └── App.tsx                     # Root component with AuthProvider
```

## Component Standards

### Component Template

```typescript
import { FC, ReactNode } from 'react';
import { cn } from '@/utils/classNames';

interface ComponentNameProps {
  children?: ReactNode;
  className?: string;
  variant?: 'primary' | 'secondary';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  onClick?: () => void;
}

export const ComponentName: FC<ComponentNameProps> = ({
  children,
  className,
  variant = 'primary',
  size = 'md',
  disabled = false,
  onClick,
}) => {
  return (
    <div
      className={cn(
        'base-styles',
        {
          'variant-styles': variant === 'primary',
          'size-styles': size === 'md',
          'opacity-50 cursor-not-allowed': disabled,
        },
        className
      )}
      onClick={disabled ? undefined : onClick}
    >
      {children}
    </div>
  );
};

ComponentName.displayName = 'ComponentName';
```

### Naming Conventions

- **Components**: PascalCase (`UserProfile`, `LoginForm`, `ProtectedRoute`)
- **Files**: PascalCase for components (`UserProfile.tsx`), camelCase for utilities (`authService.ts`)
- **Props Interfaces**: ComponentName + Props suffix (`UserProfileProps`)
- **Custom Hooks**: camelCase with `use` prefix (`useAuth`, `useApiCall`)
- **Types and Interfaces**: PascalCase (`User`, `AuthState`, `ApiResponse`)
- **Constants**: UPPER_SNAKE_CASE (`API_ENDPOINTS`, `TOKEN_STORAGE_KEY`)
- **CSS Classes**: kebab-case following TailwindCSS conventions

## State Management

### Store Structure

```
src/contexts/
├── AuthContext.tsx              # Main authentication context
├── auth/
│   ├── AuthProvider.tsx        # Provider implementation
│   ├── authReducer.ts          # State reducer logic
│   ├── authActions.ts          # Action creators
│   └── authTypes.ts            # State and action types
└── index.ts                    # Context exports
```

### State Management Template

```typescript
import { createContext, useContext, useReducer, ReactNode, useEffect } from 'react';
import { authReducer, initialAuthState } from './authReducer';
import { authService } from '@/services/authService';
import { tokenService } from '@/services/tokenService';
import type { AuthState, AuthActions, User, LoginCredentials } from '@/types/auth';

interface AuthContextType extends AuthState {
  login: (credentials: LoginCredentials) => Promise<void>;
  logout: () => void;
  refreshToken: () => Promise<void>;
  updateUser: (user: Partial<User>) => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [state, dispatch] = useReducer(authReducer, initialAuthState);

  const login = async (credentials: LoginCredentials) => {
    dispatch({ type: 'AUTH_LOADING' });
    try {
      const response = await authService.login(credentials);
      tokenService.setTokens(response.accessToken, response.refreshToken);
      dispatch({ type: 'AUTH_SUCCESS', payload: response.user });
    } catch (error) {
      dispatch({ type: 'AUTH_ERROR', payload: error.message });
      throw error;
    }
  };

  const logout = () => {
    tokenService.clearTokens();
    dispatch({ type: 'AUTH_LOGOUT' });
  };

  const refreshToken = async () => {
    try {
      const response = await authService.refreshToken();
      tokenService.setAccessToken(response.accessToken);
      dispatch({ type: 'TOKEN_REFRESHED', payload: response.user });
    } catch (error) {
      logout();
    }
  };

  const updateUser = (userData: Partial<User>) => {
    dispatch({ type: 'USER_UPDATED', payload: userData });
  };

  // Auto-refresh token setup
  useEffect(() => {
    const token = tokenService.getAccessToken();
    if (token && tokenService.isTokenValid(token)) {
      dispatch({ type: 'AUTH_RESTORED', payload: tokenService.getUser() });
    }
  }, []);

  const value: AuthContextType = {
    ...state,
    login,
    logout,
    refreshToken,
    updateUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};
```

## API Integration

### Service Template

```typescript
import { apiClient } from './apiClient';
import type { LoginCredentials, AuthResponse, User } from '@/types/auth';
import type { ApiResponse } from '@/types/api';

class AuthService {
  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    const response = await apiClient.post<ApiResponse<AuthResponse>>(
      '/auth/login',
      credentials
    );
    
    if (!response.data.success) {
      throw new Error(response.data.error || 'Login failed');
    }
    
    return response.data.data;
  }

  async logout(): Promise<void> {
    try {
      await apiClient.post('/auth/logout');
    } catch (error) {
      // Continue with local logout even if server request fails
      console.warn('Server logout failed:', error);
    }
  }

  async refreshToken(): Promise<{ accessToken: string; user: User }> {
    const response = await apiClient.post<ApiResponse<{ accessToken: string; user: User }>>(
      '/auth/refresh'
    );
    
    if (!response.data.success) {
      throw new Error(response.data.error || 'Token refresh failed');
    }
    
    return response.data.data;
  }

  async getCurrentUser(): Promise<User> {
    const response = await apiClient.get<ApiResponse<User>>('/auth/me');
    
    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to get user');
    }
    
    return response.data.data;
  }
}

export const authService = new AuthService();
```

### API Client Configuration

```typescript
import axios, { AxiosInstance, AxiosError } from 'axios';
import { tokenService } from './tokenService';
import type { ApiResponse } from '@/types/api';

class ApiClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: import.meta.env.VITE_API_BASE_URL,
      timeout: parseInt(import.meta.env.VITE_API_TIMEOUT) || 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.setupInterceptors();
  }

  private setupInterceptors() {
    // Request interceptor - add auth token
    this.client.interceptors.request.use(
      (config) => {
        const token = tokenService.getAccessToken();
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor - handle token refresh
    this.client.interceptors.response.use(
      (response) => response,
      async (error: AxiosError) => {
        const originalRequest = error.config;

        if (error.response?.status === 401 && !originalRequest._retry) {
          originalRequest._retry = true;

          try {
            const refreshResponse = await this.client.post('/auth/refresh');
            const { accessToken } = refreshResponse.data.data;
            
            tokenService.setAccessToken(accessToken);
            originalRequest.headers.Authorization = `Bearer ${accessToken}`;
            
            return this.client(originalRequest);
          } catch (refreshError) {
            tokenService.clearTokens();
            window.location.href = '/login';
            return Promise.reject(refreshError);
          }
        }

        return Promise.reject(error);
      }
    );
  }

  // HTTP method wrappers
  get<T = any>(url: string, config?: any) {
    return this.client.get<T>(url, config);
  }

  post<T = any>(url: string, data?: any, config?: any) {
    return this.client.post<T>(url, data, config);
  }

  put<T = any>(url: string, data?: any, config?: any) {
    return this.client.put<T>(url, data, config);
  }

  delete<T = any>(url: string, config?: any) {
    return this.client.delete<T>(url, config);
  }
}

export const apiClient = new ApiClient();
```

## Routing

### Route Configuration

```typescript
import { Routes, Route, Navigate } from 'react-router-dom';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { RoleGuard } from '@/components/auth/RoleGuard';
import { useAuth } from '@/contexts/AuthContext';

// Pages
import { LoginPage } from '@/pages/LoginPage';
import { KnowledgeBasePage } from '@/pages/KnowledgeBasePage';
import { ProjectPage } from '@/pages/ProjectPage';
import { SettingsPage } from '@/pages/SettingsPage';
import { AdminPage } from '@/pages/AdminPage';

export const AppRoutes = () => {
  const { isAuthenticated, user } = useAuth();

  return (
    <Routes>
      {/* Public routes */}
      <Route 
        path="/login" 
        element={
          isAuthenticated ? <Navigate to="/" replace /> : <LoginPage />
        } 
      />

      {/* Protected routes */}
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <KnowledgeBasePage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/projects"
        element={
          <ProtectedRoute>
            <RoleGuard allowedRoles={['user', 'admin']}>
              <ProjectPage />
            </RoleGuard>
          </ProtectedRoute>
        }
      />

      <Route
        path="/settings"
        element={
          <ProtectedRoute>
            <SettingsPage />
          </ProtectedRoute>
        }
      />

      {/* Admin-only routes */}
      <Route
        path="/admin"
        element={
          <ProtectedRoute>
            <RoleGuard allowedRoles={['admin']}>
              <AdminPage />
            </RoleGuard>
          </ProtectedRoute>
        }
      />

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

// ProtectedRoute component
interface ProtectedRouteProps {
  children: ReactNode;
}

export const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

// Role-based access control
interface RoleGuardProps {
  children: ReactNode;
  allowedRoles: string[];
  fallback?: ReactNode;
}

export const RoleGuard = ({ children, allowedRoles, fallback }: RoleGuardProps) => {
  const { user } = useAuth();

  if (!user || !allowedRoles.includes(user.role)) {
    return fallback || <Navigate to="/" replace />;
  }

  return <>{children}</>;
};
```

## Styling Guidelines

### Styling Approach

The project uses TailwindCSS utility-first approach with CSS custom properties for theming. Authentication components follow the existing design system while adding new auth-specific styling patterns.

### Global Theme Variables

```css
:root {
  /* Existing color variables */
  --color-background: 0 0% 100%;
  --color-foreground: 222.2 84% 4.9%;
  --color-primary: 221.2 83.2% 53.3%;
  --color-secondary: 210 40% 98%;
  --color-muted: 210 40% 96%;
  --color-accent: 210 40% 94%;
  --color-destructive: 0 84.2% 60.2%;
  --color-border: 214.3 31.8% 91.4%;
  
  /* Authentication specific colors */
  --color-auth-success: 142.1 76.2% 36.3%;
  --color-auth-warning: 47.9 95.8% 53.1%;
  --color-auth-error: 0 84.2% 60.2%;
  --color-auth-info: 204.4 100% 53.5%;
  
  /* Authentication component spacing */
  --auth-form-width: 400px;
  --auth-form-padding: 2rem;
  --auth-field-spacing: 1.5rem;
  --auth-button-height: 2.75rem;
  
  /* Authentication shadows and borders */
  --auth-form-shadow: 0 10px 15px -3px rgb(0 0 0 / 0.1);
  --auth-field-border-radius: 0.5rem;
  --auth-button-border-radius: 0.375rem;
}

[data-theme="dark"] {
  /* Dark theme overrides */
  --color-background: 222.2 84% 4.9%;
  --color-foreground: 210 40% 98%;
  --color-primary: 217.2 91.2% 59.8%;
  --color-secondary: 217.2 32.6% 17.5%;
  --color-muted: 217.2 32.6% 17.5%;
  --color-accent: 217.2 32.6% 17.5%;
  --color-border: 217.2 32.6% 17.5%;
  
  /* Dark theme auth colors */
  --color-auth-success: 142.1 70.6% 45.3%;
  --color-auth-warning: 47.9 95.8% 53.1%;
  --color-auth-error: 0 62.8% 30.6%;
  --color-auth-info: 204.4 80% 63.5%;
  
  --auth-form-shadow: 0 10px 15px -3px rgb(0 0 0 / 0.3);
}

/* Authentication utility classes */
.auth-form {
  @apply w-full max-w-[var(--auth-form-width)] p-[var(--auth-form-padding)] 
         bg-white dark:bg-gray-800 rounded-lg shadow-[var(--auth-form-shadow)] 
         border border-gray-200 dark:border-gray-700;
}

.auth-field {
  @apply w-full h-[var(--auth-button-height)] px-3 py-2 
         border border-gray-300 dark:border-gray-600 
         rounded-[var(--auth-field-border-radius)]
         bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100
         focus:ring-2 focus:ring-blue-500 focus:border-transparent
         disabled:opacity-50 disabled:cursor-not-allowed;
}

.auth-button {
  @apply h-[var(--auth-button-height)] px-6 py-2 
         rounded-[var(--auth-button-border-radius)] font-medium
         transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed;
}

.auth-button-primary {
  @apply auth-button bg-blue-600 hover:bg-blue-700 text-white;
}

.auth-button-secondary {
  @apply auth-button bg-gray-200 hover:bg-gray-300 text-gray-900 
         dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-gray-100;
}
```

## Testing Requirements

### Component Test Template

```typescript
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from '@/contexts/AuthContext';
import { LoginForm } from '@/components/auth/LoginForm';
import { authService } from '@/services/authService';

// Mock the auth service
vi.mock('@/services/authService');

const mockAuthService = vi.mocked(authService);

// Test wrapper with providers
const renderWithProviders = (ui: React.ReactElement) => {
  return render(
    <BrowserRouter>
      <AuthProvider>
        {ui}
      </AuthProvider>
    </BrowserRouter>
  );
};

describe('LoginForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render login form fields', () => {
    renderWithProviders(<LoginForm />);
    
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
  });

  it('should validate required fields', async () => {
    renderWithProviders(<LoginForm />);
    
    const submitButton = screen.getByRole('button', { name: /sign in/i });
    fireEvent.click(submitButton);
    
    await waitFor(() => {
      expect(screen.getByText(/email is required/i)).toBeInTheDocument();
      expect(screen.getByText(/password is required/i)).toBeInTheDocument();
    });
  });

  it('should call authService.login on valid submission', async () => {
    const mockLoginResponse = {
      user: { id: '1', email: 'test@example.com', role: 'user' },
      accessToken: 'fake-token',
      refreshToken: 'fake-refresh-token'
    };
    
    mockAuthService.login.mockResolvedValueOnce(mockLoginResponse);
    
    renderWithProviders(<LoginForm />);
    
    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: 'test@example.com' }
    });
    fireEvent.change(screen.getByLabelText(/password/i), {
      target: { value: 'password123' }
    });
    
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));
    
    await waitFor(() => {
      expect(mockAuthService.login).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'password123'
      });
    });
  });

  it('should display error message on login failure', async () => {
    const errorMessage = 'Invalid credentials';
    mockAuthService.login.mockRejectedValueOnce(new Error(errorMessage));
    
    renderWithProviders(<LoginForm />);
    
    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: 'test@example.com' }
    });
    fireEvent.change(screen.getByLabelText(/password/i), {
      target: { value: 'wrongpassword' }
    });
    
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));
    
    await waitFor(() => {
      expect(screen.getByText(errorMessage)).toBeInTheDocument();
    });
  });

  it('should disable submit button while loading', async () => {
    mockAuthService.login.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)));
    
    renderWithProviders(<LoginForm />);
    
    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: 'test@example.com' }
    });
    fireEvent.change(screen.getByLabelText(/password/i), {
      target: { value: 'password123' }
    });
    
    const submitButton = screen.getByRole('button', { name: /sign in/i });
    fireEvent.click(submitButton);
    
    expect(submitButton).toBeDisabled();
    expect(screen.getByText(/signing in/i)).toBeInTheDocument();
  });
});
```

### Testing Best Practices

1. **Unit Tests**: Test individual components in isolation
2. **Integration Tests**: Test component interactions
3. **E2E Tests**: Test critical user flows (using Cypress/Playwright)
4. **Coverage Goals**: Aim for 80% code coverage
5. **Test Structure**: Arrange-Act-Assert pattern
6. **Mock External Dependencies**: API calls, routing, state management

## Environment Configuration

Required environment variables for React + Vite application with authentication:

```env
# API Configuration
VITE_API_BASE_URL=http://localhost:8181/api
VITE_WS_BASE_URL=http://localhost:8181

# Authentication Configuration
VITE_AUTH_TOKEN_KEY=archon_auth_token
VITE_REFRESH_TOKEN_KEY=archon_refresh_token
VITE_TOKEN_REFRESH_THRESHOLD=300000

# Feature Flags
VITE_PROJECTS_ENABLED=true
VITE_MULTI_USER_ENABLED=true

# Development
VITE_LOG_LEVEL=debug
VITE_API_TIMEOUT=30000

# Optional: External Services
VITE_SOCKET_IO_PATH=/socket.io/
```

## Frontend Developer Standards

### Critical Coding Rules

#### Universal Rules:
1. **NEVER store tokens in localStorage** - only httpOnly cookies or secure sessionStorage
2. **Always use TypeScript strict mode** - prevents runtime errors
3. **Mandatory validation of all API responses** - use Zod schemas
4. **Never mutate state directly** - only through setState/dispatch
5. **Mandatory cleanup functions in useEffect** - prevents memory leaks

#### React + TypeScript Specific:
6. **Use useCallback for functions in dependencies** - prevents infinite re-renders
7. **Always specify key for lists** - use stable identifiers
8. **Mandatory typing of props** - interfaces instead of any
9. **Error boundaries for all async operations** - graceful error handling
10. **Memoization of expensive calculations** - useMemo for complex logic

#### Authentication Specific:
11. **Never log tokens** - even in development mode
12. **Mandatory token cleanup on logout** - from all storage
13. **Check token expiry on every request** - automatic refresh
14. **Protected routes must check roles** - not just token presence

### Quick Reference

#### Development Commands:
```bash
npm run dev              # Start dev server (port 3737)
npm run build           # Production build
npm run lint            # ESLint check
npm run test            # Run tests
npm run test:coverage   # Tests with coverage
```

#### Key Imports:
```typescript
// Authentication
import { useAuth } from '@/contexts/AuthContext'
import { ProtectedRoute } from '@/components/auth/ProtectedRoute'

// API client
import { apiClient } from '@/services/apiClient'
import { handleApiError } from '@/utils/errorHandling'

// Types
import type { User, AuthState } from '@/types/auth'
import type { ApiResponse } from '@/types/api'

// Utils
import { cn } from '@/utils/classNames'
import { formatDate } from '@/utils/dateHelpers'
```

#### Naming Conventions:
- **Components**: PascalCase (`UserProfile.tsx`)
- **Hooks**: camelCase with use prefix (`useAuthStatus`)
- **Services**: camelCase (`authService.ts`)
- **Types**: PascalCase with suffix (`UserData`, `AuthResponse`)
- **Constants**: UPPER_SNAKE_CASE (`API_ENDPOINTS`)

#### Project Patterns:
- **Contexts** for global authentication state
- **Custom hooks** for reusable logic
- **Service layer** for all API calls
- **Error boundaries** at page level
- **Optimistic updates** for better UX