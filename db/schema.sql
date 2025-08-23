-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table
CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    username VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Folders table
CREATE TABLE IF NOT EXISTS public.folders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    parent_id UUID REFERENCES public.folders(id) ON DELETE CASCADE,
    owner_email VARCHAR(255) NOT NULL,
    is_starred BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Files table
CREATE TABLE IF NOT EXISTS public.files (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    original_name VARCHAR(255) NOT NULL,
    mime_type VARCHAR(100),
    size BIGINT,
    folder_id UUID REFERENCES public.folders(id) ON DELETE CASCADE,
    owner_email VARCHAR(255) NOT NULL,
    storage_path VARCHAR(500) NOT NULL,
    download_url TEXT,
    path VARCHAR(500),
    is_starred BOOLEAN DEFAULT FALSE,
    is_deleted BOOLEAN DEFAULT FALSE,
    deleted_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Permissions table (for sharing with specific users)
CREATE TABLE IF NOT EXISTS public.permissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    resource_id UUID NOT NULL,
    resource_type VARCHAR(20) NOT NULL CHECK (resource_type IN ('file', 'folder')),
    user_email VARCHAR(255) NOT NULL,
    permission_type VARCHAR(20) NOT NULL CHECK (permission_type IN ('viewer', 'editor', 'admin')),
    granted_by VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Shared links table (for public sharing with expiry)
CREATE TABLE IF NOT EXISTS public.shared_links (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    resource_id UUID NOT NULL,
    resource_type VARCHAR(20) NOT NULL CHECK (resource_type IN ('file', 'folder')),
    link_token VARCHAR(255) UNIQUE NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE,
    access_count INTEGER DEFAULT 0,
    max_accesses INTEGER,
    created_by VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_folders_owner ON public.folders(owner_email);
CREATE INDEX IF NOT EXISTS idx_folders_parent ON public.folders(parent_id);
CREATE INDEX IF NOT EXISTS idx_files_owner ON public.files(owner_email);
CREATE INDEX IF NOT EXISTS idx_files_folder ON public.files(folder_id);
CREATE INDEX IF NOT EXISTS idx_files_deleted ON public.files(is_deleted);
CREATE INDEX IF NOT EXISTS idx_files_starred ON public.files(is_starred);
CREATE INDEX IF NOT EXISTS idx_permissions_resource ON public.permissions(resource_id, resource_type);
CREATE INDEX IF NOT EXISTS idx_permissions_user ON public.permissions(user_email);
CREATE INDEX IF NOT EXISTS idx_shared_links_token ON public.shared_links(link_token);
CREATE INDEX IF NOT EXISTS idx_shared_links_resource ON public.shared_links(resource_id, resource_type);

-- Enable Row Level Security (RLS)
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shared_links ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view own folders" ON public.folders;
DROP POLICY IF EXISTS "Users can insert own folders" ON public.folders;
DROP POLICY IF EXISTS "Users can update own folders" ON public.folders;
DROP POLICY IF EXISTS "Users can delete own folders" ON public.folders;
DROP POLICY IF EXISTS "Users can view shared folders" ON public.folders;

DROP POLICY IF EXISTS "Users can view own files" ON public.files;
DROP POLICY IF EXISTS "Users can insert own files" ON public.files;
DROP POLICY IF EXISTS "Users can update own files" ON public.files;
DROP POLICY IF EXISTS "Users can delete own files" ON public.files;
DROP POLICY IF EXISTS "Users can view shared files" ON public.files;

DROP POLICY IF EXISTS "Users can view own permissions" ON public.permissions;
DROP POLICY IF EXISTS "Users can insert own permissions" ON public.permissions;
DROP POLICY IF EXISTS "Users can update own permissions" ON public.permissions;
DROP POLICY IF EXISTS "Users can delete own permissions" ON public.permissions;

DROP POLICY IF EXISTS "Users can view own shared links" ON public.shared_links;
DROP POLICY IF EXISTS "Users can insert own shared links" ON public.shared_links;
DROP POLICY IF EXISTS "Users can update own shared links" ON public.shared_links;
DROP POLICY IF EXISTS "Users can delete own shared links" ON public.shared_links;

-- Folder policies
CREATE POLICY "Users can view own folders" ON public.folders
    FOR SELECT USING (owner_email = auth.jwt() ->> 'email');

CREATE POLICY "Users can insert own folders" ON public.folders
    FOR INSERT WITH CHECK (owner_email = auth.jwt() ->> 'email');

CREATE POLICY "Users can update own folders" ON public.folders
    FOR UPDATE USING (owner_email = auth.jwt() ->> 'email');

CREATE POLICY "Users can delete own folders" ON public.folders
    FOR DELETE USING (owner_email = auth.jwt() ->> 'email');

CREATE POLICY "Users can view shared folders" ON public.folders
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.permissions 
            WHERE resource_id = folders.id 
            AND resource_type = 'folder' 
            AND user_email = auth.jwt() ->> 'email'
        )
    );

