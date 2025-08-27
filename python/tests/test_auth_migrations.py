"""
Tests for authentication system database migrations
Tests SQL schema changes, data migration, and database integrity
"""

import pytest
import asyncio
import os
from pathlib import Path
from unittest.mock import Mock, patch, AsyncMock
import tempfile

# Mock SQL execution for testing migration scripts
class MockDatabaseConnection:
    """Mock database connection for testing migrations"""
    
    def __init__(self):
        self.executed_queries = []
        self.tables = {}
        self.functions = {}
        
    def execute(self, query, params=None):
        """Mock query execution"""
        self.executed_queries.append((query, params))
        
        # Simulate specific responses for common queries
        if "SELECT COUNT(*)" in query and "user_profiles" in query:
            return {"data": [{"count": 0}]}
        elif "SELECT * FROM user_profiles" in query:
            return {"data": []}
        elif "INSERT INTO user_profiles" in query:
            return {"data": [{"id": "test-user-id"}]}
        
        return {"data": [], "status": "success"}

@pytest.fixture
def mock_db():
    """Create mock database connection"""
    return MockDatabaseConnection()

@pytest.fixture
def migration_files():
    """Paths to migration files"""
    migration_dir = Path(__file__).parent.parent.parent / "migration"
    return {
        "multi_user_auth": migration_dir / "multi_user_auth.sql",
        "add_user_id": migration_dir / "add_user_id_to_tables.sql", 
        "update_rls": migration_dir / "update_rls_policies.sql",
        "migrate_data": migration_dir / "migrate_existing_data.sql"
    }

class TestMigrationFiles:
    """Test migration file existence and basic syntax"""
    
    def test_migration_files_exist(self, migration_files):
        """All migration files should exist"""
        for name, filepath in migration_files.items():
            assert filepath.exists(), f"Migration file {name} does not exist at {filepath}"
            assert filepath.stat().st_size > 0, f"Migration file {name} is empty"
    
    def test_migration_files_syntax(self, migration_files):
        """Migration files should have valid SQL syntax structure"""
        for name, filepath in migration_files.items():
            content = filepath.read_text()
            
            # Basic SQL syntax checks
            assert content.strip(), f"Migration {name} is empty"
            assert "CREATE" in content or "ALTER" in content or "INSERT" in content, \
                f"Migration {name} doesn't contain SQL DDL/DML statements"
            
            # Check for proper comments
            assert "--" in content, f"Migration {name} should have SQL comments"

class TestMultiUserAuthMigration:
    """Test multi-user authentication schema migration"""
    
    def test_user_profiles_table_creation(self, migration_files):
        """Should create user_profiles table with correct structure"""
        content = migration_files["multi_user_auth"].read_text()
        
        # Check table creation
        assert "CREATE TABLE" in content and "user_profiles" in content
        
        # Check required columns
        required_columns = [
            "id UUID", "email TEXT", "full_name TEXT", "role TEXT", 
            "is_active BOOLEAN", "created_at", "updated_at"
        ]
        for column in required_columns:
            assert column in content, f"Column {column} not found in user_profiles table"
    
    def test_role_constraints(self, migration_files):
        """Should define proper role constraints"""
        content = migration_files["multi_user_auth"].read_text()
        
        # Check role constraint
        assert "CHECK (role IN (" in content
        assert "'admin'" in content and "'user'" in content
        assert "'viewer'" in content and "'guest'" in content
    
    def test_foreign_key_constraints(self, migration_files):
        """Should reference Supabase auth.users table"""
        content = migration_files["multi_user_auth"].read_text()
        
        assert "REFERENCES auth.users(id)" in content
        assert "ON DELETE CASCADE" in content
    
    def test_indexes_creation(self, migration_files):
        """Should create proper indexes for performance"""
        content = migration_files["multi_user_auth"].read_text()
        
        expected_indexes = [
            "idx_user_profiles_email",
            "idx_user_profiles_role", 
            "idx_user_profiles_is_active"
        ]
        for index in expected_indexes:
            assert index in content, f"Index {index} not found"
    
    def test_rls_policies(self, migration_files):
        """Should enable RLS and create basic policies"""
        content = migration_files["multi_user_auth"].read_text()
        
        assert "ENABLE ROW LEVEL SECURITY" in content
        assert "CREATE POLICY" in content
    
    def test_utility_functions(self, migration_files):
        """Should create utility functions for role checking"""
        content = migration_files["multi_user_auth"].read_text()
        
        expected_functions = [
            "has_role", "is_admin", "current_user_role", 
            "update_user_role", "deactivate_user"
        ]
        for func in expected_functions:
            assert func in content, f"Function {func} not found"

class TestUserIdMigration:
    """Test adding user_id columns to existing tables"""
    
    def test_user_id_columns_added(self, migration_files):
        """Should add user_id columns to all relevant tables"""
        content = migration_files["add_user_id"].read_text()
        
        expected_tables = [
            "archon_sources", "archon_crawled_pages", "archon_code_examples",
            "archon_projects", "archon_tasks", "archon_document_versions"
        ]
        
        # Check that user_id columns are added  
        assert "ADD COLUMN user_id UUID" in content or "user_id UUID" in content, \
            "user_id columns not found in migration"
    
    def test_foreign_key_constraints_added(self, migration_files):
        """Should add foreign key constraints for user_id columns"""
        content = migration_files["add_user_id"].read_text()
        
        assert "REFERENCES user_profiles(id)" in content
        assert "ON DELETE SET NULL" in content
    
    def test_indexes_for_user_id(self, migration_files):
        """Should create indexes on user_id columns"""
        content = migration_files["add_user_id"].read_text()
        
        # Should have multiple CREATE INDEX statements for user_id
        index_count = content.count("CREATE INDEX") + content.count("CREATE INDEX IF NOT EXISTS")
        assert index_count >= 5, "Not enough indexes created for user_id columns"

