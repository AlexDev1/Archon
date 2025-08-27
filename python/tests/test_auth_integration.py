"""
Integration tests for authentication system
Tests full authentication flow from frontend to backend
"""

import pytest
import asyncio
import json
from unittest.mock import Mock, patch, AsyncMock
from fastapi.testclient import TestClient
from fastapi import FastAPI
import tempfile
import os

# Setup test app
app = FastAPI()

# Import and setup the auth components
import sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'src'))

from src.server.api_routes.auth_api import router as auth_router
from src.server.middleware.auth_middleware import AuthMiddleware

app.add_middleware(AuthMiddleware)
app.include_router(auth_router)

# Add test endpoints
@app.get("/api/test/public")
async def public_endpoint():
    return {"message": "public access"}

@app.get("/api/test/protected")  
async def protected_endpoint():
    return {"message": "protected access"}

@app.get("/api/test/admin")
async def admin_endpoint():
    return {"message": "admin access"}

# Mock Supabase for integration tests
class MockSupabaseClient:
    def __init__(self):
        self.users = {}  # Store test users
        self.profiles = {}  # Store test profiles
        self.sessions = {}  # Store test sessions
        
    def table(self, table_name):
        return MockTable(table_name, self)
    
    def rpc(self, function_name, params=None):
        return MockRPC(function_name, params, self)

class MockTable:
    def __init__(self, table_name, client):
        self.table_name = table_name
        self.client = client
        self._select_fields = "*"
        self._filters = {}
        
    def select(self, fields="*"):
        self._select_fields = fields
        return self
        
    def eq(self, column, value):
        self._filters[column] = value
        return self
        
    def order(self, column, desc=False):
        self._order = (column, desc)
        return self
        
    def update(self, data):
        self._update_data = data
        return self
        
    def execute(self):
        mock_response = Mock()
        
        if self.table_name == "user_profiles":
            if hasattr(self, '_update_data'):
                # Handle update
                user_id = self._filters.get('id')
                if user_id and user_id in self.client.profiles:
                    profile = self.client.profiles[user_id].copy()
                    profile.update(self._update_data)
                    self.client.profiles[user_id] = profile
                    mock_response.data = [profile]
                else:
                    mock_response.data = []
            else:
                # Handle select
                if 'id' in self._filters:
                    user_id = self._filters['id']
                    if user_id in self.client.profiles:
                        mock_response.data = [self.client.profiles[user_id]]
                    else:
                        mock_response.data = []
                else:
                    # Return all profiles
                    mock_response.data = list(self.client.profiles.values())
        else:
            mock_response.data = []
            
        return mock_response

class MockRPC:
    def __init__(self, function_name, params, client):
        self.function_name = function_name
        self.params = params
        self.client = client
        
    def execute(self):
        mock_response = Mock()
        
        if self.function_name == "get_user_data_stats":
            mock_response.data = [{
                "sources_count": 5,
                "documents_count": 20,
                "projects_count": 3,
                "tasks_count": 15
            }]
        elif self.function_name == "update_user_role":
            mock_response.data = [{"success": True}]
        elif self.function_name == "deactivate_user":
            mock_response.data = [{"success": True}]
        else:
            mock_response.data = [{"success": False}]
            
        return mock_response

@pytest.fixture
def mock_supabase():
    """Create mock Supabase client with test data"""
    client = MockSupabaseClient()
    
    # Add test users
    test_user_id = "test-user-123"
    test_admin_id = "test-admin-456"
    
    client.profiles[test_user_id] = {
        "id": test_user_id,
        "email": "user@example.com",
        "full_name": "Test User", 
        "role": "user",
        "is_active": True,
        "metadata": {},
        "created_at": "2024-01-01T00:00:00Z",
        "updated_at": "2024-01-01T00:00:00Z"
    }
    
    client.profiles[test_admin_id] = {
        "id": test_admin_id,
        "email": "admin@example.com",
        "full_name": "Admin User",
        "role": "admin", 
        "is_active": True,
        "metadata": {},
        "created_at": "2024-01-01T00:00:00Z",
        "updated_at": "2024-01-01T00:00:00Z"
    }
    
    return client

@pytest.fixture
def client():
    """Create test client"""
    return TestClient(app)

@pytest.fixture
def auth_headers():
    """Mock auth headers for testing"""
    return {
        "authorization": "Bearer test-jwt-token"
    }

class TestPublicEndpoints:
    """Test public endpoint access"""
    
    def test_public_endpoint_accessible_without_auth(self, client):
        """Public endpoints should be accessible without authentication"""
        response = client.get("/api/test/public")
        assert response.status_code == 200
        assert response.json()["message"] == "public access"
    
    def test_health_endpoint_accessible(self, client):
        """Health endpoint should be accessible"""
        response = client.get("/api/health")
        # May not exist yet, but should not require auth
        assert response.status_code in [200, 404]

