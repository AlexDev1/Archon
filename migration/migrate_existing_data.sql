-- =====================================================
-- Migrate Existing Data for Multi-User System
-- =====================================================
-- This migration handles existing data in single-user setup
-- and prepares it for multi-user environment
-- =====================================================

-- =====================================================
-- SECTION 1: BACKUP AND SAFETY CHECKS
-- =====================================================

-- Create backup tables before migration
DO $backup$
BEGIN
    -- Backup sources
    IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'archon_sources_backup') THEN
        CREATE TABLE archon_sources_backup AS SELECT * FROM archon_sources;
        RAISE NOTICE 'Created backup: archon_sources_backup';
    END IF;
    
    -- Backup projects if table exists
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'archon_projects') THEN
        IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'archon_projects_backup') THEN
            CREATE TABLE archon_projects_backup AS SELECT * FROM archon_projects;
            RAISE NOTICE 'Created backup: archon_projects_backup';
        END IF;
    END IF;
END;
$backup$;

-- =====================================================
-- SECTION 2: CREATE DEFAULT SYSTEM USER IF NEEDED
-- =====================================================

-- Function to create default system user for existing data
CREATE OR REPLACE FUNCTION create_system_user_for_migration()
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $create_user$
DECLARE
    system_user_id UUID;
    user_count INTEGER;
BEGIN
    -- Check if we have any existing user profiles
    SELECT COUNT(*) INTO user_count FROM user_profiles;
    
    IF user_count = 0 THEN
        -- Check if system user already exists in auth.users
        SELECT id INTO system_user_id 
        FROM auth.users 
        WHERE email = 'system@archon.local' 
        LIMIT 1;
        
        IF system_user_id IS NULL THEN
            -- No system user exists, create a new one
            system_user_id := gen_random_uuid();
            
            -- First, create the user in auth.users (Supabase Auth table)
            INSERT INTO auth.users (
                id,
                email,
                encrypted_password,
                email_confirmed_at,
                created_at,
                updated_at,
                role,
                aud
            ) VALUES (
                system_user_id,
                'system@archon.local',
                crypt('migration-system-password-' || system_user_id::text, gen_salt('bf')),
                NOW(),
                NOW(),
                NOW(),
                'authenticated',
                'authenticated'
            );
            
            RAISE NOTICE 'Created system user in auth.users: %', system_user_id;
        ELSE
            RAISE NOTICE 'System user already exists in auth.users: %', system_user_id;
        END IF;
        
        -- Check if user profile exists, create if not
        IF NOT EXISTS (SELECT 1 FROM user_profiles WHERE id = system_user_id) THEN
            -- Create the user profile
            INSERT INTO user_profiles (
                id, 
                email, 
                full_name, 
                role, 
                is_active,
                metadata
            ) VALUES (
                system_user_id,
                'system@archon.local',
                'System Administrator (Migration)',
                'admin',
                true,
                jsonb_build_object(
                    'created_by', 'migration',
                    'migration_date', NOW()::text,
                    'note', 'Default admin user created during multi-user migration',
                    'password_info', 'Password is migration-system-password-' || system_user_id::text
                )
            );
            
            RAISE NOTICE 'Created user profile for: %', system_user_id;
        ELSE
            RAISE NOTICE 'User profile already exists for: %', system_user_id;
        END IF;
        
        RAISE NOTICE 'Created default system user: %', system_user_id;
        RAISE NOTICE 'Email: system@archon.local';
        RAISE NOTICE 'Password: migration-system-password-%', system_user_id::text;
        RAISE NOTICE 'Role: admin';
        RAISE NOTICE 'IMPORTANT: Change password after first login!';
        RAISE NOTICE 'Please create real user accounts and transfer ownership of this data.';
        
    ELSE
        -- Users exist, try to find or create system admin
        SELECT id INTO system_user_id 
        FROM user_profiles 
        WHERE email = 'system@archon.local' AND role = 'admin'
        LIMIT 1;
        
        IF system_user_id IS NULL THEN
            -- No system admin exists, get the first admin user
            SELECT id INTO system_user_id 
            FROM user_profiles 
            WHERE role = 'admin' 
            ORDER BY created_at ASC 
            LIMIT 1;
            
            -- If no admin exists, get the first user and make them admin
            IF system_user_id IS NULL THEN
                SELECT id INTO system_user_id 
                FROM user_profiles 
                ORDER BY created_at ASC 
                LIMIT 1;
                
                UPDATE user_profiles 
                SET role = 'admin' 
                WHERE id = system_user_id;
                
                RAISE NOTICE 'Made first user admin for migration: %', system_user_id;
            ELSE
                RAISE NOTICE 'Using existing admin user for migration: %', system_user_id;
            END IF;
        ELSE
            RAISE NOTICE 'Using existing system admin user for migration: %', system_user_id;
        END IF;
    END IF;
    
    RETURN system_user_id;