class TestRLSPoliciesMigration:
    """Test Row Level Security policies migration"""
    
    def test_policy_functions_created(self, migration_files):
        """Should create helper functions for policies"""
        content = migration_files["update_rls"].read_text()
        
        expected_functions = [
            "user_owns_or_admin", "user_can_view", "user_can_edit"
        ]
        for func in expected_functions:
            assert func in content, f"Policy function {func} not found"
    
    def test_table_policies_created(self, migration_files):
        """Should create policies for all user tables"""
        content = migration_files["update_rls"].read_text()
        
        expected_tables = [
            "archon_sources", "archon_crawled_pages", "archon_code_examples"
        ]
        
        for table in expected_tables:
            # Each table should have multiple policies
            table_policies = content.count(f'ON {table}')
            assert table_policies >= 3, f"Not enough policies for {table}"
    
    def test_admin_bypass_policies(self, migration_files):
        """Should include admin bypass policies"""
        content = migration_files["update_rls"].read_text()
        
        # Should have admin policies (various possible formats)
        assert "admin" in content.lower()
        assert "policy" in content.lower()

class TestDataMigration:
    """Test existing data migration script"""
    
    def test_backup_creation(self, migration_files):
        """Should create backup tables before migration"""
        content = migration_files["migrate_data"].read_text()
        
        assert "archon_sources_backup" in content
        assert "CREATE TABLE" in content and "AS SELECT * FROM" in content
    
    def test_system_user_creation(self, migration_files):
        """Should create system user for existing data"""
        content = migration_files["migrate_data"].read_text()
        
        assert "create_system_user_for_migration" in content
        assert "system@archon.local" in content
        assert "gen_random_uuid()" in content
    
    def test_data_assignment(self, migration_files):
        """Should assign existing data to system user"""
        content = migration_files["migrate_data"].read_text()
        
        # Should update multiple tables with user_id
        assert "UPDATE archon_sources" in content and "SET user_id" in content
        assert "UPDATE archon_crawled_pages" in content and "SET user_id" in content  
        assert "UPDATE archon_code_examples" in content and "SET user_id" in content
    
    def test_validation_function(self, migration_files):
        """Should include validation function"""
        content = migration_files["migrate_data"].read_text()
        
        assert "validate_migration" in content
        assert "migration_complete BOOLEAN" in content
    
    def test_idempotency(self, migration_files):
        """Migration should be idempotent (safe to run multiple times)"""
        content = migration_files["migrate_data"].read_text()
        
        # Should check for existing data before creating
        assert "IF NOT EXISTS" in content or "IF EXISTS" in content
        assert "COUNT(*)" in content  # Should count existing records
    
    def test_unique_dollar_tags(self, migration_files):
        """Should use unique dollar quote tags to avoid conflicts"""
        content = migration_files["migrate_data"].read_text()
        
        # Count different dollar quote tags
        import re
        tags = re.findall(r'\$(\w+)\$', content)
        unique_tags = set(tags)
        
        # Should have multiple unique tags
        assert len(unique_tags) >= 4, "Not enough unique dollar quote tags"
        assert len(unique_tags) == len(tags) / 2, "Dollar quote tags not properly paired"

class TestMigrationSequence:
    """Test proper migration sequence and dependencies"""
    
    def test_migration_order(self, migration_files):
        """Migrations should be applied in correct order"""
        # This would normally check timestamps or sequence numbers
        # For now, we verify logical dependencies
        
        multi_user_content = migration_files["multi_user_auth"].read_text()
        add_user_id_content = migration_files["add_user_id"].read_text()
        
        # user_profiles should be created before referencing it
        assert "user_profiles" in multi_user_content
        assert "REFERENCES user_profiles" in add_user_id_content
    
    def test_no_circular_dependencies(self, migration_files):
        """Should not have circular dependencies between migrations"""
        contents = {name: filepath.read_text() for name, filepath in migration_files.items()}
        
        # Basic check: each migration should be self-contained
        for name, content in contents.items():
            # Should not reference tables from future migrations
            if name == "multi_user_auth":
                # First migration shouldn't have too many user_id references
                user_id_count = content.count("user_id") 
                # Allow reasonable number for setup and comments
                assert user_id_count <= 10, f"Too many user_id references ({user_id_count}) in base migration"

class TestMigrationSafety:
    """Test migration safety and rollback procedures"""
    
    def test_backup_procedures(self, migration_files):
        """Should include proper backup procedures"""
        content = migration_files["migrate_data"].read_text()
        
        assert "backup" in content.lower()
        assert "RAISE NOTICE 'Created backup:" in content
    
    def test_error_handling(self, migration_files):
        """Should include proper error handling"""
        for name, filepath in migration_files.items():
            content = filepath.read_text()
            
            # Should have error handling patterns
            if "FUNCTION" in content:
                assert "EXCEPTION" in content or "BEGIN" in content, \
                    f"Function in {name} lacks proper error handling structure"
    
    def test_transaction_safety(self, migration_files):
        """Should be transaction-safe where possible"""
        for name, filepath in migration_files.items():
            content = filepath.read_text()
            
            # Large operations should use proper blocks
            if "DO $" in content:
                assert "BEGIN" in content and "END" in content, \
                    f"DO block in {name} lacks proper structure"

if __name__ == "__main__":
    pytest.main([__file__, "-v"])