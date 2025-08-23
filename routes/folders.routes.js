import { Router } from 'express';
import multer from 'multer';
import { supabase } from '../config/supabase.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { getPermittedIds } from '../utils/permissions.js';
import { SUPABASE_BUCKET } from '../config/env.js';

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB limit
  },
});

const router = Router();

// GET /folders - Get folders with pagination, search, and filtering
router.get('/', requireAuth, async (req, res) => {
  try {
    const { page = 1, limit = 20, parentId, search, sortBy = 'name', sortOrder = 'asc', starred } = req.query;
    const userEmail = req.user.email;
    
    let query = supabase
      .from('folders')
      .select('*');
    
    // Filter by parent folder
    if (parentId && parentId !== 'null') {
      query = query.eq('parent_id', parentId);
    } else {
      query = query.is('parent_id', null);
    }
    
    // Filter by owner or shared permissions
    const permittedIds = await getPermittedIds(userEmail, 'folder');
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
    const orderColumn = sortBy === 'date' ? 'created_at' : 'name';
    query = query.order(orderColumn, { ascending: sortOrder === 'asc' });
    
    // Pagination
    const offset = (page - 1) * limit;
    query = query.range(offset, offset + limit - 1);
    
    const { data: folders, error, count } = await query;
    
    if (error) throw error;
    
    res.json({
      folders,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: count || folders.length,
        pages: Math.ceil((count || folders.length) / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching folders:', error);
    res.status(500).json({ error: 'Failed to fetch folders' });
  }
});

// POST /folders - Create new folder
router.post('/', requireAuth, async (req, res) => {
  try {
    const { name, parentId } = req.body;
    const userEmail = req.user.email;
    
    if (!name) {
      return res.status(400).json({ error: 'Folder name is required' });
    }
    
    // Check if parent folder exists and user has access
    if (parentId) {
      const { data: parentFolder, error: parentError } = await supabase
        .from('folders')
        .select('*')
        .eq('id', parentId)
        .single();
      
      if (parentError || !parentFolder) {
        return res.status(404).json({ error: 'Parent folder not found' });
      }
      
      // Check if user owns parent or has permission
      if (parentFolder.owner_email !== userEmail) {
        const permittedIds = await getPermittedIds(userEmail, 'folder');
        if (!permittedIds.includes(parentId)) {
          return res.status(403).json({ error: 'Access denied to parent folder' });
        }
      }
    }
    
    // Create folder
    const { data: folder, error } = await supabase
      .from('folders')
      .insert([{
        name,
        parent_id: parentId || null,
        owner_email: userEmail
      }])
      .select()
      .single();
    
    if (error) throw error;
    
    res.json({ 
      success: true, 
      folder,
      message: 'Folder created successfully' 
    });
  } catch (error) {
    console.error('Error creating folder:', error);
    res.status(500).json({ error: 'Failed to create folder' });
  }
});

// POST /folders/import - Import local folder structure
router.post('/import', requireAuth, upload.array('files', 100), async (req, res) => {
  try {
    let { name, parentId, structure, importMode = 'structure' } = req.body;
    const userEmail = req.user.email;
    
    // Handle FormData for file uploads
    let uploadedFiles = [];
    if (req.headers['content-type'] && req.headers['content-type'].includes('multipart/form-data')) {
      // Parse structure from JSON string
      if (typeof structure === 'string') {
        structure = JSON.parse(structure);
      }
      
      // Handle file uploads
      if (importMode === 'files' && req.files && req.files.length > 0) {
        console.log('Files received:', req.files.map(f => f.originalname));
        console.log('Body keys:', Object.keys(req.body));
        console.log('FileInfo from body:', req.body.fileInfo);
        
        // Get file info from FormData
        const fileInfos = [];
        if (req.body.fileInfo) {
          // Handle single fileInfo
          if (Array.isArray(req.body.fileInfo)) {
            fileInfos.push(...req.body.fileInfo.map(info => JSON.parse(info)));
          } else {
            fileInfos.push(JSON.parse(req.body.fileInfo));
          }
        }
        
        console.log('Parsed fileInfos:', fileInfos);
        
        for (let i = 0; i < req.files.length; i++) {
          const file = req.files[i];
          const fileInfo = fileInfos[i] || { name: file.originalname, path: file.originalname };
          
          try {
            // Upload file to Supabase storage
            const fileName = `${Date.now()}-${file.originalname}`;
            let storagePath = fileName;
            let downloadUrl = null;
            
            try {
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
                // Continue without storage upload, just create database record
              } else {
                // Get public URL
                const { data: { publicUrl } } = supabase.storage
                  .from(SUPABASE_BUCKET)
                  .getPublicUrl(fileName);
                downloadUrl = publicUrl;
              }
            } catch (storageError) {
              console.error(`Error uploading file ${file.originalname}:`, storageError);
              // Continue without storage upload, just create database record
            }

            uploadedFiles.push({
              name: fileInfo.name || file.originalname,
              path: fileInfo.path || file.originalname, // For matching with structure
              content: file.buffer,
              size: file.size,
              mimeType: file.mimetype,
              storagePath: storagePath,
              downloadUrl: downloadUrl
            });
          } catch (error) {
            console.error(`Error processing uploaded file ${file.originalname}:`, error);
          }
        }
      }
    }
    
    if (!name || !structure) {
      return res.status(400).json({ error: 'Folder name and structure are required' });
    }
    
    // Check if parent folder exists and user has access
    if (parentId) {
      const { data: parentFolder, error: parentError } = await supabase
        .from('folders')
        .select('*')
        .eq('id', parentId)
        .single();
      
      if (parentError || !parentFolder) {
        return res.status(404).json({ error: 'Parent folder not found' });
      }
      
      if (parentFolder.owner_email !== userEmail) {
        const permittedIds = await getPermittedIds(userEmail, 'folder');
        if (!permittedIds.includes(parentId)) {
          return res.status(403).json({ error: 'Access denied to parent folder' });
        }
      }
    }
    
    // Create main folder
    const { data: mainFolder, error: mainFolderError } = await supabase
      .from('folders')
      .insert([{
        name,
        parent_id: parentId || null,
        owner_email: userEmail
      }])
      .select()
      .single();
    
    if (mainFolderError) throw mainFolderError;
    
    if (importMode === 'files') {
      // Import folder structure and files
      const { importedFolders, importedFiles } = await importFolderStructureWithFiles(structure, mainFolder.id, userEmail, uploadedFiles);
      
      // Also create files directly in the main folder
      const directFiles = [];
      for (const uploadedFile of uploadedFiles) {
        try {
                     const { data: file, error: fileError } = await supabase
             .from('files')
             .insert([{
               name: uploadedFile.name,
               folder_id: mainFolder.id,
               owner_email: userEmail,
               size: uploadedFile.size,
               mime_type: uploadedFile.mimeType,
               original_name: uploadedFile.name,
               path: uploadedFile.path || uploadedFile.name, // Ensure path is provided
               storage_path: uploadedFile.storagePath
               // download_url: uploadedFile.downloadUrl // Commented out until schema is updated
             }])
             .select()
             .single();
          
          if (fileError) {
            console.error(`Error creating direct file record ${uploadedFile.name}:`, fileError);
          } else {
            directFiles.push(file);
          }
        } catch (error) {
          console.error(`Error processing direct file ${uploadedFile.name}:`, error);
        }
      }
      
      res.json({ 
        success: true, 
        folder: mainFolder,
        importedFolders,
        importedFiles: [...importedFiles, ...directFiles],
        message: 'Folder structure and files imported successfully' 
      });
    } else {
      // Import folder structure only
      const importedFolders = await importFolderStructure(structure, mainFolder.id, userEmail);
      
      res.json({ 
        success: true, 
        folder: mainFolder,
        importedFolders,
        message: 'Folder structure imported successfully' 
      });
    }
  } catch (error) {
    console.error('Error importing folder structure:', error);
    res.status(500).json({ error: 'Failed to import folder structure' });
  }
});

// Helper function to recursively import folder structure
async function importFolderStructure(structure, parentId, userEmail) {
  const importedFolders = [];
  
  for (const item of structure) {
    try {
      if (item.type === 'folder') {
        // Create subfolder
        const { data: subfolder, error: subfolderError } = await supabase
          .from('folders')
          .insert([{
            name: item.name,
            parent_id: parentId,
            owner_email: userEmail
          }])
          .select()
          .single();
        
        if (subfolderError) {
          console.error(`Error creating subfolder ${item.name}:`, subfolderError);
          continue;
        }
        
        importedFolders.push(subfolder);
        
        // Recursively import nested structure if it exists
        if (item.contents && item.contents.length > 0) {
          const nestedFolders = await importFolderStructure(item.contents, subfolder.id, userEmail);
          importedFolders.push(...nestedFolders);
        }
      }
      // Note: File import would be handled separately in a real implementation
    } catch (error) {
      console.error(`Error processing item ${item.name}:`, error);
    }
  }
  
  return importedFolders;
}

// Helper function to recursively import folder structure with files
async function importFolderStructureWithFiles(structure, parentId, userEmail, files = null) {
  const importedFolders = [];
  const importedFiles = [];
  
  for (const item of structure) {
    try {
      if (item.type === 'folder') {
        // Create subfolder
        const { data: subfolder, error: subfolderError } = await supabase
          .from('folders')
          .insert([{
            name: item.name,
            parent_id: parentId,
            owner_email: userEmail
          }])
          .select()
          .single();
        
        if (subfolderError) {
          console.error(`Error creating subfolder ${item.name}:`, subfolderError);
          continue;
        }
        
        importedFolders.push(subfolder);
        
        // Recursively import nested structure if it exists
        if (item.contents && item.contents.length > 0) {
          const { nestedFolders, nestedFiles } = await importFolderStructureWithFiles(item.contents, subfolder.id, userEmail, files);
          importedFolders.push(...nestedFolders);
          importedFiles.push(...nestedFiles);
        }
      } else if (item.type === 'file') {
        // Find the actual file data from the uploaded files array
        let fileData = null;
        if (files && Array.isArray(files)) {
          console.log(`Looking for file: ${item.name}`);
          console.log('Available files:', files.map(f => f.name));
          fileData = files.find(f => f.name === item.name);
          console.log('Found fileData:', fileData ? 'Yes' : 'No');
        }
        
        if (fileData && fileData.storagePath) {
          // File was already uploaded to storage, just create database record
          try {
                         const { data: file, error: fileError } = await supabase
               .from('files')
               .insert([{
                 name: item.name,
                 folder_id: parentId,
                 owner_email: userEmail,
                 size: fileData.size || item.size || 0,
                 mime_type: fileData.mimeType || item.mimeType || 'application/octet-stream',
                 original_name: item.name,
                 path: item.path || item.name, // Ensure path is provided
                 storage_path: fileData.storagePath
                 // download_url: fileData.downloadUrl // Commented out until schema is updated
               }])
               .select()
               .single();
            
            if (fileError) {
              console.error(`Error creating file record ${item.name}:`, fileError);
            } else {
              importedFiles.push(file);
            }
          } catch (fileError) {
            console.error(`Error processing file ${item.name}:`, fileError);
          }
        } else {
          // Create file record without content (for structure-only import)
          try {
                         const { data: file, error: fileError } = await supabase
               .from('files')
               .insert([{
                 name: item.name,
                 folder_id: parentId,
                 owner_email: userEmail,
                 size: item.size || 0,
                 mime_type: item.mimeType || 'application/octet-stream',
                 original_name: item.name,
                 path: item.path || item.name // Ensure path is provided
               }])
               .select()
               .single();
            
            if (fileError) {
              console.error(`Error creating file record ${item.name}:`, fileError);
            } else {
              importedFiles.push(file);
            }
          } catch (fileError) {
            console.error(`Error processing file ${item.name}:`, fileError);
          }
        }
      }
    } catch (error) {
      console.error(`Error processing item ${item.name}:`, error);
    }
  }
  
  return { importedFolders, importedFiles };
}

// GET /folders/:id/breadcrumbs - Get folder breadcrumbs
router.get('/:id/breadcrumbs', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const userEmail = req.user.email;
    
    // Check if user has access to this folder
    const { data: folder, error: folderError } = await supabase
      .from('folders')
      .select('*')
      .eq('id', id)
      .single();
    
    if (folderError || !folder) {
      return res.status(404).json({ error: 'Folder not found' });
    }
    
    if (folder.owner_email !== userEmail) {
      const permittedIds = await getPermittedIds(userEmail, 'folder');
      if (!permittedIds.includes(id)) {
        return res.status(403).json({ error: 'Access denied' });
      }
    }
    
    // Build breadcrumbs
    const breadcrumbs = [];
    let currentFolder = folder;
    
    while (currentFolder) {
      breadcrumbs.unshift({
        id: currentFolder.id,
        name: currentFolder.name
      });
      
      if (currentFolder.parent_id) {
        const { data: parent, error: parentError } = await supabase
          .from('folders')
          .select('*')
          .eq('id', currentFolder.parent_id)
          .single();
        
        if (parentError) break;
        currentFolder = parent;
      } else {
        break;
      }
    }
    
    res.json({ breadcrumbs });
  } catch (error) {
    console.error('Error fetching breadcrumbs:', error);
    res.status(500).json({ error: 'Failed to fetch breadcrumbs' });
  }
});

