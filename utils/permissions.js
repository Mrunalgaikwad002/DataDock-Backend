import { supabase } from '../config/supabase.js';

// Check if user has permission for a specific resource
export const hasPermission = async (userEmail, resourceType, resourceId, requiredPermission = 'viewer') => {
  try {
    // First check if user owns the resource
    const tableName = resourceType === 'file' ? 'files' : 'folders';
    const { data: resource, error: resourceError } = await supabase
      .from(tableName)
      .select('owner_email')
      .eq('id', resourceId)
      .single();
    
    if (resourceError) {
      return { allowed: false, reason: 'Resource not found' };
    }
    
    if (resource.owner_email === userEmail) {
      return { allowed: true, permission: 'owner' };
    }
    
    // Check shared permissions
    const { data: permission, error: permissionError } = await supabase
      .from('permissions')
      .select('permission_type')
      .eq('resource_id', resourceId)
      .eq('resource_type', resourceType)
      .eq('user_email', userEmail)
      .single();
    
    if (permissionError || !permission) {
      return { allowed: false, reason: 'No permission found' };
    }
    
    // Check permission hierarchy
    const permissionHierarchy = {
      'viewer': 1,
      'editor': 2,
      'admin': 3,
      'owner': 4
    };
    
    const userPermissionLevel = permissionHierarchy[permission.permission_type] || 0;
    const requiredPermissionLevel = permissionHierarchy[requiredPermission] || 0;
    
    return {
      allowed: userPermissionLevel >= requiredPermissionLevel,
      permission: permission.permission_type
    };
  } catch (error) {
    console.error('Error checking permission:', error);
    return { allowed: false, reason: 'Error checking permission' };
  }
};

// Get all resource IDs that a user has permission to access
export const getPermittedIds = async (userEmail, resourceType, requiredPermission = 'viewer') => {
  try {
    // Get owned resources
    const tableName = resourceType === 'file' ? 'files' : 'folders';
    const { data: ownedResources, error: ownedError } = await supabase
      .from(tableName)
      .select('id')
      .eq('owner_email', userEmail);
    
    if (ownedError) {
      console.error('Error fetching owned resources:', ownedError);
      return [];
    }
    
    const ownedIds = (ownedResources || []).map(r => r.id);
    
    // Get shared resources
    const { data: sharedPermissions, error: sharedError } = await supabase
      .from('permissions')
      .select('resource_id, permission_type')
      .eq('resource_type', resourceType)
      .eq('user_email', userEmail);
    
    if (sharedError) {
      console.error('Error fetching shared permissions:', sharedError);
      return ownedIds;
    }
    
    // Filter by permission level
    const permissionHierarchy = {
      'viewer': 1,
      'editor': 2,
      'admin': 3
    };
    
    const requiredLevel = permissionHierarchy[requiredPermission] || 0;
    const permittedSharedIds = (sharedPermissions || [])
      .filter(p => (permissionHierarchy[p.permission_type] || 0) >= requiredLevel)
      .map(p => p.resource_id);
    
    return [...ownedIds, ...permittedSharedIds];
  } catch (error) {
    console.error('Error getting permitted IDs:', error);
    return [];
  }
};

// Check if user can perform write operations on a resource
export const canWrite = async (userEmail, resourceType, resourceId) => {
  const result = await hasPermission(userEmail, resourceType, resourceId, 'editor');
  return result.allowed;
};

// Check if user can delete a resource
export const canDelete = async (userEmail, resourceType, resourceId) => {
  const result = await hasPermission(userEmail, resourceType, resourceId, 'admin');
  return result.allowed;
};

// Get user's permission level for a resource
export const getPermissionLevel = async (userEmail, resourceType, resourceId) => {
  try {
    // Check if user owns the resource
    const tableName = resourceType === 'file' ? 'files' : 'folders';
    const { data: resource, error: resourceError } = await supabase
      .from(tableName)
      .select('owner_email')
      .eq('id', resourceId)
      .single();
    
    if (resourceError) {
      return null;
    }
    
    if (resource.owner_email === userEmail) {
      return 'owner';
    }
    
    // Check shared permissions
    const { data: permission, error: permissionError } = await supabase
      .from('permissions')
      .select('permission_type')
      .eq('resource_id', resourceId)
      .eq('resource_type', resourceType)
      .eq('user_email', userEmail)
      .single();
    
    if (permissionError || !permission) {
      return null;
    }
    
    return permission.permission_type;
  } catch (error) {
    console.error('Error getting permission level:', error);
    return null;
  }
};

// Get all users with access to a resource
export const getResourceUsers = async (resourceType, resourceId) => {
  try {
    const { data: permissions, error } = await supabase
      .from('permissions')
      .select('user_email, permission_type, granted_by, created_at')
      .eq('resource_id', resourceId)
      .eq('resource_type', resourceType);
    
    if (error) {
      console.error('Error fetching resource users:', error);
      return [];
    }
    
    return permissions || [];
  } catch (error) {
    console.error('Error getting resource users:', error);
    return [];
  }
};

// Check if a resource is shared with a specific user
export const isSharedWith = async (resourceType, resourceId, userEmail) => {
  try {
    const { data: permission, error } = await supabase
      .from('permissions')
      .select('permission_type')
      .eq('resource_id', resourceId)
      .eq('resource_type', resourceType)
      .eq('user_email', userEmail)
      .single();
    
    if (error && error.code !== 'PGRST116') {
      console.error('Error checking if resource is shared:', error);
      return false;
    }
    
    return !!permission;
  } catch (error) {
    console.error('Error checking if resource is shared:', error);
    return false;
  }
};


