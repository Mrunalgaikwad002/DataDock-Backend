import { Router } from 'express';
import { supabase } from '../config/supabase.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { getPagination } from '../utils/pagination.js';

const router = Router();

// Search files and folders by name with pagination (owner only for now)
router.get('/search', requireAuth, async (req, res) => {
  try {
    const q = (req.query.q || '').toString().trim();
    const { from, to, page, pageSize } = getPagination(req.query);
    if (!q) return res.json({ page, pageSize, items: [], total: 0 });

    const filesPromise = supabase
      .from('files')
      .select('id, name, path, mime_type, size, created_at', { count: 'exact' })
      .eq('owner_email', req.user.email)
      .is('deleted_at', null)
      .ilike('name', `%${q}%`)
      .range(from, to);

    const foldersPromise = supabase
      .from('folders')
      .select('id, name, parent_id, created_at', { count: 'exact' })
      .eq('owner_email', req.user.email)
      .is('deleted_at', null)
      .ilike('name', `%${q}%`)
      .range(from, to);

    const [files, folders] = await Promise.all([filesPromise, foldersPromise]);
    if (files.error) return res.status(400).json({ error: files.error.message });
    if (folders.error) return res.status(400).json({ error: folders.error.message });

    const items = [
      ...(files.data || []).map((f) => ({ type: 'file', ...f })),
      ...(folders.data || []).map((f) => ({ type: 'folder', ...f })),
    ];
    const total = (files.count || 0) + (folders.count || 0);
    return res.json({ page, pageSize, total, items });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Error searching:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;


