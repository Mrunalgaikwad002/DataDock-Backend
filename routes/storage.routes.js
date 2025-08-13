import { Router } from 'express';
import multer from 'multer';
import { supabase } from '../config/supabase.js';
import { SUPABASE_BUCKET } from '../config/env.js';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

// STORAGE — Upload File
router.post('/upload', upload.single('file'), async (req, res) => {
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
    res.json({ path: data.path });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Error uploading file:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// STORAGE — List Files
router.get('/files', async (_req, res) => {
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
router.delete('/files/:fileName', async (req, res) => {
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


