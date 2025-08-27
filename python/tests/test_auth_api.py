"""
Comprehensive tests for Authentication API
Tests all auth endpoints, middleware, and user management functionality
"""

import pytest
import json
from uuid import uuid4
from unittest.mock import Mock, patch, AsyncMock
from fastapi.testclient import TestClient
from fastapi import FastAPI, HTTPException

# Import the auth components
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'src'))

from src.server.api_routes.auth_api import router as auth_router
from src.server.middleware.auth_middleware import AuthMiddleware

# Create test app
app = FastAPI()
app.include_router(auth_router)

@pytest.fixture
def client():
    """Create test client"""
    return TestClient(app)

@pytest.fixture
def mock_supabase_client():
    """Mock Supabase client with typical responses"""
    mock_client = Mock()
    mock_table = Mock()
    mock_rpc = Mock()
    
    # Setup table responses
    mock_client.table.return_value = mock_table
    mock_client.rpc.return_value = mock_rpc
    
    # Setup method chaining
    mock_table.select.return_value = mock_table
    mock_table.update.return_value = mock_table
    mock_table.eq.return_value = mock_table
    mock_table.order.return_value = mock_table
    
    return mock_client

@pytest.fixture
def sample_user_profile():
    """Sample user profile data"""
    return {
        "id": str(uuid4()),
        "email": "test@example.com",
        "full_name": "Test User",
        "avatar_url": "https://example.com/avatar.jpg",
        "role": "user",
        "is_active": True,
        "metadata": {"preferences": {}},
        "created_at": "2024-01-01T00:00:00Z",
        "updated_at": "2024-01-01T00:00:00Z"
    }

@pytest.fixture
def sample_admin_profile():
    """Sample admin profile data"""
    return {
        "id": str(uuid4()),
        "email": "admin@example.com", 
        "full_name": "Admin User",
        "avatar_url": None,
        "role": "admin",
        "is_active": True,
        "metadata": {},
        "created_at": "2024-01-01T00:00:00Z",
        "updated_at": "2024-01-01T00:00:00Z"
    }

class TestAuthMiddleware:
    """Test authentication middleware functionality"""
    
    def test_public_routes_accessible_without_auth(self):
        """Public routes should be accessible without authentication"""
        public_routes = {"/", "/health", "/api/health", "/docs", "/redoc", "/openapi.json"}
        
        middleware = AuthMiddleware(app)
        
        for route in public_routes:
            # These routes should be in PUBLIC_ROUTES
            assert route in AuthMiddleware.PUBLIC_ROUTES
    
    def test_admin_routes_require_admin_role(self):
        """Admin routes should require admin role"""
        admin_routes = {"/api/users/manage", "/api/admin"}
        
        for route in admin_routes:
            assert route in AuthMiddleware.ADMIN_ROUTES

