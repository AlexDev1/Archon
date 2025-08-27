"""
Authentication and User Management API endpoints
"""

import logging
from typing import Dict, Any, List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, EmailStr, Field

from ..middleware.auth_middleware import get_current_user_dep, get_current_admin_dep, get_optional_user_dep
from ..config.logfire_config import get_logger
from ..utils import get_supabase_client

logger = get_logger("auth_api")
router = APIRouter(prefix="/api/auth", tags=["authentication"])

# =====================================================
# HEALTH ENDPOINT
# =====================================================

@router.get("/health")
async def auth_health():
    """Authentication service health check."""
    return {
        "status": "healthy",
        "service": "auth-api",
        "message": "Authentication service is running"
    }

# =====================================================
# PYDANTIC MODELS FOR API
# =====================================================

class UserProfile(BaseModel):
    """User profile response model."""
    id: str
    email: str
    full_name: Optional[str] = None
    avatar_url: Optional[str] = None
    role: str
    is_active: bool
    metadata: Dict[str, Any] = Field(default_factory=dict)
    created_at: str
    updated_at: str

class UserRegistrationRequest(BaseModel):
    """User registration request model."""
    email: EmailStr
    password: str = Field(..., min_length=8, description="Password must be at least 8 characters")
    full_name: Optional[str] = None

class UserLoginRequest(BaseModel):
    """User login request model."""
    email: EmailStr
    password: str

class AuthResponse(BaseModel):
    """Authentication response model."""
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int
    user: UserProfile

class UpdateUserRequest(BaseModel):
    """Update user profile request."""
    full_name: Optional[str] = None
    avatar_url: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None

class UpdateUserRoleRequest(BaseModel):
    """Update user role request (admin only)."""
    role: str = Field(..., description="New role: admin, user, viewer, or guest")

class UserStatsResponse(BaseModel):
    """User statistics response."""
    user_id: str
    sources_count: int
    pages_count: int
    code_examples_count: int
    projects_count: int
    tasks_owned_count: int
    tasks_assigned_count: int
    prompts_count: int

# =====================================================
# AUTHENTICATION ENDPOINTS
# =====================================================

@router.post("/register", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
async def register_user(
    registration_data: UserRegistrationRequest,
    request: Request
):
    """
    Register a new user account.
    
    Creates a new user in Supabase Auth and corresponding profile.
    First user becomes admin, subsequent users are regular users.
    """
    try:
        supabase_client = get_supabase_client()
        
        # Note: In a real implementation, you would call Supabase Auth API
        # to create the user account. For now, this is a placeholder.
        
        # This is where you would:
        # 1. Call supabase.auth.sign_up(email, password)
        # 2. Handle the response and extract user data
        # 3. The database trigger will automatically create the user profile
        
        logger.info(f"User registration attempted for email: {registration_data.email}")
        
        # Placeholder response - replace with actual Supabase integration
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail="User registration requires Supabase Auth client integration"
        )
        
    except Exception as e:
        logger.error(f"Registration failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Registration failed"
        )

@router.post("/login", response_model=AuthResponse)
async def login_user(
    login_data: UserLoginRequest,
    request: Request
):
    """
    Login user and return JWT tokens.
    
    Authenticates user against Supabase Auth and returns access/refresh tokens.
    """
    try:
        # Note: In a real implementation, you would call Supabase Auth API
        # This is where you would:
        # 1. Call supabase.auth.sign_in_with_password(email, password)
        # 2. Handle the response and extract tokens
        # 3. Return the authentication response
        
        logger.info(f"User login attempted for email: {login_data.email}")
        
        # Placeholder response - replace with actual Supabase integration
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail="User login requires Supabase Auth client integration"
        )
        
    except Exception as e:
        logger.error(f"Login failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Login failed"
        )

@router.post("/refresh")
async def refresh_token(
    request: Request,
    # You would typically get refresh token from request body or cookies
):
    """
    Refresh access token using refresh token.
    """
    try:
        # Note: This would call Supabase Auth to refresh the token
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail="Token refresh requires Supabase Auth client integration"
        )
        
    except Exception as e:
        logger.error(f"Token refresh failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Token refresh failed"
        )

@router.post("/logout")
async def logout_user(
    request: Request,
    current_user: Dict[str, Any] = Depends(get_current_user_dep)
):
    """
    Logout user and invalidate tokens.
    """
    try:
        # Note: This would call Supabase Auth to sign out
        logger.info(f"User logout: {current_user.get('id')}")
        
        return {"message": "Logged out successfully"}
        
    except Exception as e:
        logger.error(f"Logout failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Logout failed"
        )

# =====================================================
# USER PROFILE ENDPOINTS
# =====================================================

@router.get("/profile", response_model=UserProfile)
async def get_user_profile(
    current_user: Dict[str, Any] = Depends(get_current_user_dep)
):
    """Get current user's profile."""
    try:
        supabase_client = get_supabase_client()
        
        # Fetch user profile from database
        response = supabase_client.table("user_profiles").select("*").eq("id", current_user["id"]).execute()
        
        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User profile not found"
            )
        
        result = response.data[0]
        return UserProfile(
            id=str(result["id"]),
            email=result["email"],
            full_name=result["full_name"],
            avatar_url=result["avatar_url"],
            role=result["role"],
            is_active=result["is_active"],
            metadata=result["metadata"] or {},
            created_at=result["created_at"],
            updated_at=result["updated_at"]
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get user profile: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve user profile"
        )

