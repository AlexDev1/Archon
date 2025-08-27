-- =====================================================
-- Archon Multi-User Authentication Migration
-- =====================================================
-- This migration adds support for multi-user authentication
-- using Supabase Auth with role-based access control
-- =====================================================

-- =====================================================
-- SECTION 1: USER PROFILES TABLE
-- =====================================================

-- Create user profiles table that extends Supabase auth.users
CREATE TABLE IF NOT EXISTS user_profiles (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    full_name TEXT,
    avatar_url TEXT,
    role TEXT DEFAULT 'user' CHECK (role IN ('admin', 'user', 'viewer', 'guest')),
    is_active BOOLEAN DEFAULT true,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_user_profiles_email ON user_profiles(email);
CREATE INDEX IF NOT EXISTS idx_user_profiles_role ON user_profiles(role);
CREATE INDEX IF NOT EXISTS idx_user_profiles_is_active ON user_profiles(is_active);

-- Create trigger to automatically update updated_at timestamp
CREATE TRIGGER update_user_profiles_updated_at
    BEFORE UPDATE ON user_profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Add comments to document the table
COMMENT ON TABLE user_profiles IS 'User profiles extending Supabase auth.users with role-based access control';
COMMENT ON COLUMN user_profiles.role IS 'User role: admin (full access), user (personal workspace), viewer (read-only), guest (limited public access)';
COMMENT ON COLUMN user_profiles.is_active IS 'Whether the user account is active and can access the system';
COMMENT ON COLUMN user_profiles.metadata IS 'Additional user metadata like preferences, settings, etc.';

-- =====================================================
-- SECTION 2: RLS POLICIES FOR USER PROFILES
-- =====================================================

-- Enable RLS on user profiles
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- Allow service role full access
CREATE POLICY "Allow service role full access" ON user_profiles
    FOR ALL USING (auth.role() = 'service_role');

-- Users can read their own profile
CREATE POLICY "Users can view own profile" ON user_profiles
    FOR SELECT 
    USING (auth.uid() = id);

-- Users can update their own profile (except role)
CREATE POLICY "Users can update own profile" ON user_profiles
    FOR UPDATE 
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id AND role = (SELECT role FROM user_profiles WHERE id = auth.uid()));

-- Admins can read all profiles
CREATE POLICY "Admins can view all profiles" ON user_profiles
    FOR SELECT 
    USING (
        EXISTS (
            SELECT 1 FROM user_profiles 
            WHERE id = auth.uid() AND role = 'admin' AND is_active = true
        )
    );

-- Admins can update all profiles
CREATE POLICY "Admins can update all profiles" ON user_profiles
    FOR UPDATE 
    USING (
        EXISTS (
            SELECT 1 FROM user_profiles 
            WHERE id = auth.uid() AND role = 'admin' AND is_active = true
        )
    );

-- =====================================================
-- SECTION 3: TRIGGER FOR AUTO-CREATING USER PROFILES
-- =====================================================

-- Function to automatically create user profile when user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
    INSERT INTO public.user_profiles (id, email, full_name, avatar_url, role)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
        COALESCE(NEW.raw_user_meta_data->>'avatar_url', ''),
        -- First user becomes admin, subsequent users are regular users
        CASE 
            WHEN (SELECT COUNT(*) FROM public.user_profiles) = 0 THEN 'admin'
            ELSE 'user'
        END
    );
    RETURN NEW;
END;
$$;

-- Create trigger on auth.users table to auto-create profiles
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =====================================================
-- SECTION 4: UTILITY FUNCTIONS
-- =====================================================

-- Function to check if current user has specific role
CREATE OR REPLACE FUNCTION public.has_role(required_role TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM user_profiles 
        WHERE id = auth.uid() 
        AND role = required_role 
        AND is_active = true
    );
END;
$$;

-- Function to check if current user has admin privileges
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN public.has_role('admin');
END;
$$;

-- Function to get current user's role
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN (
        SELECT role FROM user_profiles 
        WHERE id = auth.uid() 
        AND is_active = true
    );
END;
$$;

-- =====================================================
-- SECTION 5: ROLE MANAGEMENT FUNCTIONS (ADMIN ONLY)
-- =====================================================

-- Function to update user role (admin only)
CREATE OR REPLACE FUNCTION public.update_user_role(
    target_user_id UUID,
    new_role TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Check if current user is admin
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Only administrators can update user roles';
    END IF;
    
    -- Validate role
    IF new_role NOT IN ('admin', 'user', 'viewer', 'guest') THEN
        RAISE EXCEPTION 'Invalid role: %. Must be admin, user, viewer, or guest', new_role;
    END IF;
    
    -- Prevent removing the last admin
    IF new_role != 'admin' AND (
        SELECT COUNT(*) FROM user_profiles 
        WHERE role = 'admin' AND is_active = true
    ) = 1 AND (
        SELECT role FROM user_profiles 
        WHERE id = target_user_id
    ) = 'admin' THEN
        RAISE EXCEPTION 'Cannot remove the last administrator';
    END IF;
    
    -- Update the role
    UPDATE user_profiles 
    SET role = new_role, updated_at = NOW()
    WHERE id = target_user_id;
    
    RETURN FOUND;
END;
$$;

-- Function to deactivate user (admin only)
CREATE OR REPLACE FUNCTION public.deactivate_user(target_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Check if current user is admin
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Only administrators can deactivate users';
    END IF;
    
    -- Prevent deactivating the last admin
    IF (
        SELECT COUNT(*) FROM user_profiles 
        WHERE role = 'admin' AND is_active = true
    ) = 1 AND (
        SELECT role FROM user_profiles 
        WHERE id = target_user_id AND is_active = true
    ) = 'admin' THEN
        RAISE EXCEPTION 'Cannot deactivate the last administrator';
    END IF;
    
    -- Deactivate the user
    UPDATE user_profiles 
    SET is_active = false, updated_at = NOW()
    WHERE id = target_user_id;
    
    RETURN FOUND;
END;
$$;

-- =====================================================
-- SECTION 6: INSERT DEFAULT ADMIN (OPTIONAL)
-- =====================================================

-- This section can be used to create a default admin user
-- Uncomment and modify the email if needed

/*
-- Create default admin user if no users exist
-- DO $$
-- BEGIN
--     IF NOT EXISTS (SELECT 1 FROM user_profiles) THEN
--         -- Note: This only creates a profile. The actual auth user must be created through Supabase Auth
--         INSERT INTO user_profiles (id, email, full_name, role) VALUES (
--             gen_random_uuid(),
--             'admin@archon.local',
--             'System Administrator',
--             'admin'
--         );
--         
--         RAISE NOTICE 'Default admin profile created. Email: admin@archon.local';
--         RAISE NOTICE 'Please create the corresponding auth user through Supabase dashboard or signup flow.';
--     END IF;
-- END;
-- $$;
*/

-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================

-- Log migration completion
INSERT INTO archon_settings (key, value, is_encrypted, category, description) VALUES
('MULTI_USER_AUTH_ENABLED', 'true', false, 'features', 'Enable multi-user authentication and role-based access control')
ON CONFLICT (key) DO UPDATE SET
    value = EXCLUDED.value,
    updated_at = NOW();

COMMENT ON SCHEMA public IS 'Archon multi-user authentication migration completed';