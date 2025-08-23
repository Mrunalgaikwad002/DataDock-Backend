import { Router } from 'express';
import multer from 'multer';
import { supabase } from '../config/supabase.js';
import { SUPABASE_BUCKET } from '../config/env.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { getPermittedIds } from '../utils/permissions.js';
import crypto from 'crypto';

const router = Router();

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB limit
  },
});

// GET /files - Get files with pagination, search, and filtering
router.get('/', requireAuth, async (req, res) => {
  try {
    const { page = 1, limit = 20, folderId, search, sortBy = 'name', sortOrder = 'asc', starred } = req.query;
    const userEmail = req.user.email;
    
    let query = supabase
      .from('files')
      .select('*')
      .eq('is_deleted', false);
    
    // Filter by folder
    if (folderId && folderId !== 'null') {
      query = query.eq('folder_id', folderId);
    } else {
      query = query.is('folder_id', null);
    }
    
    // Filter by owner or shared permissions
    const permittedIds = await getPermittedIds(userEmail, 'file');
    query = query.or(`owner_email.eq.${userEmail},id.in.(${permittedIds.join(',')})`);
    
    // Search functionality
    if (search) {
      query = query.ilike('name', `%${search}%`);
    }
    
    // Star filter
    if (starred === 'true') {
      query = query.eq('is_starred', true);
    }
    
    // Sorting
    const orderColumn = sortBy === 'date' ? 'created_at' : sortBy === 'size' ? 'size' : 'name';
    query = query.order(orderColumn, { ascending: sortOrder === 'asc' });
    
    // Pagination
    const offset = (page - 1) * limit;
    query = query.range(offset, offset + limit - 1);
    
    const { data: files, error, count } = await query;
    
    if (error) throw error;
    
    res.json({
      files,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: count || files.length,
        pages: Math.ceil((count || files.length) / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching files:', error);
    res.status(500).json({ error: 'Failed to fetch files' });
  }
});

// POST /files/upload - Upload file with progress tracking
router.post('/upload', requireAuth, upload.single('file'), async (req, res) => {
  try {
    const { folderId } = req.body;
    const file = req.file;
    const userEmail = req.user.email;
    
    if (!file) {
      return res.status(400).json({ error: 'No file provided' });
    }
    
    // Generate unique filename
    const fileId = crypto.randomBytes(16).toString('hex');
    const fileExtension = file.originalname.split('.').pop();
    const fileName = `${fileId}.${fileExtension}`;
    
    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from(SUPABASE_BUCKET)
      .upload(fileName, file.buffer, {
        contentType: file.mimetype,
        metadata: {
          originalName: file.originalname,
          uploadedBy: userEmail
        }
      });
    
    if (uploadError) throw uploadError;
    
    // Save file metadata to database
    const { data: fileData, error: dbError } = await supabase
      .from('files')
      .insert([{
        id: fileId,
        name: file.originalname,
        original_name: file.originalname,
        mime_type: file.mimetype,
        size: file.size,
        folder_id: folderId || null,
        owner_email: userEmail,
        storage_path: uploadData.path
      }])
      .select()
      .single();
    
    if (dbError) throw dbError;
    
    res.json({ 
      success: true, 
      file: fileData,
      message: 'File uploaded successfully' 
    });
  } catch (error) {
    console.error('Error uploading file:', error);
    res.status(500).json({ error: 'Failed to upload file' });
  }
});

// POST /files/bulk-upload - Upload multiple files for import
router.post('/bulk-upload', requireAuth, upload.array('files', 100), async (req, res) => {
  try {
    const { folderId } = req.body;
    const userEmail = req.user.email;
    const uploadedFiles = [];

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No files provided' });
    }

    // Check if folder exists and user has access
    if (folderId) {
      const { data: folder, error: folderError } = await supabase
        .from('folders')
        .select('*')
        .eq('id', folderId)
        .single();
      
      if (folderError || !folder) {
        return res.status(404).json({ error: 'Folder not found' });
      }
      
      if (folder.owner_email !== userEmail) {
        const permittedIds = await getPermittedIds(userEmail, 'folder');
        if (!permittedIds.includes(folderId)) {
          return res.status(403).json({ error: 'Access denied to folder' });
        }
      }
    }

    for (const file of req.files) {
      try {
        // Upload file to storage
        const fileName = `${Date.now()}-${file.originalname}`;
        const { data: storageData, error: storageError } = await supabase.storage
          .from(SUPABASE_BUCKET)
          .upload(fileName, file.buffer, {
            contentType: file.mimetype,
            metadata: {
              originalName: file.originalname,
              size: file.size
            }
          });

        if (storageError) {
          console.error(`Error uploading file ${file.originalname}:`, storageError);
          continue;
        }

        // Get public URL
        const { data: { publicUrl } } = supabase.storage
          .from('files')
          .getPublicUrl(fileName);

        // Create file record in database
        const { data: fileRecord, error: dbError } = await supabase
          .from('files')
          .insert([{
            name: file.originalname,
            original_name: file.originalname,
            folder_id: folderId || null,
            owner_email: userEmail,
            size: file.size,
            mime_type: file.mimetype,
            storage_path: fileName,
            download_url: publicUrl
          }])
          .select()
          .single();

        if (dbError) {
          console.error(`Error creating file record for ${file.originalname}:`, dbError);
          continue;
        }

        uploadedFiles.push(fileRecord);
      } catch (error) {
        console.error(`Error processing file ${file.originalname}:`, error);
      }
    }

    res.json({
      success: true,
      uploadedFiles,
      message: `${uploadedFiles.length} files uploaded successfully`
    });
  } catch (error) {
    console.error('Error in bulk upload:', error);
    res.status(500).json({ error: 'Failed to upload files' });
  }
});

// GET /files/:id/download - Download file
router.get('/:id/download', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const userEmail = req.user.email;
    
    // Get file info
    const { data: file, error: fileError } = await supabase
      .from('files')
      .select('*')
      .eq('id', id)
      .eq('is_deleted', false)
      .single();
    
    if (fileError || !file) {
      return res.status(404).json({ error: 'File not found' });
    }
    
    // Check permissions
    if (file.owner_email !== userEmail) {
      const permittedIds = await getPermittedIds(userEmail, 'file');
      if (!permittedIds.includes(id)) {
        return res.status(403).json({ error: 'Access denied' });
      }
    }
    
    // Get signed URL for download
    const { data: signedUrl, error: urlError } = await supabase.storage
      .from(SUPABASE_BUCKET)
      .createSignedUrl(file.storage_path, 60); // 60 seconds expiry
    
    if (urlError) {
      console.error('Error creating download signed URL:', urlError);
      // If storage fails, try to return the file directly
      if (file.download_url) {
        return res.json({ downloadUrl: file.download_url });
      }
      throw urlError;
    }
    
    res.json({ downloadUrl: signedUrl.signedUrl });
  } catch (error) {
    console.error('Error downloading file:', error);
    res.status(500).json({ error: 'Failed to download file' });
  }
});

