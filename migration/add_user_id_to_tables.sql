-- =====================================================
-- Add user_id columns to main tables for multi-user support
-- =====================================================
-- This migration adds user_id columns to all main tables
-- and creates appropriate indexes and constraints
-- =====================================================

-- =====================================================
-- SECTION 1: ADD USER_ID COLUMNS TO MAIN TABLES
-- =====================================================

-- Add user_id to archon_sources table
ALTER TABLE archon_sources 
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE;

-- Add user_id to archon_crawled_pages (inherited from source)
-- Note: We don't add user_id directly since it's linked via source_id
-- But we add it for direct access optimization
ALTER TABLE archon_crawled_pages 
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE;

-- Add user_id to archon_code_examples  
ALTER TABLE archon_code_examples 
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE;

-- Add user_id to archon_projects
ALTER TABLE archon_projects 
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE;

-- Add user_id to archon_tasks (inherited from project, but also direct for assigned tasks)
ALTER TABLE archon_tasks 
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS assigned_user_id UUID REFERENCES user_profiles(id) ON DELETE SET NULL;

-- Add user_id to archon_project_sources (linking table)
ALTER TABLE archon_project_sources 
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE;

-- Add user_id to archon_document_versions
ALTER TABLE archon_document_versions 
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE;

-- Add user_id to archon_prompts
ALTER TABLE archon_prompts 
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE;

-- =====================================================
-- SECTION 2: CREATE INDEXES FOR PERFORMANCE
-- =====================================================

-- Indexes for user_id columns
CREATE INDEX IF NOT EXISTS idx_archon_sources_user_id ON archon_sources(user_id);
CREATE INDEX IF NOT EXISTS idx_archon_crawled_pages_user_id ON archon_crawled_pages(user_id);
CREATE INDEX IF NOT EXISTS idx_archon_code_examples_user_id ON archon_code_examples(user_id);
CREATE INDEX IF NOT EXISTS idx_archon_projects_user_id ON archon_projects(user_id);
CREATE INDEX IF NOT EXISTS idx_archon_tasks_user_id ON archon_tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_archon_tasks_assigned_user_id ON archon_tasks(assigned_user_id);
CREATE INDEX IF NOT EXISTS idx_archon_project_sources_user_id ON archon_project_sources(user_id);
CREATE INDEX IF NOT EXISTS idx_archon_document_versions_user_id ON archon_document_versions(user_id);
CREATE INDEX IF NOT EXISTS idx_archon_prompts_user_id ON archon_prompts(user_id);

-- Composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_archon_sources_user_id_created_at ON archon_sources(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_archon_projects_user_id_created_at ON archon_projects(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_archon_tasks_user_id_status ON archon_tasks(user_id, status);
CREATE INDEX IF NOT EXISTS idx_archon_tasks_assigned_user_id_status ON archon_tasks(assigned_user_id, status);

-- =====================================================
-- SECTION 3: ADD COMMENTS FOR DOCUMENTATION
-- =====================================================

COMMENT ON COLUMN archon_sources.user_id IS 'Owner of the knowledge source';
COMMENT ON COLUMN archon_crawled_pages.user_id IS 'Owner of the crawled page content';
COMMENT ON COLUMN archon_code_examples.user_id IS 'Owner of the code example';
COMMENT ON COLUMN archon_projects.user_id IS 'Owner/creator of the project';
COMMENT ON COLUMN archon_tasks.user_id IS 'Owner of the task (usually project owner)';
COMMENT ON COLUMN archon_tasks.assigned_user_id IS 'User assigned to complete this task';
COMMENT ON COLUMN archon_project_sources.user_id IS 'Owner of the project-source link';
COMMENT ON COLUMN archon_document_versions.user_id IS 'User who created this document version';
COMMENT ON COLUMN archon_prompts.user_id IS 'Owner of the prompt';

-- =====================================================
-- SECTION 4: CREATE FUNCTIONS TO SYNC USER_ID
-- =====================================================

-- Function to sync user_id in crawled_pages from sources
CREATE OR REPLACE FUNCTION sync_crawled_pages_user_id()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    -- Update crawled_pages user_id when source user_id changes
    UPDATE archon_crawled_pages 
    SET user_id = NEW.user_id 
    WHERE source_id = NEW.source_id;
    
    RETURN NEW;
END;
$$;

-- Function to sync user_id in tasks from projects
CREATE OR REPLACE FUNCTION sync_tasks_user_id()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    -- Update tasks user_id when project user_id changes (for non-assigned tasks)
    UPDATE archon_tasks 
    SET user_id = NEW.user_id 
    WHERE project_id = NEW.id 
    AND assigned_user_id IS NULL;
    
    RETURN NEW;
END;
$$;

-- Function to sync user_id in project_sources from projects
CREATE OR REPLACE FUNCTION sync_project_sources_user_id()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    -- Update project_sources user_id when project user_id changes
    UPDATE archon_project_sources 
    SET user_id = NEW.user_id 
    WHERE project_id = NEW.id;
    
    RETURN NEW;
END;
$$;

-- Create triggers to keep user_id in sync
DROP TRIGGER IF EXISTS trigger_sync_crawled_pages_user_id ON archon_sources;
CREATE TRIGGER trigger_sync_crawled_pages_user_id
    AFTER UPDATE OF user_id ON archon_sources
    FOR EACH ROW
    EXECUTE FUNCTION sync_crawled_pages_user_id();

DROP TRIGGER IF EXISTS trigger_sync_tasks_user_id ON archon_projects;
CREATE TRIGGER trigger_sync_tasks_user_id
    AFTER UPDATE OF user_id ON archon_projects
    FOR EACH ROW
    EXECUTE FUNCTION sync_tasks_user_id();

DROP TRIGGER IF EXISTS trigger_sync_project_sources_user_id ON archon_projects;
CREATE TRIGGER trigger_sync_project_sources_user_id
    AFTER UPDATE OF user_id ON archon_projects
    FOR EACH ROW
    EXECUTE FUNCTION sync_project_sources_user_id();

-- =====================================================
-- SECTION 5: FUNCTIONS FOR USER DATA OPERATIONS
-- =====================================================

-- Function to set user_id for new records (to be used in application code)
CREATE OR REPLACE FUNCTION set_user_id_from_auth()
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Return the current authenticated user's ID
    RETURN auth.uid();
END;
$$;

-- Function to transfer ownership of user data (admin only)
CREATE OR REPLACE FUNCTION transfer_user_data(
    from_user_id UUID,
    to_user_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Check if current user is admin
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Only administrators can transfer user data';
    END IF;
    
    -- Verify both users exist
    IF NOT EXISTS (SELECT 1 FROM user_profiles WHERE id = from_user_id) OR 
       NOT EXISTS (SELECT 1 FROM user_profiles WHERE id = to_user_id) THEN
        RAISE EXCEPTION 'One or both users do not exist';
    END IF;
    
    -- Transfer ownership of all data
    UPDATE archon_sources SET user_id = to_user_id WHERE user_id = from_user_id;
    UPDATE archon_crawled_pages SET user_id = to_user_id WHERE user_id = from_user_id;
    UPDATE archon_code_examples SET user_id = to_user_id WHERE user_id = from_user_id;
    UPDATE archon_projects SET user_id = to_user_id WHERE user_id = from_user_id;
    UPDATE archon_tasks SET user_id = to_user_id WHERE user_id = from_user_id;
    UPDATE archon_project_sources SET user_id = to_user_id WHERE user_id = from_user_id;
    UPDATE archon_document_versions SET user_id = to_user_id WHERE user_id = from_user_id;
    UPDATE archon_prompts SET user_id = to_user_id WHERE user_id = from_user_id;
    
    RETURN TRUE;
END;
$$;

-- Function to get user data statistics
CREATE OR REPLACE FUNCTION get_user_data_stats(target_user_id UUID DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    check_user_id UUID;
    stats JSONB;
BEGIN
    -- Default to current user if no target specified
    check_user_id := COALESCE(target_user_id, auth.uid());
    
    -- Admin can check any user's stats, others can only check their own
    IF target_user_id IS NOT NULL AND target_user_id != auth.uid() AND NOT public.is_admin() THEN
        RAISE EXCEPTION 'Permission denied: Cannot view other users'' statistics';
    END IF;
    
    -- Build statistics JSON
    SELECT jsonb_build_object(
        'user_id', check_user_id,
        'sources_count', (SELECT COUNT(*) FROM archon_sources WHERE user_id = check_user_id),
        'pages_count', (SELECT COUNT(*) FROM archon_crawled_pages WHERE user_id = check_user_id),
        'code_examples_count', (SELECT COUNT(*) FROM archon_code_examples WHERE user_id = check_user_id),
        'projects_count', (SELECT COUNT(*) FROM archon_projects WHERE user_id = check_user_id),
        'tasks_owned_count', (SELECT COUNT(*) FROM archon_tasks WHERE user_id = check_user_id),
        'tasks_assigned_count', (SELECT COUNT(*) FROM archon_tasks WHERE assigned_user_id = check_user_id),
        'prompts_count', (SELECT COUNT(*) FROM archon_prompts WHERE user_id = check_user_id)
    ) INTO stats;
    
    RETURN stats;
END;
$$;

-- =====================================================
-- MIGRATION LOG
-- =====================================================

INSERT INTO archon_settings (key, value, is_encrypted, category, description) VALUES
('USER_ID_COLUMNS_ADDED', 'true', false, 'features', 'User ID columns have been added to all main tables for multi-user support')
ON CONFLICT (key) DO UPDATE SET
    value = EXCLUDED.value,
    updated_at = NOW();