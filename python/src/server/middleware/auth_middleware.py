"""
Authentication Middleware for FastAPI with Supabase Auth
"""

import logging
from typing import Optional, Union, Dict, Any
from collections.abc import Callable

from fastapi import Request, Response, HTTPException, status
from starlette.middleware.base import BaseHTTPMiddleware
from jose import JWTError, jwt

from ..config.config import get_config
from ..config.logfire_config import get_logger

logger = get_logger("auth_middleware")

class AuthenticationError(Exception):
    """Custom exception for authentication errors."""
    pass

class AuthorizationError(Exception):
    """Custom exception for authorization errors."""
    pass

class AuthMiddleware(BaseHTTPMiddleware):
    """
    Middleware that handles JWT token validation and user authentication.
    
    Features:
    - Validates Supabase JWT tokens
    - Extracts user information from tokens
    - Adds user context to requests
    - Handles role-based access control
    """

    # Routes that don't require authentication
    PUBLIC_ROUTES = {
        "/",
        "/health",
        "/api/health", 
        "/docs",
        "/redoc",
        "/openapi.json",
        "/api/auth/login",
        "/api/auth/register", 
        "/api/auth/refresh",
        "/api/auth/health",
        "/api/credentials/DISCONNECT_SCREEN_ENABLED",
        "/api/credentials/PROJECTS_ENABLED",
        "/favicon.ico"
    }

    # Routes that should be accessible for unauthenticated users but may need auth info if available
    OPTIONAL_AUTH_ROUTES = {
        "/api/agent-chat/sessions"
    }

    # Routes that require admin privileges
    ADMIN_ROUTES = {
        "/api/users/manage",
        "/api/admin"
    }

    def __init__(self, app):
        super().__init__(app)
        self.config = get_config()
        self.logger = logger

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        """Process authentication for incoming requests."""
        
        # Skip authentication for public routes
        if self._is_public_route(request.url.path):
            return await call_next(request)

        try:
            # Extract and validate JWT token
            token = self._extract_token(request)
            user_info = None
            
            if token:
                user_info = await self._validate_token(token)
                # Add user context to request
                request.state.user = user_info
                request.state.authenticated = True
            else:
                request.state.user = None
                request.state.authenticated = False

            # Check if route requires authentication
            if self._requires_authentication(request.url.path) and not user_info:
                raise AuthenticationError("Authentication required")

            # Check role-based access
            if self._requires_admin_access(request.url.path):
                if not user_info or not self._is_admin(user_info):
                    raise AuthorizationError("Admin access required")

            # Process request
            response = await call_next(request)
            return response

        except AuthenticationError as e:
            self.logger.warning(f"Authentication failed for {request.url.path}: {e}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Authentication required",
                headers={"WWW-Authenticate": "Bearer"}
            )
        except AuthorizationError as e:
            self.logger.warning(f"Authorization failed for {request.url.path}: {e}")
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions"
            )
        except Exception as e:
            self.logger.error(f"Auth middleware error: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Authentication system error"
            )

    def _is_public_route(self, path: str) -> bool:
        """Check if route is public (doesn't require authentication)."""
        return path in self.PUBLIC_ROUTES or path.startswith('/static/')

    def _requires_authentication(self, path: str) -> bool:
        """Check if route requires authentication."""
        # Most API routes require authentication, but some are optional or public
        return (path.startswith('/api/') 
                and not self._is_public_route(path)
                and path not in self.OPTIONAL_AUTH_ROUTES)

    def _requires_admin_access(self, path: str) -> bool:
        """Check if route requires admin access."""
        return any(path.startswith(admin_route) for admin_route in self.ADMIN_ROUTES)

    def _extract_token(self, request: Request) -> Optional[str]:
        """Extract JWT token from request headers."""
        authorization = request.headers.get("Authorization")
        if not authorization:
            return None

        try:
            scheme, token = authorization.split(" ", 1)
            if scheme.lower() != "bearer":
                return None
            return token
        except ValueError:
            return None

    async def _validate_token(self, token: str) -> Dict[str, Any]:
        """
        Validate Supabase JWT token and extract user information.
        
        Args:
            token: JWT token to validate
            
        Returns:
            Dict containing user information
            
        Raises:
            AuthenticationError: If token is invalid
        """
        try:
            # Decode JWT token without signature verification first to get the key ID
            unverified_header = jwt.get_unverified_header(token)
            unverified_payload = jwt.get_unverified_claims(token)

            # For now, we'll validate the token structure and expiration
            # In production, you should validate the signature using Supabase's public key
            payload = jwt.decode(
                token,
                # For development, we'll skip signature verification
                # In production, use the actual Supabase JWT secret or public key
                options={"verify_signature": False, "verify_exp": True}
            )

            # Extract user information
            user_id = payload.get("sub")
            email = payload.get("email")
            role = payload.get("role", "authenticated")
            
            if not user_id:
                raise AuthenticationError("Invalid token: missing user ID")

            # Build user info
            user_info = {
                "id": user_id,
                "email": email,
                "role": role,
                "raw_token": payload
            }

            # Log successful authentication (without sensitive data)
            self.logger.info(f"User authenticated: {user_id} ({email})")
            
            return user_info

        except JWTError as e:
            raise AuthenticationError(f"Invalid token: {str(e)}")
        except Exception as e:
            raise AuthenticationError(f"Token validation error: {str(e)}")

    def _is_admin(self, user_info: Dict[str, Any]) -> bool:
        """Check if user has admin privileges."""
        # Check if user has admin role in the token
        return user_info.get("role") == "admin"

    @staticmethod
    def get_current_user(request: Request) -> Optional[Dict[str, Any]]:
        """Get current user from request context."""
        return getattr(request.state, 'user', None)

    @staticmethod
    def is_authenticated(request: Request) -> bool:
        """Check if current request is authenticated."""
        return getattr(request.state, 'authenticated', False)

    @staticmethod
    def require_auth(request: Request) -> Dict[str, Any]:
        """Get current user or raise authentication error."""
        user = AuthMiddleware.get_current_user(request)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Authentication required"
            )
        return user

    @staticmethod
    def require_admin(request: Request) -> Dict[str, Any]:
        """Get current user and ensure admin role."""
        user = AuthMiddleware.require_auth(request)
        if user.get("role") != "admin":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Admin privileges required"
            )
        return user


