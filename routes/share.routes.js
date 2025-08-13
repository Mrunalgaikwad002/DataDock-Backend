import { Router } from 'express';
import { supabase } from '../config/supabase.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { hasPermission } from '../utils/permissions.js';

const router = Router();

// Create shareable link (owner/editor can generate)
router.post('/share', requireAuth, async (req, res) => {
  try {
    const { resourceType, resourceId, role = 'viewer', expiresInSeconds = 3600 } = req.body || {};
    if (!resourceType || !resourceId) return res.status(400).json({ error: 'resourceType and resourceId are required' });

    // Only owner can generate links in this simple model
    const { allowed } = await hasPermission(req.user.email, resourceType, resourceId, 'owner');
    if (!allowed) return res.status(403).json({ error: 'forbidden' });

    const expires_at = new Date(Date.now() + expiresInSeconds * 1000).toISOString();
    const insert = { resource_type: resourceType, resource_id: resourceId, role, expires_at };
    const { data, error } = await supabase.from('shared_links').insert([insert]).select('*').single();
    if (error) return res.status(400).json({ error: error.message });
    res.status(201).json({ token: data.token, expires_at: data.expires_at });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Error creating share link:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Resolve share token (public)
router.get('/share/:token', async (req, res) => {
  try {
    const { data: link, error } = await supabase
      .from('shared_links')
      .select('*')
      .eq('token', req.params.token)
      .gt('expires_at', new Date().toISOString())
      .single();
    if (error || !link) return res.status(404).json({ error: 'link not found or expired' });

    if (link.resource_type === 'file') {
      // Return signed URL for convenience (view role)
      const { data: file } = await supabase.from('files').select('path').eq('id', link.resource_id).single();
      if (!file) return res.status(404).json({ error: 'file not found' });
      const { data: signed } = await supabase.storage
        .from(process.env.SUPABASE_BUCKET || 'my-bucket')
        .createSignedUrl(file.path, 60 * 10);
      return res.json({ type: 'file', url: signed?.signedUrl, role: link.role });
    }
    return res.json({ type: 'folder', id: link.resource_id, role: link.role });
  } catch (error) {
    console.error('Error resolving share link:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Grant permission to a user (owner only)
router.post('/permissions', requireAuth, async (req, res) => {
  try {
    const { resourceType, resourceId, granteeEmail, role } = req.body || {};
    if (!resourceType || !resourceId || !granteeEmail || !role)
      return res.status(400).json({ error: 'resourceType, resourceId, granteeEmail, role required' });
    const { allowed } = await hasPermission(req.user.email, resourceType, resourceId, 'owner');
    if (!allowed) return res.status(403).json({ error: 'forbidden' });
    const up = { resource_type: resourceType, resource_id: resourceId, grantee_email: granteeEmail, role };
    const { error } = await supabase.from('permissions').upsert(up, { onConflict: 'resource_type,resource_id,grantee_email' });
    if (error) return res.status(400).json({ error: error.message });
    res.status(201).json({ success: true });
  } catch (error) {
    console.error('Error granting permission:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;


