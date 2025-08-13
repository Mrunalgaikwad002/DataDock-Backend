import { supabase } from '../config/supabase.js';

const roleRank = { viewer: 1, editor: 2, owner: 3 };

export async function getResource(resourceType, resourceId) {
  const table = resourceType === 'file' ? 'files' : 'folders';
  const { data, error } = await supabase.from(table).select('*').eq('id', resourceId).single();
  if (error) return { resource: null, error };
  return { resource: data, error: null };
}

export async function hasPermission(userEmail, resourceType, resourceId, requiredRole) {
  const { resource, error } = await getResource(resourceType, resourceId);
  if (error || !resource) return { allowed: false, resource: null };
  if (resource.owner_email === userEmail) return { allowed: true, resource };
  const { data: perm, error: pErr } = await supabase
    .from('permissions')
    .select('role')
    .eq('resource_type', resourceType)
    .eq('resource_id', resourceId)
    .eq('grantee_email', userEmail)
    .maybeSingle();
  if (pErr || !perm) return { allowed: false, resource };
  return { allowed: roleRank[perm.role] >= roleRank[requiredRole], resource };
}

export async function getPermittedIds(userEmail, resourceType, requiredRole = 'viewer') {
  const { data, error } = await supabase
    .from('permissions')
    .select('resource_id, role')
    .eq('resource_type', resourceType)
    .eq('grantee_email', userEmail);
  if (error || !data) return [];
  return data
    .filter((r) => roleRank[r.role] >= roleRank[requiredRole])
    .map((r) => r.resource_id);
}