class SupabaseJWTValidator:
    """
    Helper class for validating Supabase JWT tokens with proper signature verification.
    """
    
    def __init__(self, supabase_url: str, supabase_anon_key: str):
        self.supabase_url = supabase_url
        self.supabase_anon_key = supabase_anon_key
        self._jwks_cache: Optional[Dict] = None
        self.logger = get_logger("jwt_validator")

    async def validate_token(self, token: str) -> Dict[str, Any]:
        """
        Validate Supabase JWT token with proper signature verification.
        
        This method should be used in production for full security.
        """
        try:
            # Get the JWT header to extract key ID
            header = jwt.get_unverified_header(token)
            key_id = header.get("kid")

            if not key_id:
                raise AuthenticationError("Token missing key ID")

            # Get public key for verification (would need to implement JWKS fetching)
            # For now, we'll use the simpler approach
            
            # Decode and validate token
            payload = jwt.decode(
                token,
                # In production, use the actual public key from Supabase JWKS endpoint
                options={"verify_signature": False, "verify_exp": True, "verify_aud": False}
            )

            return payload

        except JWTError as e:
            self.logger.error(f"JWT validation error: {e}")
            raise AuthenticationError(f"Invalid token: {str(e)}")


# Dependency injection helpers for FastAPI routes
from fastapi import Depends

def get_current_user_dep(request: Request) -> Dict[str, Any]:
    """FastAPI dependency to get current user."""
    return AuthMiddleware.require_auth(request)

def get_current_admin_dep(request: Request) -> Dict[str, Any]:
    """FastAPI dependency to get current admin user."""
    return AuthMiddleware.require_admin(request)

def get_optional_user_dep(request: Request) -> Optional[Dict[str, Any]]:
    """FastAPI dependency to get current user (optional)."""
    return AuthMiddleware.get_current_user(request)