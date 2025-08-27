-- =====================================================
-- Update RLS Policies for Multi-User Access Control
-- =====================================================
-- This migration updates Row Level Security policies for all tables
-- to support role-based multi-user access control
-- =====================================================

-- =====================================================
-- SECTION 1: HELPER FUNCTIONS FOR RLS POLICIES
-- =====================================================

-- Function to check if user owns a resource or is admin
CREATE OR REPLACE FUNCTION user_owns_or_admin(resource_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN (
        auth.uid() = resource_user_id OR 
        public.is_admin()
    );
END;
$$;

-- Function to check if user can view resource (owner, assigned, or admin/viewer)
CREATE OR REPLACE FUNCTION user_can_view(resource_user_id UUID, assigned_user_id UUID DEFAULT NULL)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    user_role TEXT;
BEGIN
    user_role := public.current_user_role();
    
    RETURN (
        auth.uid() = resource_user_id OR                    -- Owner
        auth.uid() = assigned_user_id OR                    -- Assigned user
        user_role IN ('admin', 'viewer') OR                -- Admin or viewer
        resource_user_id IS NULL                           -- Public/shared resource
    );
END;
$$;

-- Function to check if user can edit resource (owner, assigned, or admin)
CREATE OR REPLACE FUNCTION user_can_edit(resource_user_id UUID, assigned_user_id UUID DEFAULT NULL)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    user_role TEXT;
BEGIN
    user_role := public.current_user_role();
    
    RETURN (
        auth.uid() = resource_user_id OR                    -- Owner
        auth.uid() = assigned_user_id OR                    -- Assigned user
        user_role = 'admin'                                -- Admin
    );
END;
$$;

-- =====================================================
-- SECTION 2: ARCHON_SOURCES RLS POLICIES
-- =====================================================

-- Drop existing policies
DROP POLICY IF EXISTS "Allow service role full access" ON archon_sources;
DROP POLICY IF EXISTS "Allow authenticated users to read and update archon_sources" ON archon_sources;

-- Enable RLS
ALTER TABLE archon_sources ENABLE ROW LEVEL SECURITY;

-- Service role has full access
CREATE POLICY "Service role full access" ON archon_sources
    FOR ALL USING (auth.role() = 'service_role');

-- Users can view their own sources, or any if admin/viewer
CREATE POLICY "Users can view accessible sources" ON archon_sources
    FOR SELECT 
    USING (public.user_can_view(user_id));

-- Users can create sources (user_id will be set automatically)
CREATE POLICY "Users can create sources" ON archon_sources
    FOR INSERT 
    WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

-- Users can update their own sources, admins can update any
CREATE POLICY "Users can update own sources" ON archon_sources
    FOR UPDATE 
    USING (public.user_can_edit(user_id))
    WITH CHECK (public.user_can_edit(user_id));

-- Users can delete their own sources, admins can delete any
CREATE POLICY "Users can delete own sources" ON archon_sources
    FOR DELETE 
    USING (public.user_can_edit(user_id));

-- =====================================================
-- SECTION 3: ARCHON_CRAWLED_PAGES RLS POLICIES
-- =====================================================

-- Drop existing policies
DROP POLICY IF EXISTS "Allow service role full access" ON archon_crawled_pages;
DROP POLICY IF EXISTS "Allow authenticated users to read and update archon_crawled_pages" ON archon_crawled_pages;

-- Enable RLS
ALTER TABLE archon_crawled_pages ENABLE ROW LEVEL SECURITY;

-- Service role has full access
CREATE POLICY "Service role full access" ON archon_crawled_pages
    FOR ALL USING (auth.role() = 'service_role');

-- Users can view pages from their sources or public sources
CREATE POLICY "Users can view accessible pages" ON archon_crawled_pages
    FOR SELECT 
    USING (
        public.user_can_view(user_id) OR
        EXISTS (
            SELECT 1 FROM archon_sources 
            WHERE source_id = archon_crawled_pages.source_id 
            AND public.user_can_view(archon_sources.user_id)
        )
    );

-- Users can create pages (user_id will be inherited from source)
CREATE POLICY "Users can create pages" ON archon_crawled_pages
    FOR INSERT 
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM archon_sources 
            WHERE source_id = archon_crawled_pages.source_id 
            AND public.user_can_edit(archon_sources.user_id)
        )
    );