class TestUserProfileEndpoints:
    """Test user profile management endpoints"""
    
    @patch('src.server.api_routes.auth_api.get_supabase_client')
    @patch('src.server.api_routes.auth_api.get_current_user_dep')
    def test_get_profile_success(self, mock_get_user, mock_supabase, client, mock_supabase_client, sample_user_profile):
        """Test successful profile retrieval"""
        # Mock dependencies
        mock_get_user.return_value = {"id": sample_user_profile["id"]}
        mock_supabase.return_value = mock_supabase_client
        
        # Mock database response
        mock_response = Mock()
        mock_response.data = [sample_user_profile]
        mock_supabase_client.table().select().eq().execute.return_value = mock_response
        
        response = client.get("/api/auth/profile")
        
        assert response.status_code == 200
        data = response.json()
        assert data["email"] == sample_user_profile["email"]
        assert data["role"] == sample_user_profile["role"]
    
    @patch('src.server.api_routes.auth_api.get_supabase_client')
    @patch('src.server.api_routes.auth_api.get_current_user_dep') 
    def test_get_profile_not_found(self, mock_get_user, mock_supabase, client, mock_supabase_client):
        """Test profile retrieval when user not found"""
        mock_get_user.return_value = {"id": str(uuid4())}
        mock_supabase.return_value = mock_supabase_client
        
        # Mock empty response
        mock_response = Mock()
        mock_response.data = []
        mock_supabase_client.table().select().eq().execute.return_value = mock_response
        
        response = client.get("/api/auth/profile")
        
        assert response.status_code == 404
        assert "User profile not found" in response.json()["detail"]
    
    @patch('src.server.api_routes.auth_api.get_supabase_client')
    @patch('src.server.api_routes.auth_api.get_current_user_dep')
    def test_update_profile_success(self, mock_get_user, mock_supabase, client, mock_supabase_client, sample_user_profile):
        """Test successful profile update"""
        mock_get_user.return_value = {"id": sample_user_profile["id"]}
        mock_supabase.return_value = mock_supabase_client
        
        # Mock successful update response
        updated_profile = sample_user_profile.copy()
        updated_profile["full_name"] = "Updated Name"
        
        mock_response = Mock()
        mock_response.data = [updated_profile]
        mock_supabase_client.table().update().eq().execute.return_value = mock_response
        
        update_data = {
            "full_name": "Updated Name",
            "avatar_url": "https://new-avatar.com/image.jpg"
        }
        
        response = client.put("/api/auth/profile", json=update_data)
        
        assert response.status_code == 200
        data = response.json()
        assert data["full_name"] == "Updated Name"
    
    @patch('src.server.api_routes.auth_api.get_supabase_client')
    @patch('src.server.api_routes.auth_api.get_current_user_dep')
    def test_update_profile_empty_data(self, mock_get_user, mock_supabase, client, mock_supabase_client):
        """Test profile update with no fields"""
        mock_get_user.return_value = {"id": str(uuid4())}
        mock_supabase.return_value = mock_supabase_client
        
        response = client.put("/api/auth/profile", json={})
        
        assert response.status_code == 400
        assert "No fields to update" in response.json()["detail"]

class TestUserStatsEndpoint:
    """Test user statistics endpoint"""
    
    @patch('src.server.api_routes.auth_api.get_supabase_client')
    @patch('src.server.api_routes.auth_api.get_current_user_dep')
    def test_get_user_stats_success(self, mock_get_user, mock_supabase, client, mock_supabase_client):
        """Test successful user stats retrieval"""
        user_id = str(uuid4())
        mock_get_user.return_value = {"id": user_id, "role": "admin"}
        mock_supabase.return_value = mock_supabase_client
        
        # Mock RPC response
        mock_response = Mock()
        mock_response.data = [{
            "sources_count": 5,
            "documents_count": 20,
            "projects_count": 3,
            "tasks_count": 15
        }]
        mock_supabase_client.rpc.return_value.execute.return_value = mock_response
        
        response = client.get(f"/api/auth/users/{user_id}/stats")
        
        assert response.status_code == 200
        data = response.json()
        assert data["sources_count"] == 5
        assert data["projects_count"] == 3