END;
$create_user$;

-- =====================================================
-- SECTION 3: MIGRATE EXISTING DATA
-- =====================================================

DO $migrate$
DECLARE
    system_user_id UUID;
    sources_updated INTEGER := 0;
    pages_updated INTEGER := 0;
    projects_updated INTEGER := 0;
    tasks_updated INTEGER := 0;
    code_examples_updated INTEGER := 0;
BEGIN
    -- Get or create system user for migration
    system_user_id := create_system_user_for_migration();
    
    RAISE NOTICE 'Starting data migration with user_id: %', system_user_id;
    
    -- Migrate sources (only those without user_id)
    UPDATE archon_sources 
    SET user_id = system_user_id 
    WHERE user_id IS NULL;
    
    GET DIAGNOSTICS sources_updated = ROW_COUNT;
    RAISE NOTICE 'Updated % sources with user_id', sources_updated;
    
    -- Migrate crawled pages (inherit from sources or set directly)
    UPDATE archon_crawled_pages 
    SET user_id = COALESCE(
        (SELECT user_id FROM archon_sources WHERE source_id = archon_crawled_pages.source_id),
        system_user_id
    )
    WHERE user_id IS NULL;
    
    GET DIAGNOSTICS pages_updated = ROW_COUNT;
    RAISE NOTICE 'Updated % crawled pages with user_id', pages_updated;
    
    -- Migrate code examples
    UPDATE archon_code_examples 
    SET user_id = system_user_id 
    WHERE user_id IS NULL;
    
    GET DIAGNOSTICS code_examples_updated = ROW_COUNT;
    RAISE NOTICE 'Updated % code examples with user_id', code_examples_updated;
    
    -- Migrate projects (if table exists)
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'archon_projects') THEN
        UPDATE archon_projects 
        SET user_id = system_user_id 
        WHERE user_id IS NULL;
        
        GET DIAGNOSTICS projects_updated = ROW_COUNT;
        RAISE NOTICE 'Updated % projects with user_id', projects_updated;
        
        -- Migrate tasks (if table exists)
        IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'archon_tasks') THEN
            UPDATE archon_tasks 
            SET user_id = system_user_id 
            WHERE user_id IS NULL;
            
            GET DIAGNOSTICS tasks_updated = ROW_COUNT;
            RAISE NOTICE 'Updated % tasks with user_id', tasks_updated;
        END IF;
        
        -- Migrate project_sources (if table exists)
        IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'archon_project_sources') THEN
            UPDATE archon_project_sources 
            SET user_id = system_user_id 
            WHERE user_id IS NULL;
            
            RAISE NOTICE 'Updated project_sources with user_id';
        END IF;
        
        -- Migrate document_versions (if table exists)
        IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'archon_document_versions') THEN
            UPDATE archon_document_versions 
            SET user_id = system_user_id 
            WHERE user_id IS NULL;
            
            RAISE NOTICE 'Updated document_versions with user_id';
        END IF;
    END IF;
    
    -- Migrate prompts (if table exists)
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'archon_prompts') THEN
        UPDATE archon_prompts 
        SET user_id = system_user_id 
        WHERE user_id IS NULL;
        
        RAISE NOTICE 'Updated prompts with user_id';
    END IF;
    
    RAISE NOTICE 'Migration Summary:';
    RAISE NOTICE '- Sources migrated: %', sources_updated;
    RAISE NOTICE '- Pages migrated: %', pages_updated;
    RAISE NOTICE '- Code examples migrated: %', code_examples_updated;
    RAISE NOTICE '- Projects migrated: %', projects_updated;
    RAISE NOTICE '- Tasks migrated: %', tasks_updated;
    RAISE NOTICE '- All data assigned to user: %', system_user_id;