-- Users can update pages from their sources
CREATE POLICY "Users can update accessible pages" ON archon_crawled_pages
    FOR UPDATE 
    USING (
        public.user_can_edit(user_id) OR
        EXISTS (
            SELECT 1 FROM archon_sources 
            WHERE source_id = archon_crawled_pages.source_id 
            AND public.user_can_edit(archon_sources.user_id)
        )
    );

-- Users can delete pages from their sources
CREATE POLICY "Users can delete accessible pages" ON archon_crawled_pages
    FOR DELETE 
    USING (
        public.user_can_edit(user_id) OR
        EXISTS (
            SELECT 1 FROM archon_sources 
            WHERE source_id = archon_crawled_pages.source_id 
            AND public.user_can_edit(archon_sources.user_id)
        )
    );

-- =====================================================
-- SECTION 4: ARCHON_CODE_EXAMPLES RLS POLICIES
-- =====================================================

-- Drop existing policies
DROP POLICY IF EXISTS "Allow service role full access" ON archon_code_examples;
DROP POLICY IF EXISTS "Allow authenticated users to read and update archon_code_examples" ON archon_code_examples;

-- Enable RLS
ALTER TABLE archon_code_examples ENABLE ROW LEVEL SECURITY;

-- Service role has full access
CREATE POLICY "Service role full access" ON archon_code_examples
    FOR ALL USING (auth.role() = 'service_role');

-- Users can view accessible code examples
CREATE POLICY "Users can view accessible code examples" ON archon_code_examples
    FOR SELECT 
    USING (public.user_can_view(user_id));

-- Users can create code examples
CREATE POLICY "Users can create code examples" ON archon_code_examples
    FOR INSERT 
    WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

-- Users can update their own code examples
CREATE POLICY "Users can update own code examples" ON archon_code_examples
    FOR UPDATE 
    USING (public.user_can_edit(user_id))
    WITH CHECK (public.user_can_edit(user_id));

-- Users can delete their own code examples
CREATE POLICY "Users can delete own code examples" ON archon_code_examples
    FOR DELETE 
    USING (public.user_can_edit(user_id));

-- =====================================================
-- SECTION 5: ARCHON_PROJECTS RLS POLICIES
-- =====================================================

-- Drop existing policies
DROP POLICY IF EXISTS "Allow service role full access" ON archon_projects;
DROP POLICY IF EXISTS "Allow authenticated users to read and update archon_projects" ON archon_projects;

-- Enable RLS
ALTER TABLE archon_projects ENABLE ROW LEVEL SECURITY;

-- Service role has full access
CREATE POLICY "Service role full access" ON archon_projects
    FOR ALL USING (auth.role() = 'service_role');

-- Users can view their projects or assigned projects
CREATE POLICY "Users can view accessible projects" ON archon_projects
    FOR SELECT 
    USING (
        public.user_can_view(user_id) OR
        EXISTS (
            SELECT 1 FROM archon_tasks 
            WHERE project_id = archon_projects.id 
            AND assigned_user_id = auth.uid()
        )
    );

-- Users can create projects
CREATE POLICY "Users can create projects" ON archon_projects
    FOR INSERT 
    WITH CHECK (auth.uid() = user_id);

-- Users can update their own projects, admins can update any
CREATE POLICY "Users can update own projects" ON archon_projects
    FOR UPDATE 
    USING (public.user_can_edit(user_id))
    WITH CHECK (public.user_can_edit(user_id));

-- Users can delete their own projects, admins can delete any
CREATE POLICY "Users can delete own projects" ON archon_projects
    FOR DELETE 
    USING (public.user_can_edit(user_id));

-- =====================================================
-- SECTION 6: ARCHON_TASKS RLS POLICIES
-- =====================================================

-- Drop existing policies
DROP POLICY IF EXISTS "Allow service role full access" ON archon_tasks;
DROP POLICY IF EXISTS "Allow authenticated users to read and update archon_tasks" ON archon_tasks;

-- Enable RLS
ALTER TABLE archon_tasks ENABLE ROW LEVEL SECURITY;

-- Service role has full access
CREATE POLICY "Service role full access" ON archon_tasks
    FOR ALL USING (auth.role() = 'service_role');

-- Users can view tasks they own, are assigned to, or have project access
CREATE POLICY "Users can view accessible tasks" ON archon_tasks
    FOR SELECT 
    USING (
        public.user_can_view(user_id, assigned_user_id) OR
        EXISTS (
            SELECT 1 FROM archon_projects 
            WHERE id = archon_tasks.project_id 
            AND public.user_can_view(archon_projects.user_id)
        )
    );