-- File policies
CREATE POLICY "Users can view own files" ON public.files
    FOR SELECT USING (owner_email = auth.jwt() ->> 'email' AND is_deleted = false);

CREATE POLICY "Users can insert own files" ON public.files
    FOR INSERT WITH CHECK (owner_email = auth.jwt() ->> 'email');

CREATE POLICY "Users can update own files" ON public.files
    FOR UPDATE USING (owner_email = auth.jwt() ->> 'email');

CREATE POLICY "Users can delete own files" ON public.files
    FOR DELETE USING (owner_email = auth.jwt() ->> 'email');

CREATE POLICY "Users can view shared files" ON public.files
    FOR SELECT USING (
        is_deleted = false AND
        EXISTS (
            SELECT 1 FROM public.permissions 
            WHERE resource_id = files.id 
            AND resource_type = 'file' 
            AND user_email = auth.jwt() ->> 'email'
        )
    );

-- Permission policies
CREATE POLICY "Users can view own permissions" ON public.permissions
    FOR SELECT USING (
        granted_by = auth.jwt() ->> 'email' OR 
        user_email = auth.jwt() ->> 'email'
    );

CREATE POLICY "Users can insert own permissions" ON public.permissions
    FOR INSERT WITH CHECK (granted_by = auth.jwt() ->> 'email');

CREATE POLICY "Users can update own permissions" ON public.permissions
    FOR UPDATE USING (granted_by = auth.jwt() ->> 'email');

CREATE POLICY "Users can delete own permissions" ON public.permissions
    FOR DELETE USING (granted_by = auth.jwt() ->> 'email');

-- Shared links policies
CREATE POLICY "Users can view own shared links" ON public.shared_links
    FOR SELECT USING (created_by = auth.jwt() ->> 'email');

CREATE POLICY "Users can insert own shared links" ON public.shared_links
    FOR INSERT WITH CHECK (created_by = auth.jwt() ->> 'email');

CREATE POLICY "Users can update own shared links" ON public.shared_links
    FOR UPDATE USING (created_by = auth.jwt() ->> 'email');

CREATE POLICY "Users can delete own shared links" ON public.shared_links
    FOR DELETE USING (created_by = auth.jwt() ->> 'email');

-- Storage bucket policies
INSERT INTO storage.buckets (id, name, public) VALUES ('files', 'files', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Users can upload own files" ON storage.objects
    FOR INSERT WITH CHECK (
        bucket_id = 'files' AND 
        auth.jwt() ->> 'email' IS NOT NULL
    );

CREATE POLICY "Users can view own files" ON storage.objects
    FOR SELECT USING (
        bucket_id = 'files' AND 
        auth.jwt() ->> 'email' IS NOT NULL
    );

CREATE POLICY "Users can update own files" ON storage.objects
    FOR UPDATE USING (
        bucket_id = 'files' AND 
        auth.jwt() ->> 'email' IS NOT NULL
    );

CREATE POLICY "Users can delete own files" ON storage.objects
    FOR DELETE USING (
        bucket_id = 'files' AND 
        auth.jwt() ->> 'email' IS NOT NULL
    );