class TestAdminEndpoints:
    """Test admin-only endpoints"""
    
    @patch('src.server.api_routes.auth_api.get_supabase_client')
    @patch('src.server.api_routes.auth_api.get_current_admin_dep')
    def test_list_users_success(self, mock_admin_dep, mock_supabase, client, mock_supabase_client, sample_user_profile, sample_admin_profile):
        """Test admin can list all users"""
        mock_admin_dep.return_value = {"id": sample_admin_profile["id"], "role": "admin"}
        mock_supabase.return_value = mock_supabase_client
        
        # Mock response with multiple users
        mock_response = Mock()
        mock_response.data = [sample_admin_profile, sample_user_profile]
        mock_supabase_client.table().select().order().execute.return_value = mock_response
        
        response = client.get("/api/auth/users")
        
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 2
        assert data[0]["role"] == "admin"
        assert data[1]["role"] == "user"
    
    @patch('src.server.api_routes.auth_api.get_supabase_client')  
    @patch('src.server.api_routes.auth_api.get_current_admin_dep')
    def test_update_user_role_success(self, mock_admin_dep, mock_supabase, client, mock_supabase_client, sample_user_profile):
        """Test admin can update user role"""
        admin_id = str(uuid4())
        mock_admin_dep.return_value = {"id": admin_id, "role": "admin"}
        mock_supabase.return_value = mock_supabase_client
        
        # Mock RPC success response
        rpc_mock_response = Mock()
        rpc_mock_response.data = [{"success": True}]
        mock_supabase_client.rpc.return_value.execute.return_value = rpc_mock_response
        
        # Mock profile fetch response
        updated_profile = sample_user_profile.copy()
        updated_profile["role"] = "admin"
        
        profile_mock_response = Mock()
        profile_mock_response.data = [updated_profile]
        mock_supabase_client.table().select().eq().execute.return_value = profile_mock_response
        
        user_id = sample_user_profile["id"]
        response = client.put(f"/api/auth/users/{user_id}/role", json={"role": "admin"})
        
        assert response.status_code == 200
        data = response.json()
        assert data["role"] == "admin"
    
    @patch('src.server.api_routes.auth_api.get_supabase_client')
    @patch('src.server.api_routes.auth_api.get_current_admin_dep')
    def test_update_user_role_invalid(self, mock_admin_dep, mock_supabase, client, mock_supabase_client):
        """Test update user role with invalid role"""
        admin_id = str(uuid4())
        mock_admin_dep.return_value = {"id": admin_id, "role": "admin"}
        mock_supabase.return_value = mock_supabase_client
        
        user_id = str(uuid4())
        response = client.put(f"/api/auth/users/{user_id}/role", json={"role": "invalid_role"})
        
        assert response.status_code == 400
        assert "Invalid role" in response.json()["detail"]
    
    @patch('src.server.api_routes.auth_api.get_supabase_client')
    @patch('src.server.api_routes.auth_api.get_current_admin_dep')
    def test_deactivate_user_success(self, mock_admin_dep, mock_supabase, client, mock_supabase_client):
        """Test admin can deactivate user"""
        admin_id = str(uuid4())
        mock_admin_dep.return_value = {"id": admin_id, "role": "admin"}
        mock_supabase.return_value = mock_supabase_client
        
        # Mock RPC success response
        mock_response = Mock()
        mock_response.data = [{"success": True}]
        mock_supabase_client.rpc.return_value.execute.return_value = mock_response
        
        user_id = str(uuid4())
        response = client.post(f"/api/auth/users/{user_id}/deactivate")
        
        assert response.status_code == 200
        data = response.json()
        assert "deactivated successfully" in data["message"]

class TestRegistrationEndpoint:
    """Test user registration endpoint"""
    
    @patch('src.server.api_routes.auth_api.get_supabase_client')
    def test_register_placeholder_response(self, mock_supabase, client, mock_supabase_client):
        """Test registration placeholder (until Supabase Auth integration)"""
        mock_supabase.return_value = mock_supabase_client
        
        registration_data = {
            "email": "newuser@example.com",
            "password": "securepassword123",
            "full_name": "New User"
        }
        
        response = client.post("/api/auth/register", json=registration_data)
        
        # For now, this should return a placeholder response
        assert response.status_code == 501  # Not implemented yet
        assert "placeholder" in response.json()["detail"].lower()

class TestErrorHandling:
    """Test error handling scenarios"""
    
    @patch('src.server.api_routes.auth_api.get_supabase_client')
    @patch('src.server.api_routes.auth_api.get_current_user_dep')
    def test_database_error_handling(self, mock_get_user, mock_supabase, client, mock_supabase_client):
        """Test handling of database errors"""
        mock_get_user.return_value = {"id": str(uuid4())}
        mock_supabase.return_value = mock_supabase_client
        
        # Mock database exception
        mock_supabase_client.table().select().eq().execute.side_effect = Exception("Database connection failed")
        
        response = client.get("/api/auth/profile")
        
        assert response.status_code == 500
        assert "Internal server error" in response.json()["detail"]

if __name__ == "__main__":
    pytest.main([__file__, "-v"])