-- Users can create tasks in their projects
CREATE POLICY "Users can create tasks" ON archon_tasks
    FOR INSERT 
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM archon_projects 
            WHERE id = archon_tasks.project_id 
            AND public.user_can_edit(archon_projects.user_id)
        )
    );

-- Users can update tasks they own, are assigned to, or are project owners
CREATE POLICY "Users can update accessible tasks" ON archon_tasks
    FOR UPDATE 
    USING (
        public.user_can_edit(user_id, assigned_user_id) OR
        EXISTS (
            SELECT 1 FROM archon_projects 
            WHERE id = archon_tasks.project_id 
            AND public.user_can_edit(archon_projects.user_id)
        )
    )
    WITH CHECK (
        public.user_can_edit(user_id, assigned_user_id) OR
        EXISTS (
            SELECT 1 FROM archon_projects 
            WHERE id = archon_tasks.project_id 
            AND public.user_can_edit(archon_projects.user_id)
        )
    );

-- Users can delete tasks they own or are project owners
CREATE POLICY "Users can delete accessible tasks" ON archon_tasks
    FOR DELETE 
    USING (
        public.user_can_edit(user_id) OR
        EXISTS (
            SELECT 1 FROM archon_projects 
            WHERE id = archon_tasks.project_id 
            AND public.user_can_edit(archon_projects.user_id)
        )
    );

-- =====================================================
-- SECTION 7: ARCHON_PROJECT_SOURCES RLS POLICIES
-- =====================================================

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Allow service role full access" ON archon_project_sources;
DROP POLICY IF EXISTS "Allow authenticated users to read and update archon_project_sources" ON archon_project_sources;

-- Enable RLS
ALTER TABLE archon_project_sources ENABLE ROW LEVEL SECURITY;

-- Service role has full access
CREATE POLICY "Service role full access" ON archon_project_sources
    FOR ALL USING (auth.role() = 'service_role');

-- Users can view project sources they have access to
CREATE POLICY "Users can view accessible project sources" ON archon_project_sources
    FOR SELECT 
    USING (
        public.user_can_view(user_id) OR
        EXISTS (
            SELECT 1 FROM archon_projects 
            WHERE id = archon_project_sources.project_id 
            AND public.user_can_view(archon_projects.user_id)
        )
    );

-- Users can create project sources for their projects
CREATE POLICY "Users can create project sources" ON archon_project_sources
    FOR INSERT 
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM archon_projects 
            WHERE id = archon_project_sources.project_id 
            AND public.user_can_edit(archon_projects.user_id)
        )
    );

-- Users can update project sources for their projects
CREATE POLICY "Users can update project sources" ON archon_project_sources
    FOR UPDATE 
    USING (
        public.user_can_edit(user_id) OR
        EXISTS (
            SELECT 1 FROM archon_projects 
            WHERE id = archon_project_sources.project_id 
            AND public.user_can_edit(archon_projects.user_id)
        )
    );

-- Users can delete project sources for their projects
CREATE POLICY "Users can delete project sources" ON archon_project_sources
    FOR DELETE 
    USING (
        public.user_can_edit(user_id) OR
        EXISTS (
            SELECT 1 FROM archon_projects 
            WHERE id = archon_project_sources.project_id 
            AND public.user_can_edit(archon_projects.user_id)
        )
    );

-- =====================================================
-- SECTION 8: ARCHON_DOCUMENT_VERSIONS RLS POLICIES
-- =====================================================

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Allow service role full access" ON archon_document_versions;
DROP POLICY IF EXISTS "Allow authenticated users to read and update archon_document_versions" ON archon_document_versions;

-- Enable RLS
ALTER TABLE archon_document_versions ENABLE ROW LEVEL SECURITY;

-- Service role has full access
CREATE POLICY "Service role full access" ON archon_document_versions
    FOR ALL USING (auth.role() = 'service_role');

-- Users can view document versions for their projects
CREATE POLICY "Users can view accessible document versions" ON archon_document_versions
    FOR SELECT 
    USING (
        public.user_can_view(user_id) OR
        EXISTS (
            SELECT 1 FROM archon_projects 
            WHERE id = archon_document_versions.project_id 
            AND public.user_can_view(archon_projects.user_id)
        )
    );