END;
$migrate$;

-- =====================================================
-- SECTION 4: VALIDATION AND CLEANUP
-- =====================================================

-- Function to validate migration completeness
CREATE OR REPLACE FUNCTION validate_migration()
RETURNS TABLE(
    table_name TEXT,
    total_records BIGINT,
    records_with_user_id BIGINT,
    records_without_user_id BIGINT,
    migration_complete BOOLEAN
)
LANGUAGE plpgsql
AS $validate$
BEGIN
    -- Check archon_sources
    RETURN QUERY
    SELECT 
        'archon_sources'::TEXT,
        COUNT(*)::BIGINT,
        COUNT(user_id)::BIGINT,
        COUNT(*) - COUNT(user_id)::BIGINT,
        (COUNT(*) = COUNT(user_id))::BOOLEAN
    FROM archon_sources;
    
    -- Check archon_crawled_pages
    RETURN QUERY
    SELECT 
        'archon_crawled_pages'::TEXT,
        COUNT(*)::BIGINT,
        COUNT(user_id)::BIGINT,
        COUNT(*) - COUNT(user_id)::BIGINT,
        (COUNT(*) = COUNT(user_id))::BOOLEAN
    FROM archon_crawled_pages;
    
    -- Check archon_code_examples
    RETURN QUERY
    SELECT 
        'archon_code_examples'::TEXT,
        COUNT(*)::BIGINT,
        COUNT(user_id)::BIGINT,
        COUNT(*) - COUNT(user_id)::BIGINT,
        (COUNT(*) = COUNT(user_id))::BOOLEAN
    FROM archon_code_examples;
    
    -- Check archon_projects if exists
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'archon_projects') THEN
        RETURN QUERY
        SELECT 
            'archon_projects'::TEXT,
            COUNT(*)::BIGINT,
            COUNT(user_id)::BIGINT,
            COUNT(*) - COUNT(user_id)::BIGINT,
            (COUNT(*) = COUNT(user_id))::BOOLEAN
        FROM archon_projects;
        
        -- Check archon_tasks if exists
        IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'archon_tasks') THEN
            RETURN QUERY
            SELECT 
                'archon_tasks'::TEXT,
                COUNT(*)::BIGINT,
                COUNT(user_id)::BIGINT,
                COUNT(*) - COUNT(user_id)::BIGINT,
                (COUNT(*) = COUNT(user_id))::BOOLEAN
            FROM archon_tasks;
        END IF;
    END IF;
END;
$validate$;

-- Run validation
SELECT * FROM validate_migration();

-- =====================================================
-- SECTION 5: POST-MIGRATION SETUP
-- =====================================================

-- Function to set up default permissions for migrated data
CREATE OR REPLACE FUNCTION setup_post_migration_permissions()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $setup_rls$
BEGIN
    -- Ensure RLS is enabled on all tables
    ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
    ALTER TABLE archon_sources ENABLE ROW LEVEL SECURITY;
    ALTER TABLE archon_crawled_pages ENABLE ROW LEVEL SECURITY;
    ALTER TABLE archon_code_examples ENABLE ROW LEVEL SECURITY;
    
    -- Enable RLS on project tables if they exist
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'archon_projects') THEN
        ALTER TABLE archon_projects ENABLE ROW LEVEL SECURITY;
        ALTER TABLE archon_tasks ENABLE ROW LEVEL SECURITY;
        ALTER TABLE archon_project_sources ENABLE ROW LEVEL SECURITY;
        ALTER TABLE archon_document_versions ENABLE ROW LEVEL SECURITY;
    END IF;
    
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'archon_prompts') THEN
        ALTER TABLE archon_prompts ENABLE ROW LEVEL SECURITY;
    END IF;
    
    RAISE NOTICE 'Row Level Security enabled on all tables';
