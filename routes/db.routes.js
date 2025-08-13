import { Router } from 'express';
import { supabase } from '../config/supabase.js';
import { requireAuth } from '../middleware/requireAuth.js';

const router = Router();

// DATABASE — Create
router.post('/add-user', requireAuth, async (req, res) => {
  try {
    const { name, number, age } = req.body || {};
    if (!name || !number || !age) {
      return res.status(400).json({ error: 'Name, number, and age are required' });
    }
    const { data, error } = await supabase.from('users').insert([{ name, number, age }]).select();
    if (error) return res.status(400).json({ error: error.message });
    res.json(data);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Error adding user:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DATABASE — Read
router.get('/users', requireAuth, async (_req, res) => {
  try {
    const { data, error } = await supabase.from('users').select('*');
    if (error) return res.status(400).json({ error: error.message });
    res.json(data);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;


