import { Router } from 'express';
import { supabase } from '../config/supabase.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { hasPermission, getPermittedIds } from '../utils/permissions.js';

const router = Router();

// Create folder
router.post('/folders', requireAuth, async (req, res) => {
  try {
    const { name, parentId } = req.body || {};
    if (!name) return res.status(400).json({ error: 'name is required' });
    if (parentId) {
      const { allowed } = await hasPermission(req.user.email, 'folder', parentId, 'editor');
      if (!allowed) return res.status(403).json({ error: 'forbidden' });
    }
    const insert = {
      name,
      parent_id: parentId || null,
      owner_email: req.user.email,
    };
    const { data, error } = await supabase.from('folders').insert([insert]).select('*').single();
    if (error) return res.status(400).json({ error: error.message });
    res.status(201).json(data);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Error creating folder:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// List folders by parent (null for root)
router.get('/folders', requireAuth, async (req, res) => {
  try {
    const parentId = req.query.parentId || null;
    // Allow listing owned folders and those where the user has at least viewer permission under the parent
    let ownerQ = supabase
      .from('folders')
      .select('*')
      .eq('owner_email', req.user.email)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });
    if (parentId === null || parentId === 'null') ownerQ = ownerQ.is('parent_id', null);
    else ownerQ = ownerQ.eq('parent_id', parentId);

    const permittedIds = await getPermittedIds(req.user.email, 'folder', 'viewer');
    let permQ = supabase
      .from('folders')
      .select('*')
      .in('id', permittedIds.length ? permittedIds : ['00000000-0000-0000-0000-000000000000'])
      .is('deleted_at', null);
    if (parentId === null || parentId === 'null') permQ = permQ.is('parent_id', null);
    else permQ = permQ.eq('parent_id', parentId);

    const [ownerR, permR] = await Promise.all([ownerQ, permQ]);
    if (ownerR.error) return res.status(400).json({ error: ownerR.error.message });
    if (permR.error) return res.status(400).json({ error: permR.error.message });
    const merged = [...(ownerR.data || []), ...(permR.data || [])];
    // de-duplicate by id
    const seen = new Set();
    const data = merged.filter((f) => (seen.has(f.id) ? false : seen.add(f.id)));
    return res.json(data);
  } catch (error) {
    console.error('Error listing folders:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Rename folder
router.patch('/folders/:id/rename', requireAuth, async (req, res) => {
  try {
    const { name } = req.body || {};
    if (!name) return res.status(400).json({ error: 'name is required' });
    const { allowed } = await hasPermission(req.user.email, 'folder', req.params.id, 'editor');
    if (!allowed) return res.status(403).json({ error: 'forbidden' });
    const { data, error } = await supabase
      .from('folders')
      .update({ name, updated_at: new Date().toISOString() })
      .eq('id', req.params.id)
      .eq('owner_email', req.user.email)
      .is('deleted_at', null)
      .select('*')
      .single();
    if (error) return res.status(400).json({ error: error.message });
    res.json(data);
  } catch (error) {
    console.error('Error renaming folder:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Soft delete folder
router.delete('/folders/:id', requireAuth, async (req, res) => {
  try {
    const { allowed } = await hasPermission(req.user.email, 'folder', req.params.id, 'editor');
    if (!allowed) return res.status(403).json({ error: 'forbidden' });
    const { error } = await supabase
      .from('folders')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', req.params.id)
      .eq('owner_email', req.user.email);
    if (error) return res.status(400).json({ error: error.message });
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting folder:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;