@router.put("/profile", response_model=UserProfile)
async def update_user_profile(
    update_data: UpdateUserRequest,
    current_user: Dict[str, Any] = Depends(get_current_user_dep)
):
    """Update current user's profile."""
    try:
        supabase_client = get_supabase_client()
        
        # Build update data
        update_data_dict = {}
        
        if update_data.full_name is not None:
            update_data_dict["full_name"] = update_data.full_name
            
        if update_data.avatar_url is not None:
            update_data_dict["avatar_url"] = update_data.avatar_url
            
        if update_data.metadata is not None:
            update_data_dict["metadata"] = update_data.metadata
        
        if not update_data_dict:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No fields to update"
            )
        
        # Add updated_at timestamp
        update_data_dict["updated_at"] = "now()"
        
        response = supabase_client.table("user_profiles").update(update_data_dict).eq("id", current_user["id"]).execute()
        
        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User profile not found"
            )
        
        result = response.data[0]
        return UserProfile(
            id=str(result["id"]),
            email=result["email"],
            full_name=result["full_name"],
            avatar_url=result["avatar_url"],
            role=result["role"],
            is_active=result["is_active"],
            metadata=result["metadata"] or {},
            created_at=result["created_at"],
            updated_at=result["updated_at"]
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to update user profile: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update user profile"
        )

@router.get("/stats", response_model=UserStatsResponse)
async def get_user_stats(
    user_id: Optional[str] = None,
    current_user: Dict[str, Any] = Depends(get_current_user_dep)
):
    """
    Get user statistics.
    
    Regular users can only view their own stats.
    Admins can view any user's stats.
    """
    try:
        supabase_client = get_supabase_client()
        
        # Determine which user's stats to get
        target_user_id = user_id or current_user["id"]
        
        # Check permissions
        if target_user_id != current_user["id"] and current_user.get("role") != "admin":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Permission denied: Cannot view other users' statistics"
            )
        
        # Call database function to get stats
        response = supabase_client.rpc("get_user_data_stats", {"user_id": target_user_id}).execute()
        
        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User statistics not found"
            )
        
        stats = response.data[0] if isinstance(response.data, list) else response.data
        return UserStatsResponse(**stats)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get user stats: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve user statistics"
        )

# =====================================================
# USER MANAGEMENT ENDPOINTS (ADMIN ONLY)
# =====================================================

@router.get("/users", response_model=List[UserProfile])
async def list_users(
    current_user: Dict[str, Any] = Depends(get_current_admin_dep)
):
    """List all users (admin only)."""
    try:
        supabase_client = get_supabase_client()
        
        response = supabase_client.table("user_profiles").select("*").order("created_at", desc=True).execute()
        
        return [
            UserProfile(
                id=str(result["id"]),
                email=result["email"],
                full_name=result["full_name"],
                avatar_url=result["avatar_url"],
                role=result["role"],
                is_active=result["is_active"],
                metadata=result["metadata"] or {},
                created_at=result["created_at"],
                updated_at=result["updated_at"]
            )
            for result in response.data
        ]
        
    except Exception as e:
        logger.error(f"Failed to list users: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve users list"
        )

@router.put("/users/{user_id}/role", response_model=UserProfile)
async def update_user_role(
    user_id: str,
    role_data: UpdateUserRoleRequest,
    current_user: Dict[str, Any] = Depends(get_current_admin_dep)
):
    """Update user role (admin only)."""
    try:
        supabase_client = get_supabase_client()
        
        # Validate role
        valid_roles = {"admin", "user", "viewer", "guest"}
        if role_data.role not in valid_roles:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid role. Must be one of: {', '.join(valid_roles)}"
            )
        
        # Use the database function to safely update role
        response = supabase_client.rpc("update_user_role", {"target_user_id": user_id, "new_role": role_data.role}).execute()
        
        if not response.data or not response.data[0]["success"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Failed to update user role"
            )
        
        # Fetch updated user profile
        profile_response = supabase_client.table("user_profiles").select("*").eq("id", user_id).execute()
        
        if not profile_response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found after role update"
            )
        
        profile_result = profile_response.data[0]
        
        logger.info(f"User role updated: {user_id} -> {role_data.role} by {current_user['id']}")
        
        return UserProfile(
            id=str(profile_result["id"]),
            email=profile_result["email"],
            full_name=profile_result["full_name"],
            avatar_url=profile_result["avatar_url"],
            role=profile_result["role"],
            is_active=profile_result["is_active"],
            metadata=profile_result["metadata"] or {},
            created_at=profile_result["created_at"].isoformat(),
            updated_at=profile_result["updated_at"].isoformat()
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to update user role: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update user role"
        )

@router.put("/users/{user_id}/deactivate")
async def deactivate_user(
    user_id: str,
    current_user: Dict[str, Any] = Depends(get_current_admin_dep)
):
    """Deactivate user account (admin only)."""
    try:
        supabase_client = get_supabase_client()
        
        # Use the database function to safely deactivate user
        response = supabase_client.rpc("deactivate_user", {"target_user_id": user_id}).execute()
        
        if not response.data or not response.data[0]["success"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Failed to deactivate user"
            )
        
        logger.info(f"User deactivated: {user_id} by {current_user['id']}")
        return {"message": "User deactivated successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to deactivate user: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to deactivate user"
        )

@router.post("/users/{from_user_id}/transfer/{to_user_id}")
async def transfer_user_data(
    from_user_id: str,
    to_user_id: str,
    current_user: Dict[str, Any] = Depends(get_current_admin_dep)
):
    """Transfer all data from one user to another (admin only)."""
    try:
        supabase_client = get_supabase_client()
        
        # Use the database function to safely transfer data
        response = supabase_client.rpc("transfer_user_data", {"from_user_id": from_user_id, "to_user_id": to_user_id}).execute()
        
        if not response.data or not response.data[0]["success"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Failed to transfer user data"
            )
        
        logger.info(f"User data transferred: {from_user_id} -> {to_user_id} by {current_user['id']}")
        return {"message": "User data transferred successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to transfer user data: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to transfer user data"
        )