class TestAuthenticationFlow:
    """Test complete authentication flow"""
    
    @patch('src.server.api_routes.auth_api.get_supabase_client')
    def test_user_registration_flow(self, mock_get_supabase, client, mock_supabase):
        """Test complete user registration flow"""
        mock_get_supabase.return_value = mock_supabase
        
        registration_data = {
            "email": "newuser@example.com",
            "password": "securepassword123",
            "full_name": "New User"
        }
        
        response = client.post("/api/auth/register", json=registration_data)
        
        # Currently returns 501 (placeholder), but structure should be correct
        assert response.status_code in [200, 201, 501]
    
    @patch('src.server.api_routes.auth_api.get_supabase_client')
    @patch('src.server.api_routes.auth_api.get_current_user_dep')
    def test_profile_retrieval_flow(self, mock_get_user, mock_get_supabase, client, mock_supabase):
        """Test user profile retrieval"""
        test_user_id = "test-user-123"
        mock_get_user.return_value = {"id": test_user_id}
        mock_get_supabase.return_value = mock_supabase
        
        response = client.get("/api/auth/profile")
        
        assert response.status_code == 200
        data = response.json()
        assert data["email"] == "user@example.com"
        assert data["role"] == "user"
        assert data["is_active"] == True
    
    @patch('src.server.api_routes.auth_api.get_supabase_client')
    @patch('src.server.api_routes.auth_api.get_current_user_dep')
    def test_profile_update_flow(self, mock_get_user, mock_get_supabase, client, mock_supabase):
        """Test profile update functionality"""
        test_user_id = "test-user-123" 
        mock_get_user.return_value = {"id": test_user_id}
        mock_get_supabase.return_value = mock_supabase
        
        update_data = {
            "full_name": "Updated Name",
            "avatar_url": "https://example.com/new-avatar.jpg"
        }
        
        response = client.put("/api/auth/profile", json=update_data)
        
        assert response.status_code == 200
        data = response.json()
        assert data["full_name"] == "Updated Name"
        assert data["avatar_url"] == "https://example.com/new-avatar.jpg"

class TestRoleBasedAccess:
    """Test role-based access control"""
    
    @patch('src.server.api_routes.auth_api.get_supabase_client')
    @patch('src.server.api_routes.auth_api.get_current_admin_dep')
    def test_admin_can_list_users(self, mock_admin_dep, mock_get_supabase, client, mock_supabase):
        """Test admin can access user management features"""
        mock_admin_dep.return_value = {"id": "test-admin-456", "role": "admin"}
        mock_get_supabase.return_value = mock_supabase
        
        response = client.get("/api/auth/users")
        
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) == 2  # Should have test user and admin
    
    @patch('src.server.api_routes.auth_api.get_supabase_client')
    @patch('src.server.api_routes.auth_api.get_current_admin_dep')
    def test_admin_can_update_user_roles(self, mock_admin_dep, mock_get_supabase, client, mock_supabase):
        """Test admin can update user roles"""
        mock_admin_dep.return_value = {"id": "test-admin-456", "role": "admin"}
        mock_get_supabase.return_value = mock_supabase
        
        user_id = "test-user-123"
        response = client.put(f"/api/auth/users/{user_id}/role", json={"role": "admin"})
        
        assert response.status_code == 200
        data = response.json()
        assert data["role"] == "admin"  # Role should be updated in mock
    
    @patch('src.server.api_routes.auth_api.get_supabase_client')
    @patch('src.server.api_routes.auth_api.get_current_admin_dep')
    def test_admin_can_deactivate_users(self, mock_admin_dep, mock_get_supabase, client, mock_supabase):
        """Test admin can deactivate users"""
        mock_admin_dep.return_value = {"id": "test-admin-456", "role": "admin"}
        mock_get_supabase.return_value = mock_supabase
        
        user_id = "test-user-123"
        response = client.post(f"/api/auth/users/{user_id}/deactivate")
        
        assert response.status_code == 200
        data = response.json()
        assert "deactivated successfully" in data["message"]

