import { Router } from 'express';
import multer from 'multer';
import { supabase } from '../config/supabase.js';
import { SUPABASE_BUCKET } from '../config/env.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { hasPermission } from '../utils/permissions.js';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

// STORAGE — Upload File
router.post('/upload', requireAuth, upload.single('file'), async (req, res) => {
  try {
    const file = req.file;
    if (!file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    const path = `uploads/${Date.now()}-${file.originalname}`;
    const { data, error } = await supabase.storage
      .from(SUPABASE_BUCKET)
      .upload(path, file.buffer, { contentType: file.mimetype });
    if (error) return res.status(400).json({ error: error.message });
    // Save file metadata to DB (Day 3)
    // If uploading into a folder, ensure editor permission
    const folderId = req.body?.folderId || null;
    if (folderId) {
      const { allowed } = await hasPermission(req.user.email, 'folder', folderId, 'editor');
      if (!allowed) return res.status(403).json({ error: 'forbidden' });
    }

    const insert = {
      name: file.originalname,
      path: data.path,
      mime_type: file.mimetype,
      size: file.size,
      folder_id: folderId,
      owner_email: req.user.email,
    };
    const { data: row, error: dbErr } = await supabase
      .from('files')
      .insert([insert])
      .select('*')
      .single();
    if (dbErr) return res.status(400).json({ error: dbErr.message });

    res.json({ path: data.path, file: row });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Error uploading file:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// STORAGE — List Files
router.get('/files', requireAuth, async (_req, res) => {
  try {
    const { data, error } = await supabase.storage.from(SUPABASE_BUCKET).list('uploads');
    if (error) return res.status(400).json({ error: error.message });
    res.json(data);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Error listing files:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// STORAGE — Delete File
router.delete('/files/:fileName', requireAuth, async (req, res) => {
  try {
    const { fileName } = req.params;
    if (!fileName) return res.status(400).json({ error: 'fileName is required' });
    const filePath = `uploads/${fileName}`;
    const { data, error } = await supabase.storage.from(SUPABASE_BUCKET).remove([filePath]);
    if (error) return res.status(400).json({ error: error.message });
    res.json({ deleted: data });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Error deleting file:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

// Day 3: list file metadata from DB
router.get('/files/meta', requireAuth, async (req, res) => {
  try {
    const folderId = req.query.folderId || null;
    let q = supabase
      .from('files')
      .select('*')
      .eq('owner_email', req.user.email)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });
    if (folderId) q = q.eq('folder_id', folderId);
    const { data, error } = await q;
    if (error) return res.status(400).json({ error: error.message });
    res.json(data);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Error fetching file metadata:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});


