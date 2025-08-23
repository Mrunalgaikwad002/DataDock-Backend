import { Router } from 'express';
import { supabase } from '../config/supabase.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { getPermittedIds } from '../utils/permissions.js';

const router = Router();

// POST /share/user - Share with specific user
router.post('/user', requireAuth, async (req, res) => {
  try {
    const { resourceId, resourceType, userEmail, permissionType } = req.body;
    const grantedBy = req.user.email;
    
    if (!resourceId || !resourceType || !userEmail || !permissionType) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    if (!['file', 'folder'].includes(resourceType)) {
      return res.status(400).json({ error: 'Invalid resource type' });
    }
    
    if (!['viewer', 'editor', 'admin'].includes(permissionType)) {
      return res.status(400).json({ error: 'Invalid permission type' });
    }
    
    // Check if resource exists and user owns it
    const tableName = resourceType === 'file' ? 'files' : 'folders';
    const { data: resource, error: resourceError } = await supabase
      .from(tableName)
      .select('*')
      .eq('id', resourceId)
      .eq('owner_email', grantedBy)
      .single();
    
    if (resourceError || !resource) {
      return res.status(404).json({ error: 'Resource not found' });
    }
    
    // Check if permission already exists
    const { data: existingPermission, error: checkError } = await supabase
      .from('permissions')
      .select('*')
      .eq('resource_id', resourceId)
      .eq('resource_type', resourceType)
      .eq('user_email', userEmail)
      .single();
    
    if (checkError && checkError.code !== 'PGRST116') {
      throw checkError;
    }
    
    if (existingPermission) {
      // Update existing permission
      const { data: updatedPermission, error: updateError } = await supabase
        .from('permissions')
        .update({ 
          permission_type: permissionType,
          granted_by: grantedBy
        })
        .eq('id', existingPermission.id)
        .select()
        .single();
      
      if (updateError) throw updateError;
      
      res.json({ 
        success: true, 
        permission: updatedPermission,
        message: 'Permission updated successfully' 
      });
    } else {
      // Create new permission
      const { data: newPermission, error: createError } = await supabase
        .from('permissions')
        .insert([{
          resource_id: resourceId,
          resource_type: resourceType,
          user_email: userEmail,
          permission_type: permissionType,
          granted_by: grantedBy
        }])
        .select()
        .single();
      
      if (createError) throw createError;
      
      res.json({ 
        success: true, 
        permission: newPermission,
        message: 'Permission granted successfully' 
      });
    }
  } catch (error) {
    console.error('Error sharing resource:', error);
    res.status(500).json({ error: 'Failed to share resource' });
  }
});

// DELETE /share/user/:id - Remove user permission
router.delete('/user/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const grantedBy = req.user.email;
    
    // Check if permission exists and user granted it
    const { data: permission, error: permissionError } = await supabase
      .from('permissions')
      .select('*')
      .eq('id', id)
      .eq('granted_by', grantedBy)
      .single();
    
    if (permissionError || !permission) {
      return res.status(404).json({ error: 'Permission not found' });
    }
    
    // Delete permission
    const { error: deleteError } = await supabase
      .from('permissions')
      .delete()
      .eq('id', id);
    
    if (deleteError) throw deleteError;
    
    res.json({ 
      success: true, 
      message: 'Permission removed successfully' 
    });
  } catch (error) {
    console.error('Error removing permission:', error);
    res.status(500).json({ error: 'Failed to remove permission' });
  }
});

// GET /share/user/:resourceId - Get users with access to resource
router.get('/user/:resourceId', requireAuth, async (req, res) => {
  try {
    const { resourceId } = req.params;
    const { resourceType } = req.query;
    const userEmail = req.user.email;
    
    if (!resourceType || !['file', 'folder'].includes(resourceType)) {
      return res.status(400).json({ error: 'Invalid resource type' });
    }
    
    // Check if user owns the resource
    const tableName = resourceType === 'file' ? 'files' : 'folders';
    const { data: resource, error: resourceError } = await supabase
      .from(tableName)
      .select('*')
      .eq('id', resourceId)
      .eq('owner_email', userEmail)
      .single();
    
    if (resourceError || !resource) {
      return res.status(404).json({ error: 'Resource not found' });
    }
    
    // Get all permissions for this resource
    const { data: permissions, error: permissionsError } = await supabase
      .from('permissions')
      .select('*')
      .eq('resource_id', resourceId)
      .eq('resource_type', resourceType);
    
    if (permissionsError) throw permissionsError;
    
    res.json({ permissions: permissions || [] });
  } catch (error) {
    console.error('Error fetching permissions:', error);
    res.status(500).json({ error: 'Failed to fetch permissions' });
  }
});

