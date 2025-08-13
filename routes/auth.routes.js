import { Router } from 'express';
import { supabase } from '../config/supabase.js';
import { requireAuth } from '../middleware/requireAuth.js';

const router = Router();

// AUTH — Signup
router.post('/signup', async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) return res.status(400).json({ error: error.message });
    res.json(data);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Error during signup:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// AUTH — Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return res.status(400).json({ error: error.message });
    res.json({ message: 'logged in successfully', data });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Error during login:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

// Extra Day 2 helpers
router.post('/logout', requireAuth, async (_req, res) => {
  // With Supabase tokens managed client-side, logout is a no-op on backend
  return res.json({ success: true });
});

router.get('/me', requireAuth, async (req, res) => {
  return res.json({ user: req.user });
});