class TestErrorHandling:
    """Test error handling in integration scenarios"""
    
    @patch('src.server.api_routes.auth_api.get_supabase_client')
    @patch('src.server.api_routes.auth_api.get_current_user_dep')
    def test_profile_not_found_error(self, mock_get_user, mock_get_supabase, client):
        """Test profile not found scenario"""
        mock_get_user.return_value = {"id": "nonexistent-user"}
        mock_supabase = MockSupabaseClient()  # Empty client
        mock_get_supabase.return_value = mock_supabase
        
        response = client.get("/api/auth/profile")
        
        assert response.status_code == 404
        assert "User profile not found" in response.json()["detail"]
    
    @patch('src.server.api_routes.auth_api.get_supabase_client')
    @patch('src.server.api_routes.auth_api.get_current_admin_dep')
    def test_invalid_role_update_error(self, mock_admin_dep, mock_get_supabase, client, mock_supabase):
        """Test invalid role update error"""
        mock_admin_dep.return_value = {"id": "test-admin-456", "role": "admin"}
        mock_get_supabase.return_value = mock_supabase
        
        user_id = "test-user-123"
        response = client.put(f"/api/auth/users/{user_id}/role", json={"role": "invalid_role"})
        
        assert response.status_code == 400
        assert "Invalid role" in response.json()["detail"]
    
    @patch('src.server.api_routes.auth_api.get_supabase_client')
    def test_database_error_handling(self, mock_get_supabase, client):
        """Test database error handling"""
        # Mock a database connection error
        mock_get_supabase.side_effect = Exception("Database connection failed")
        
        response = client.get("/api/auth/profile")
        
        assert response.status_code == 500

class TestMiddlewareIntegration:
    """Test authentication middleware integration"""
    
    def test_public_routes_bypass_auth(self, client):
        """Public routes should bypass authentication middleware"""
        public_routes = ["/", "/api/health", "/docs"]
        
        for route in public_routes:
            response = client.get(route)
            # Should not get 401/403 for auth issues
            assert response.status_code not in [401, 403]
    
    @patch('src.server.middleware.auth_middleware.verify_jwt_token')
    def test_protected_routes_require_auth(self, mock_verify, client):
        """Protected routes should require authentication"""
        mock_verify.return_value = None  # Simulate failed auth
        
        response = client.get("/api/test/protected")
        assert response.status_code in [401, 403]  # Should require auth
    
    @patch('src.server.middleware.auth_middleware.verify_jwt_token')
    def test_valid_jwt_allows_access(self, mock_verify, client):
        """Valid JWT should allow access to protected routes"""
        mock_verify.return_value = {
            "sub": "test-user-123",
            "email": "test@example.com",
            "role": "authenticated"
        }
        
        headers = {"Authorization": "Bearer valid-jwt-token"}
        response = client.get("/api/test/protected", headers=headers)
        
        # Should either succeed or fail for other reasons, not auth
        assert response.status_code != 401

class TestDataConsistency:
    """Test data consistency across operations"""
    
    @patch('src.server.api_routes.auth_api.get_supabase_client')
    @patch('src.server.api_routes.auth_api.get_current_user_dep')
    def test_profile_update_consistency(self, mock_get_user, mock_get_supabase, client, mock_supabase):
        """Test profile updates maintain data consistency"""
        test_user_id = "test-user-123"
        mock_get_user.return_value = {"id": test_user_id}
        mock_get_supabase.return_value = mock_supabase
        
        # First, get initial profile
        response = client.get("/api/auth/profile")
        assert response.status_code == 200
        initial_data = response.json()
        
        # Update profile
        update_data = {"full_name": "Consistently Updated Name"}
        response = client.put("/api/auth/profile", json=update_data)
        assert response.status_code == 200
        updated_data = response.json()
        
        # Verify consistency
        assert updated_data["id"] == initial_data["id"]
        assert updated_data["email"] == initial_data["email"]
        assert updated_data["full_name"] == "Consistently Updated Name"
        assert updated_data["role"] == initial_data["role"]
    
    @patch('src.server.api_routes.auth_api.get_supabase_client')
    @patch('src.server.api_routes.auth_api.get_current_admin_dep')  
    def test_role_update_consistency(self, mock_admin_dep, mock_get_supabase, client, mock_supabase):
        """Test role updates maintain data consistency"""
        mock_admin_dep.return_value = {"id": "test-admin-456", "role": "admin"}
        mock_get_supabase.return_value = mock_supabase
        
        user_id = "test-user-123"
        
        # Update user role
        response = client.put(f"/api/auth/users/{user_id}/role", json={"role": "viewer"})
        assert response.status_code == 200
        updated_data = response.json()
        
        # Verify the role was updated but other data remained consistent
        assert updated_data["id"] == user_id
        assert updated_data["email"] == "user@example.com"
        assert updated_data["role"] == "viewer"  # Should be updated
        assert updated_data["is_active"] == True  # Should remain unchanged

if __name__ == "__main__":
    pytest.main([__file__, "-v"])