// POST /share/link - Create public share link
router.post('/link', requireAuth, async (req, res) => {
  try {
    const { resourceId, resourceType, expiresAt, maxAccesses } = req.body;
    const createdBy = req.user.email;
    
    if (!resourceId || !resourceType) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    if (!['file', 'folder'].includes(resourceType)) {
      return res.status(400).json({ error: 'Invalid resource type' });
    }
    
    // Check if resource exists and user owns it
    const tableName = resourceType === 'file' ? 'files' : 'folders';
    const { data: resource, error: resourceError } = await supabase
      .from(tableName)
      .select('*')
      .eq('id', resourceId)
      .eq('owner_email', createdBy)
      .single();
    
    if (resourceError || !resource) {
      return res.status(404).json({ error: 'Resource not found' });
    }
    
    // Generate unique link token
    const linkToken = crypto.randomUUID();
    
    // Create shared link
    const { data: sharedLink, error: createError } = await supabase
      .from('shared_links')
      .insert([{
        resource_id: resourceId,
        resource_type: resourceType,
        link_token: linkToken,
        expires_at: expiresAt || null,
        max_accesses: maxAccesses || null,
        created_by: createdBy
      }])
      .select()
      .single();
    
    if (createError) throw createError;
    
    // Generate the public URL
    const publicUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/shared/${linkToken}`;
    
    res.json({ 
      success: true, 
      sharedLink: {
        ...sharedLink,
        publicUrl
      },
      message: 'Public link created successfully' 
    });
  } catch (error) {
    console.error('Error creating shared link:', error);
    res.status(500).json({ error: 'Failed to create shared link' });
  }
});

// GET /share/link/:token - Access shared resource via token
router.get('/link/:token', async (req, res) => {
  try {
    const { token } = req.params;
    
    // Get shared link
    const { data: sharedLink, error: linkError } = await supabase
      .from('shared_links')
      .select('*')
      .eq('link_token', token)
      .single();
    
    if (linkError || !sharedLink) {
      return res.status(404).json({ error: 'Shared link not found' });
    }
    
    // Check if link has expired
    if (sharedLink.expires_at && new Date(sharedLink.expires_at) < new Date()) {
      return res.status(410).json({ error: 'Shared link has expired' });
    }
    
    // Check if max accesses reached
    if (sharedLink.max_accesses && sharedLink.access_count >= sharedLink.max_accesses) {
      return res.status(410).json({ error: 'Shared link access limit reached' });
    }
    
    // Increment access count
    await supabase
      .from('shared_links')
      .update({ access_count: sharedLink.access_count + 1 })
      .eq('id', sharedLink.id);
    
    // Get resource details
    const tableName = sharedLink.resource_type === 'file' ? 'files' : 'folders';
    const { data: resource, error: resourceError } = await supabase
      .from(tableName)
      .select('*')
      .eq('id', sharedLink.resource_id)
      .single();
    
    if (resourceError || !resource) {
      return res.status(404).json({ error: 'Resource not found' });
    }
    
    // For files, check if they're not deleted
    if (sharedLink.resource_type === 'file' && resource.is_deleted) {
      return res.status(404).json({ error: 'File not found' });
    }
    
    res.json({ 
      resource,
      sharedLink: {
        ...sharedLink,
        access_count: sharedLink.access_count + 1
      }
    });
  } catch (error) {
    console.error('Error accessing shared link:', error);
    res.status(500).json({ error: 'Failed to access shared link' });
  }
});

// DELETE /share/link/:id - Delete shared link
router.delete('/link/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const createdBy = req.user.email;
    
    // Check if shared link exists and user created it
    const { data: sharedLink, error: linkError } = await supabase
      .from('shared_links')
      .select('*')
      .eq('id', id)
      .eq('created_by', createdBy)
      .single();
    
    if (linkError || !sharedLink) {
      return res.status(404).json({ error: 'Shared link not found' });
    }
    
    // Delete shared link
    const { error: deleteError } = await supabase
      .from('shared_links')
      .delete()
      .eq('id', id);
    
    if (deleteError) throw deleteError;
    
    res.json({ 
      success: true, 
      message: 'Shared link deleted successfully' 
    });
  } catch (error) {
    console.error('Error deleting shared link:', error);
    res.status(500).json({ error: 'Failed to delete shared link' });
  }
});

// GET /share/links - Get user's shared links
router.get('/links', requireAuth, async (req, res) => {
  try {
    const createdBy = req.user.email;
    const { page = 1, limit = 20 } = req.query;
    
    const offset = (page - 1) * limit;
    
    const { data: sharedLinks, error, count } = await supabase
      .from('shared_links')
      .select('*')
      .eq('created_by', createdBy)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);
    
    if (error) throw error;
    
    // Add public URLs to each link
    const linksWithUrls = (sharedLinks || []).map(link => ({
      ...link,
      publicUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/shared/${link.link_token}`
    }));
    
    res.json({
      sharedLinks: linksWithUrls,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: count || linksWithUrls.length,
        pages: Math.ceil((count || linksWithUrls.length) / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching shared links:', error);
    res.status(500).json({ error: 'Failed to fetch shared links' });
  }
});

export default router;


