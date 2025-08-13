import { Router } from 'express';
import { supabase } from '../config/supabase.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { hasPermission } from '../utils/permissions.js';

const router = Router();

// Rename file
router.patch('/files/:id/rename', requireAuth, async (req, res) => {
  try {
    const { name } = req.body || {};
    if (!name) return res.status(400).json({ error: 'name is required' });
    const { allowed } = await hasPermission(req.user.email, 'file', req.params.id, 'editor');
    if (!allowed) return res.status(403).json({ error: 'forbidden' });
    const { data, error } = await supabase
      .from('files')
      .update({ name, updated_at: new Date().toISOString() })
      .eq('id', req.params.id)
      .eq('owner_email', req.user.email)
      .is('deleted_at', null)
      .select('*')
      .single();
    if (error) return res.status(400).json({ error: error.message });
    res.json(data);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Error renaming file:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Soft delete file
router.delete('/files/:id', requireAuth, async (req, res) => {
  try {
    const { allowed } = await hasPermission(req.user.email, 'file', req.params.id, 'editor');
    if (!allowed) return res.status(403).json({ error: 'forbidden' });
    const { error } = await supabase
      .from('files')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', req.params.id)
      .eq('owner_email', req.user.email);
    if (error) return res.status(400).json({ error: error.message });
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting file:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;