-- Users can create document versions for their projects
CREATE POLICY "Users can create document versions" ON archon_document_versions
    FOR INSERT 
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM archon_projects 
            WHERE id = archon_document_versions.project_id 
            AND public.user_can_edit(archon_projects.user_id)
        )
    );

-- Document versions are immutable after creation (no UPDATE policy)

-- Users can delete document versions for their projects (admins only)
CREATE POLICY "Admins can delete document versions" ON archon_document_versions
    FOR DELETE 
    USING (public.is_admin());

-- =====================================================
-- SECTION 9: ARCHON_PROMPTS RLS POLICIES
-- =====================================================

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Allow service role full access" ON archon_prompts;

-- Enable RLS
ALTER TABLE archon_prompts ENABLE ROW LEVEL SECURITY;

-- Service role has full access
CREATE POLICY "Service role full access" ON archon_prompts
    FOR ALL USING (auth.role() = 'service_role');

-- Users can view their own prompts
CREATE POLICY "Users can view own prompts" ON archon_prompts
    FOR SELECT 
    USING (public.user_can_view(user_id));

-- Users can create prompts
CREATE POLICY "Users can create prompts" ON archon_prompts
    FOR INSERT 
    WITH CHECK (auth.uid() = user_id);

-- Users can update their own prompts
CREATE POLICY "Users can update own prompts" ON archon_prompts
    FOR UPDATE 
    USING (public.user_can_edit(user_id))
    WITH CHECK (public.user_can_edit(user_id));

-- Users can delete their own prompts
CREATE POLICY "Users can delete own prompts" ON archon_prompts
    FOR DELETE 
    USING (public.user_can_edit(user_id));

-- =====================================================
-- SECTION 10: SPECIAL HANDLING FOR SETTINGS
-- =====================================================

-- Settings table already has proper RLS policies from the initial migration
-- Just ensure they're working correctly

-- Update settings policies to be more specific about admin access
DROP POLICY IF EXISTS "Allow authenticated users to read and update" ON archon_settings;

-- Regular users can read non-encrypted settings
CREATE POLICY "Users can read public settings" ON archon_settings
    FOR SELECT 
    USING (is_encrypted = false OR public.is_admin());

-- Only admins can modify settings
CREATE POLICY "Admins can manage settings" ON archon_settings
    FOR ALL 
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- =====================================================
-- SECTION 11: CREATE VIEWS FOR EASY ACCESS
-- =====================================================

-- View for user's accessible sources
CREATE OR REPLACE VIEW user_accessible_sources AS
SELECT s.* 
FROM archon_sources s
WHERE public.user_can_view(s.user_id);

-- View for user's accessible projects
CREATE OR REPLACE VIEW user_accessible_projects AS
SELECT p.* 
FROM archon_projects p
WHERE public.user_can_view(p.user_id)
   OR EXISTS (
       SELECT 1 FROM archon_tasks t 
       WHERE t.project_id = p.id 
       AND t.assigned_user_id = auth.uid()
   );

-- View for user's accessible tasks
CREATE OR REPLACE VIEW user_accessible_tasks AS
SELECT t.* 
FROM archon_tasks t
JOIN archon_projects p ON p.id = t.project_id
WHERE public.user_can_view(t.user_id, t.assigned_user_id)
   OR public.user_can_view(p.user_id);

-- =====================================================
-- MIGRATION LOG
-- =====================================================

INSERT INTO archon_settings (key, value, is_encrypted, category, description) VALUES
('MULTI_USER_RLS_UPDATED', 'true', false, 'features', 'RLS policies have been updated for multi-user access control')
ON CONFLICT (key) DO UPDATE SET
    value = EXCLUDED.value,
    updated_at = NOW();

-- Add comments to document the migration
COMMENT ON FUNCTION user_owns_or_admin(UUID) IS 'Helper function to check if user owns a resource or is admin';
COMMENT ON FUNCTION user_can_view(UUID, UUID) IS 'Helper function to check if user can view a resource';
COMMENT ON FUNCTION user_can_edit(UUID, UUID) IS 'Helper function to check if user can edit a resource';

COMMENT ON VIEW user_accessible_sources IS 'View showing sources accessible to current user';
COMMENT ON VIEW user_accessible_projects IS 'View showing projects accessible to current user';
COMMENT ON VIEW user_accessible_tasks IS 'View showing tasks accessible to current user';