// PUT /folders/:id/star - Toggle star status
router.put('/:id/star', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const userEmail = req.user.email;
    
    // Get current folder
    const { data: folder, error: folderError } = await supabase
      .from('folders')
      .select('*')
      .eq('id', id)
      .eq('owner_email', userEmail)
      .single();
    
    if (folderError || !folder) {
      return res.status(404).json({ error: 'Folder not found' });
    }
    
    // Toggle star status
    const { data: updatedFolder, error: updateError } = await supabase
      .from('folders')
      .update({ is_starred: !folder.is_starred })
      .eq('id', id)
      .select()
      .single();
    
    if (updateError) throw updateError;
    
    res.json({ 
      success: true, 
      folder: updatedFolder,
      message: `Folder ${updatedFolder.is_starred ? 'starred' : 'unstarred'} successfully` 
    });
  } catch (error) {
    console.error('Error toggling star:', error);
    res.status(500).json({ error: 'Failed to toggle star' });
  }
});

// PUT /folders/:id/move - Move folder to different parent
router.put('/:id/move', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { newParentId } = req.body;
    const userEmail = req.user.email;
    
    // Get current folder
    const { data: folder, error: folderError } = await supabase
      .from('folders')
      .select('*')
      .eq('id', id)
      .eq('owner_email', userEmail)
      .single();
    
    if (folderError || !folder) {
      return res.status(404).json({ error: 'Folder not found' });
    }
    
    // Check if new parent exists and user has access
    if (newParentId) {
      const { data: newParent, error: parentError } = await supabase
        .from('folders')
        .select('*')
        .eq('id', newParentId)
        .single();
      
      if (parentError || !newParent) {
        return res.status(404).json({ error: 'New parent folder not found' });
      }
      
      if (newParent.owner_email !== userEmail) {
        const permittedIds = await getPermittedIds(userEmail, 'folder');
        if (!permittedIds.includes(newParentId)) {
          return res.status(403).json({ error: 'Access denied to new parent folder' });
        }
      }
      
      // Prevent circular reference
      if (newParentId === id) {
        return res.status(400).json({ error: 'Cannot move folder into itself' });
      }
    }
    
    // Move folder
    const { data: updatedFolder, error: updateError } = await supabase
      .from('folders')
      .update({ 
        parent_id: newParentId || null,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();
    
    if (updateError) throw updateError;
    
    res.json({ 
      success: true, 
      folder: updatedFolder,
      message: 'Folder moved successfully' 
    });
  } catch (error) {
    console.error('Error moving folder:', error);
    res.status(500).json({ error: 'Failed to move folder' });
  }
});