END;
$setup_rls$;

-- Run post-migration setup
SELECT setup_post_migration_permissions();

-- =====================================================
-- SECTION 6: MIGRATION COMPLETION
-- =====================================================

-- Log migration completion
INSERT INTO archon_settings (key, value, is_encrypted, category, description) VALUES
('MIGRATION_TO_MULTIUSER_COMPLETED', NOW()::TEXT, false, 'system', 'Timestamp when single-user to multi-user migration was completed'),
('MIGRATION_SYSTEM_USER_CREATED', 'true', false, 'system', 'Whether a default system user was created during migration')
ON CONFLICT (key) DO UPDATE SET
    value = EXCLUDED.value,
    updated_at = NOW();

-- Create migration report
CREATE OR REPLACE FUNCTION generate_migration_report()
RETURNS TEXT
LANGUAGE plpgsql
AS $report$
DECLARE
    report TEXT := '';
    user_count INTEGER;
    admin_count INTEGER;
    system_user_email TEXT;
BEGIN
    -- Get user statistics
    SELECT COUNT(*) INTO user_count FROM user_profiles;
    SELECT COUNT(*) INTO admin_count FROM user_profiles WHERE role = 'admin';
    
    -- Get system user email if it exists
    SELECT email INTO system_user_email 
    FROM user_profiles 
    WHERE email LIKE '%@archon.local' 
    ORDER BY created_at ASC 
    LIMIT 1;
    
    report := E'ARCHON MULTI-USER MIGRATION REPORT\n';
    report := report || E'=====================================\n\n';
    report := report || E'Migration completed at: ' || NOW()::TEXT || E'\n';
    report := report || E'Total users: ' || user_count::TEXT || E'\n';
    report := report || E'Admin users: ' || admin_count::TEXT || E'\n';
    
    IF system_user_email IS NOT NULL THEN
        report := report || E'System user created: ' || system_user_email || E'\n\n';
        report := report || E'IMPORTANT NEXT STEPS:\n';
        report := report || E'1. Create real user accounts via /register endpoint\n';
        report := report || E'2. Transfer ownership of system data to real users\n';
        report := report || E'3. Optionally deactivate or delete the system user\n';
        report := report || E'4. Test authentication and authorization\n\n';
    END IF;
    
    report := report || E'All existing data has been assigned user ownership.\n';
    report := report || E'Multi-user authentication is now active.\n';
    
    RETURN report;
END;
$report$;

-- Display migration report
SELECT generate_migration_report();

-- =====================================================
-- CLEANUP FUNCTIONS
-- =====================================================

-- Function to clean up migration artifacts (run manually if desired)
CREATE OR REPLACE FUNCTION cleanup_migration_artifacts()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $cleanup$
BEGIN
    -- Drop backup tables (uncomment when ready)
    -- DROP TABLE IF EXISTS archon_sources_backup;
    -- DROP TABLE IF EXISTS archon_projects_backup;
    
    -- Drop migration functions
    DROP FUNCTION IF EXISTS create_system_user_for_migration();
    DROP FUNCTION IF EXISTS validate_migration();
    DROP FUNCTION IF EXISTS setup_post_migration_permissions();
    DROP FUNCTION IF EXISTS generate_migration_report();
    DROP FUNCTION IF EXISTS cleanup_migration_artifacts();
    
    RAISE NOTICE 'Migration artifacts cleaned up (backup tables preserved)';
END;
$cleanup$;

-- Note: Run cleanup_migration_artifacts() manually when migration is confirmed successful

COMMENT ON SCHEMA public IS 'Multi-user migration completed - see archon_settings for details';