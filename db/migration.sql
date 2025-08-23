-- Migration script to add missing columns to existing tables
-- Run this in your Supabase SQL Editor

-- Add missing columns to files table
ALTER TABLE public.files 
ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS is_starred BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS original_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS storage_path VARCHAR(500);

-- Add missing columns to folders table
ALTER TABLE public.folders 
ADD COLUMN IF NOT EXISTS is_starred BOOLEAN DEFAULT FALSE;

-- Add missing columns to permissions table
ALTER TABLE public.permissions 
ADD COLUMN IF NOT EXISTS permission_type VARCHAR(20) CHECK (permission_type IN ('viewer', 'editor', 'admin'));

-- Add missing columns to shared_links table
ALTER TABLE public.shared_links 
ADD COLUMN IF NOT EXISTS link_token VARCHAR(255) UNIQUE,
ADD COLUMN IF NOT EXISTS access_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS max_accesses INTEGER;

-- Update existing records to have default values
UPDATE public.files SET 
    is_deleted = FALSE,
    is_starred = FALSE,
    original_name = name,
    storage_path = CONCAT('files/', id, '/', name)
WHERE is_deleted IS NULL OR is_starred IS NULL OR original_name IS NULL OR storage_path IS NULL;

UPDATE public.folders SET 
    is_starred = FALSE
WHERE is_starred IS NULL;

UPDATE public.permissions SET 
    permission_type = 'viewer'
WHERE permission_type IS NULL;

-- Create indexes if they don't exist
CREATE INDEX IF NOT EXISTS idx_files_deleted ON public.files(is_deleted);
CREATE INDEX IF NOT EXISTS idx_files_starred ON public.files(is_starred);
CREATE INDEX IF NOT EXISTS idx_folders_starred ON public.folders(is_starred);
CREATE INDEX IF NOT EXISTS idx_permissions_type ON public.permissions(permission_type);
CREATE INDEX IF NOT EXISTS idx_shared_links_token ON public.shared_links(link_token);

-- Migration to add missing columns to files table
-- Add download_url column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'files' AND column_name = 'download_url') THEN
        ALTER TABLE public.files ADD COLUMN download_url TEXT;
    END IF;
END $$;

-- Add path column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'files' AND column_name = 'path') THEN
        ALTER TABLE public.files ADD COLUMN path VARCHAR(500);
    END IF;
END $$;