// GET /files/:id/view - Get file for viewing (returns signed URL)
router.get('/:id/view', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const userEmail = req.user.email;
    
    console.log('View request for file ID:', id, 'by user:', userEmail);
    
    // Get file info
    const { data: file, error: fileError } = await supabase
      .from('files')
      .select('*')
      .eq('id', id)
      .eq('is_deleted', false)
      .single();
    
    if (fileError || !file) {
      console.log('File not found:', id);
      return res.status(404).json({ error: 'File not found' });
    }
    
    console.log('File found for viewing:', {
      id: file.id,
      name: file.name,
      storage_path: file.storage_path,
      download_url: file.download_url,
      owner_email: file.owner_email
    });
    
    // Check permissions
    if (file.owner_email !== userEmail) {
      const permittedIds = await getPermittedIds(userEmail, 'file');
      if (!permittedIds.includes(id)) {
        return res.status(403).json({ error: 'Access denied' });
      }
    }
    
    // Try to use download_url first if available
    if (file.download_url) {
      console.log('Using download_url as view URL');
      return res.json({ viewUrl: file.download_url });
    }
    
    // If no download_url, try to create a signed URL
    if (file.storage_path) {
      console.log('Attempting to create signed URL for storage path:', file.storage_path);
      
      try {
        const { data: signedUrl, error: urlError } = await supabase.storage
          .from(SUPABASE_BUCKET)
          .createSignedUrl(file.storage_path, 3600); // 1 hour expiry for viewing
        
        if (urlError) {
          console.error('Error creating signed URL:', urlError);
          throw urlError;
        }
        
        console.log('Successfully created signed URL');
        return res.json({ viewUrl: signedUrl.signedUrl });
      } catch (storageError) {
        console.error('Storage error:', storageError);
        
        // If storage fails, return a helpful error
        return res.status(500).json({ 
          error: 'Storage not available',
          details: storageError.message,
          suggestion: 'Please check if the Supabase storage bucket exists'
        });
      }
    }
    
    // If no storage path either, return error
    return res.status(500).json({ 
      error: 'No file content available',
      details: 'File has no storage path or download URL'
    });
    
  } catch (error) {
    console.error('Error getting file for viewing:', error);
    res.status(500).json({ error: 'Failed to get file for viewing' });
  }
});