// PUT /folders/:id/rename - Rename folder
router.put('/:id/rename', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;
    const userEmail = req.user.email;
    
    if (!name) {
      return res.status(400).json({ error: 'Folder name is required' });
    }
    
    // Get current folder
    const { data: folder, error: folderError } = await supabase
      .from('folders')
      .select('*')
      .eq('id', id)
      .eq('owner_email', userEmail)
      .single();
    
    if (folderError || !folder) {
      return res.status(404).json({ error: 'Folder not found' });
    }
    
    // Rename folder
    const { data: updatedFolder, error: updateError } = await supabase
      .from('folders')
      .update({ 
        name,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();
    
    if (updateError) throw updateError;
    
    res.json({ 
      success: true, 
      folder: updatedFolder,
      message: 'Folder renamed successfully' 
    });
  } catch (error) {
    console.error('Error renaming folder:', error);
    res.status(500).json({ error: 'Failed to rename folder' });
  }
});

// DELETE /folders/:id - Delete folder (moves contents to trash)
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const userEmail = req.user.email;
    
    // Get current folder
    const { data: folder, error: folderError } = await supabase
      .from('folders')
      .select('*')
      .eq('id', id)
      .eq('owner_email', userEmail)
      .single();
    
    if (folderError || !folder) {
      return res.status(404).json({ error: 'Folder not found' });
    }
    
    // Move all files in this folder to trash
    const { error: filesError } = await supabase
      .from('files')
      .update({ 
        is_deleted: true, 
        deleted_at: new Date().toISOString() 
      })
      .eq('folder_id', id)
      .eq('owner_email', userEmail);
    
    if (filesError) {
      console.error('Error moving files to trash:', filesError);
    }
    
    // Delete folder
    const { error: deleteError } = await supabase
      .from('folders')
      .delete()
      .eq('id', id);
    
    if (deleteError) throw deleteError;
    
    res.json({ 
      success: true, 
      message: 'Folder deleted successfully' 
    });
  } catch (error) {
    console.error('Error deleting folder:', error);
    res.status(500).json({ error: 'Failed to delete folder' });
  }
});

// GET /folders/starred - Get starred folders
router.get('/starred', requireAuth, async (req, res) => {
  try {
    const userEmail = req.user.email;
    const { page = 1, limit = 20 } = req.query;
    
    const offset = (page - 1) * limit;
    
    const { data: folders, error, count } = await supabase
      .from('folders')
      .select('*')
      .eq('owner_email', userEmail)
      .eq('is_starred', true)
      .order('updated_at', { ascending: false })
      .range(offset, offset + limit - 1);
    
    if (error) throw error;
    
    res.json({
      folders,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: count || folders.length,
        pages: Math.ceil((count || folders.length) / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching starred folders:', error);
    res.status(500).json({ error: 'Failed to fetch starred folders' });
  }
});

export default router;


