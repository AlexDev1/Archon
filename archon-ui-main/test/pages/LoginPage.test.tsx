/**
 * Tests for LoginPage component
 * Tests form validation, submission, error handling, and navigation
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import LoginPage from '../../src/pages/LoginPage';
import { AuthProvider } from '../../src/contexts/AuthContext';
import { ToastProvider } from '../../src/contexts/ToastContext';

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

vi.mock('../../src/contexts/AuthContext', async () => {
  const actual = await vi.importActual('../../src/contexts/AuthContext');
  return {
    ...actual,
    useAuth: () => mockAuthContext,
  };
});

// Mock React Router navigation
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

// Mock Framer Motion to avoid animation issues in tests
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
    form: ({ children, ...props }: any) => <form {...props}>{children}</form>,
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}));

// Test component wrapper
const TestWrapper = ({ children }: { children: React.ReactNode }) => (
  <BrowserRouter>
    <ToastProvider>
      <AuthProvider>
        {children}
      </AuthProvider>
    </ToastProvider>
  </BrowserRouter>
);

describe('LoginPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthContext.loading = false;
    mockAuthContext.user = null;
    mockAuthContext.profile = null;
  });

  describe('Rendering', () => {
    it('should render login form elements', () => {
      render(
        <TestWrapper>
          <LoginPage />
        </TestWrapper>
      );

      expect(screen.getByRole('heading', { name: /добро пожаловать/i })).toBeInTheDocument();
      expect(screen.getByPlaceholderText(/email/i)).toBeInTheDocument();
      expect(screen.getByPlaceholderText(/пароль/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /войти/i })).toBeInTheDocument();
      expect(screen.getByText(/нет аккаунта/i)).toBeInTheDocument();
    });

    it('should render link to registration page', () => {
      render(
        <TestWrapper>
          <LoginPage />
        </TestWrapper>
      );

      const registerLink = screen.getByRole('link', { name: /зарегистрироваться/i });
      expect(registerLink).toBeInTheDocument();
      expect(registerLink).toHaveAttribute('href', '/register');
    });
  });

  describe('Form Validation', () => {
    it('should show validation errors for empty fields', async () => {
      const user = userEvent.setup();
      
      render(
        <TestWrapper>
          <LoginPage />
        </TestWrapper>
      );

      const submitButton = screen.getByRole('button', { name: /войти/i });
      
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/email обязателен/i)).toBeInTheDocument();
        expect(screen.getByText(/пароль обязателен/i)).toBeInTheDocument();
      });
    });

    it('should show validation error for invalid email format', async () => {
      const user = userEvent.setup();
      
      render(
        <TestWrapper>
          <LoginPage />
        </TestWrapper>
      );

      const emailInput = screen.getByPlaceholderText(/email/i);
      const passwordInput = screen.getByPlaceholderText(/пароль/i);
      const submitButton = screen.getByRole('button', { name: /войти/i });

      await user.type(emailInput, 'invalid-email');
      await user.type(passwordInput, 'password123');
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/неверный формат email/i)).toBeInTheDocument();
      });
    });

    it('should show validation error for short password', async () => {
      const user = userEvent.setup();
      
      render(
        <TestWrapper>
          <LoginPage />
        </TestWrapper>
      );

      const emailInput = screen.getByPlaceholderText(/email/i);
      const passwordInput = screen.getByPlaceholderText(/пароль/i);
      const submitButton = screen.getByRole('button', { name: /войти/i });

      await user.type(emailInput, 'test@example.com');
      await user.type(passwordInput, '123');
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/пароль должен содержать минимум 6 символов/i)).toBeInTheDocument();
      });
    });
  });

  describe('Form Submission', () => {
    it('should call login function with correct credentials', async () => {
      const user = userEvent.setup();
      mockAuthContext.login.mockResolvedValue({
        user: {
          id: 'user-123',
          email: 'test@example.com',
          aud: 'authenticated',
          role: 'authenticated'
        },
        error: null
      });

      render(
        <TestWrapper>
          <LoginPage />
        </TestWrapper>
      );

      const emailInput = screen.getByPlaceholderText(/email/i);
      const passwordInput = screen.getByPlaceholderText(/пароль/i);
      const submitButton = screen.getByRole('button', { name: /войти/i });

      await user.type(emailInput, 'test@example.com');
      await user.type(passwordInput, 'password123');
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockAuthContext.login).toHaveBeenCalledWith('test@example.com', 'password123');
      });
    });

    it('should show loading state during submission', async () => {
      const user = userEvent.setup();
      mockAuthContext.login.mockImplementation(() => 
        new Promise(resolve => setTimeout(resolve, 100))
      );

      render(
        <TestWrapper>
          <LoginPage />
        </TestWrapper>
      );

      const emailInput = screen.getByPlaceholderText(/email/i);
      const passwordInput = screen.getByPlaceholderText(/пароль/i);
      const submitButton = screen.getByRole('button', { name: /войти/i });

      await user.type(emailInput, 'test@example.com');
      await user.type(passwordInput, 'password123');
      await user.click(submitButton);

      expect(screen.getByText(/загрузка/i)).toBeInTheDocument();
      expect(submitButton).toBeDisabled();
    });

    it('should navigate to home page after successful login', async () => {
      const user = userEvent.setup();
      mockAuthContext.login.mockResolvedValue({
        user: {
          id: 'user-123',
          email: 'test@example.com',
          aud: 'authenticated',
          role: 'authenticated'
        },
        error: null
      });

      render(
        <TestWrapper>
          <LoginPage />
        </TestWrapper>
      );

      const emailInput = screen.getByPlaceholderText(/email/i);
      const passwordInput = screen.getByPlaceholderText(/пароль/i);
      const submitButton = screen.getByRole('button', { name: /войти/i });

      await user.type(emailInput, 'test@example.com');
      await user.type(passwordInput, 'password123');
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/');
      });
    });
  });

  describe('Error Handling', () => {
    it('should display login error message', async () => {
      const user = userEvent.setup();
      const errorMessage = 'Invalid login credentials';
      mockAuthContext.login.mockResolvedValue({
        user: null,
        error: { message: errorMessage }
      });

      render(
        <TestWrapper>
          <LoginPage />
        </TestWrapper>
      );

      const emailInput = screen.getByPlaceholderText(/email/i);
      const passwordInput = screen.getByPlaceholderText(/пароль/i);
      const submitButton = screen.getByRole('button', { name: /войти/i });

      await user.type(emailInput, 'test@example.com');
      await user.type(passwordInput, 'wrongpassword');
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(errorMessage)).toBeInTheDocument();
      });
    });

    it('should display generic error for unknown errors', async () => {
      const user = userEvent.setup();
      mockAuthContext.login.mockRejectedValue(new Error('Network error'));

      render(
        <TestWrapper>
          <LoginPage />
        </TestWrapper>
      );

      const emailInput = screen.getByPlaceholderText(/email/i);
      const passwordInput = screen.getByPlaceholderText(/пароль/i);
      const submitButton = screen.getByRole('button', { name: /войти/i });

      await user.type(emailInput, 'test@example.com');
      await user.type(passwordInput, 'password123');
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/произошла ошибка/i)).toBeInTheDocument();
      });
    });

    it('should clear error message when user starts typing', async () => {
      const user = userEvent.setup();
      const errorMessage = 'Invalid login credentials';
      mockAuthContext.login.mockResolvedValue({
        user: null,
        error: { message: errorMessage }
      });

      render(
        <TestWrapper>
          <LoginPage />
        </TestWrapper>
      );

      const emailInput = screen.getByPlaceholderText(/email/i);
      const passwordInput = screen.getByPlaceholderText(/пароль/i);
      const submitButton = screen.getByRole('button', { name: /войти/i });

      // Trigger error
      await user.type(emailInput, 'test@example.com');
      await user.type(passwordInput, 'wrongpassword');
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(errorMessage)).toBeInTheDocument();
      });

      // Clear error by typing
      await user.clear(passwordInput);
      await user.type(passwordInput, 'newpassword');

      await waitFor(() => {
        expect(screen.queryByText(errorMessage)).not.toBeInTheDocument();
      });
    });
  });

  describe('Redirect Logic', () => {
    it('should redirect authenticated users to home page', () => {
      mockAuthContext.user = {
        id: 'user-123',
        email: 'test@example.com',
        aud: 'authenticated',
        role: 'authenticated'
      };

      render(
        <TestWrapper>
          <LoginPage />
        </TestWrapper>
      );

      expect(mockNavigate).toHaveBeenCalledWith('/');
    });
  });

  describe('Accessibility', () => {
    it('should have proper form labels and structure', () => {
      render(
        <TestWrapper>
          <LoginPage />
        </TestWrapper>
      );

      const form = screen.getByRole('form');
      expect(form).toBeInTheDocument();

      const emailInput = screen.getByPlaceholderText(/email/i);
      const passwordInput = screen.getByPlaceholderText(/пароль/i);

      expect(emailInput).toHaveAttribute('type', 'email');
      expect(passwordInput).toHaveAttribute('type', 'password');
      expect(emailInput).toHaveAttribute('required');
      expect(passwordInput).toHaveAttribute('required');
    });

    it('should support keyboard navigation', async () => {
      const user = userEvent.setup();

      render(
        <TestWrapper>
          <LoginPage />
        </TestWrapper>
      );

      const emailInput = screen.getByPlaceholderText(/email/i);
      const passwordInput = screen.getByPlaceholderText(/пароль/i);
      const submitButton = screen.getByRole('button', { name: /войти/i });

      // Tab navigation
      await user.tab();
      expect(emailInput).toHaveFocus();

      await user.tab();
      expect(passwordInput).toHaveFocus();

      await user.tab();
      expect(submitButton).toHaveFocus();
    });
  });

  describe('Password Visibility Toggle', () => {
    it('should toggle password visibility', async () => {
      const user = userEvent.setup();

      render(
        <TestWrapper>
          <LoginPage />
        </TestWrapper>
      );

      const passwordInput = screen.getByPlaceholderText(/пароль/i);
      const toggleButton = screen.getByRole('button', { name: /показать пароль/i });

      expect(passwordInput).toHaveAttribute('type', 'password');

      await user.click(toggleButton);
      expect(passwordInput).toHaveAttribute('type', 'text');

      await user.click(toggleButton);
      expect(passwordInput).toHaveAttribute('type', 'password');
    });
  });
});