// PUT /files/:id/star - Toggle star status
router.put('/:id/star', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const userEmail = req.user.email;
    
    // Get current file
    const { data: file, error: fileError } = await supabase
      .from('files')
      .select('*')
      .eq('id', id)
      .eq('owner_email', userEmail)
      .single();
    
    if (fileError || !file) {
      return res.status(404).json({ error: 'File not found' });
    }
    
    // Toggle star status
    const { data: updatedFile, error: updateError } = await supabase
      .from('files')
      .update({ is_starred: !file.is_starred })
      .eq('id', id)
      .select()
      .single();
    
    if (updateError) throw updateError;
    
    res.json({ 
      success: true, 
      file: updatedFile,
      message: `File ${updatedFile.is_starred ? 'starred' : 'unstarred'} successfully` 
    });
  } catch (error) {
    console.error('Error toggling star:', error);
    res.status(500).json({ error: 'Failed to toggle star' });
  }
});

// DELETE /files/:id - Move to trash (soft delete)
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const userEmail = req.user.email;
    
    // Check if user owns the file
    const { data: file, error: fileError } = await supabase
      .from('files')
      .select('*')
      .eq('id', id)
      .eq('owner_email', userEmail)
      .single();
    
    if (fileError || !file) {
      return res.status(404).json({ error: 'File not found' });
    }
    
    // Soft delete
    const { error: deleteError } = await supabase
      .from('files')
      .update({ 
        is_deleted: true, 
        deleted_at: new Date().toISOString() 
      })
      .eq('id', id);
    
    if (deleteError) throw deleteError;
    
    res.json({ 
      success: true, 
      message: 'File moved to trash successfully' 
    });
  } catch (error) {
    console.error('Error deleting file:', error);
    res.status(500).json({ error: 'Failed to delete file' });
  }
});

// POST /files/:id/restore - Restore from trash
router.post('/:id/restore', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const userEmail = req.user.email;
    
    // Check if user owns the file
    const { data: file, error: fileError } = await supabase
      .from('files')
      .select('*')
      .eq('id', id)
      .eq('owner_email', userEmail)
      .eq('is_deleted', true)
      .single();
    
    if (fileError || !file) {
      return res.status(404).json({ error: 'File not found in trash' });
    }
    
    // Check if file is within 30 days
    const deletedDate = new Date(file.deleted_at);
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    if (deletedDate < thirtyDaysAgo) {
      return res.status(400).json({ error: 'File cannot be restored after 30 days' });
    }
    
    // Restore file
    const { error: restoreError } = await supabase
      .from('files')
      .update({ 
        is_deleted: false, 
        deleted_at: null 
      })
      .eq('id', id);
    
    if (restoreError) throw restoreError;
    
    res.json({ 
      success: true, 
      message: 'File restored successfully' 
    });
  } catch (error) {
    console.error('Error restoring file:', error);
    res.status(500).json({ error: 'Failed to restore file' });
  }
});

// DELETE /files/:id/permanent - Permanently delete file
router.delete('/:id/permanent', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const userEmail = req.user.email;
    
    // Check if user owns the file
    const { data: file, error: fileError } = await supabase
      .from('files')
      .select('*')
      .eq('id', id)
      .eq('owner_email', userEmail)
      .eq('is_deleted', true)
      .single();
    
    if (fileError || !file) {
      return res.status(404).json({ error: 'File not found in trash' });
    }
    
    // Delete from storage
    const { error: storageError } = await supabase.storage
      .from('files')
      .remove([file.storage_path]);
    
    if (storageError) {
      console.error('Storage deletion error:', storageError);
    }
    
    // Delete from database
    const { error: deleteError } = await supabase
      .from('files')
      .delete()
      .eq('id', id);
    
    if (deleteError) throw deleteError;
    
    res.json({ 
      success: true, 
      message: 'File permanently deleted' 
    });
  } catch (error) {
    console.error('Error permanently deleting file:', error);
    res.status(500).json({ error: 'Failed to delete file' });
  }
});

// GET /files/trash - Get trash items
router.get('/trash', requireAuth, async (req, res) => {
  try {
    const userEmail = req.user.email;
    const { page = 1, limit = 20 } = req.query;
    
    const offset = (page - 1) * limit;
    
    const { data: files, error, count } = await supabase
      .from('files')
      .select('*')
      .eq('owner_email', userEmail)
      .eq('is_deleted', true)
      .order('deleted_at', { ascending: false })
      .range(offset, offset + limit - 1);
    
    if (error) throw error;
    
    res.json({
      files,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: count || files.length,
        pages: Math.ceil((count || files.length) / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching trash:', error);
    res.status(500).json({ error: 'Failed to fetch trash' });
  }
});

export default router;


