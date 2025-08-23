import { Router } from 'express';
import { supabase } from '../config/supabase.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { getPermittedIds } from '../utils/permissions.js';

const router = Router();

// GET /search - Global search across files and folders
router.get('/', requireAuth, async (req, res) => {
  try {
    const { 
      query, 
      type = 'all', 
      sortBy = 'name', 
      sortOrder = 'asc', 
      starred,
      page = 1, 
      limit = 20 
    } = req.query;
    const userEmail = req.user.email;
    
    if (!query || query.trim().length === 0) {
      return res.status(400).json({ error: 'Search query is required' });
    }
    
    const searchTerm = query.trim();
    const offset = (page - 1) * limit;
    const results = {
      files: [],
      folders: [],
      total: 0
    };
    
    // Search files
    if (type === 'all' || type === 'files') {
      let fileQuery = supabase
        .from('files')
        .select('*')
        .eq('is_deleted', false)
        .ilike('name', `%${searchTerm}%`);
      
      // Filter by owner or shared permissions
      const permittedFileIds = await getPermittedIds(userEmail, 'file');
      fileQuery = fileQuery.or(`owner_email.eq.${userEmail},id.in.(${permittedFileIds.join(',')})`);
      
      // Star filter
      if (starred === 'true') {
        fileQuery = fileQuery.eq('is_starred', true);
      }
      
      // Sorting
      const fileOrderColumn = sortBy === 'date' ? 'created_at' : sortBy === 'size' ? 'size' : 'name';
      fileQuery = fileQuery.order(fileOrderColumn, { ascending: sortOrder === 'asc' });
      
      // Pagination
      fileQuery = fileQuery.range(offset, offset + limit - 1);
      
      const { data: files, error: filesError, count: filesCount } = await fileQuery;
      
      if (filesError) throw filesError;
      
      results.files = files || [];
      results.total += filesCount || files.length;
    }
    
    // Search folders
    if (type === 'all' || type === 'folders') {
      let folderQuery = supabase
        .from('folders')
        .select('*')
        .ilike('name', `%${searchTerm}%`);
      
      // Filter by owner or shared permissions
      const permittedFolderIds = await getPermittedIds(userEmail, 'folder');
      folderQuery = folderQuery.or(`owner_email.eq.${userEmail},id.in.(${permittedFolderIds.join(',')})`);
      
      // Star filter
      if (starred === 'true') {
        folderQuery = folderQuery.eq('is_starred', true);
      }
      
      // Sorting
      const folderOrderColumn = sortBy === 'date' ? 'created_at' : 'name';
      folderQuery = folderQuery.order(folderOrderColumn, { ascending: sortOrder === 'asc' });
      
      // Pagination
      folderQuery = folderQuery.range(offset, offset + limit - 1);
      
      const { data: folders, error: foldersError, count: foldersCount } = await folderQuery;
      
      if (foldersError) throw foldersError;
      
      results.folders = folders || [];
      results.total += foldersCount || folders.length;
    }
    
    res.json({
      results,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: results.total,
        pages: Math.ceil(results.total / limit)
      },
      searchTerm
    });
  } catch (error) {
    console.error('Error searching:', error);
    res.status(500).json({ error: 'Failed to search' });
  }
});

// GET /search/starred - Search starred items
router.get('/starred', requireAuth, async (req, res) => {
  try {
    const { 
      type = 'all', 
      sortBy = 'name', 
      sortOrder = 'asc', 
      page = 1, 
      limit = 20 
    } = req.query;
    const userEmail = req.user.email;
    
    const offset = (page - 1) * limit;
    const results = {
      files: [],
      folders: [],
      total: 0
    };
    
    // Get starred files
    if (type === 'all' || type === 'files') {
      let fileQuery = supabase
        .from('files')
        .select('*')
        .eq('owner_email', userEmail)
        .eq('is_starred', true)
        .eq('is_deleted', false);
      
      // Sorting
      const fileOrderColumn = sortBy === 'date' ? 'created_at' : sortBy === 'size' ? 'size' : 'name';
      fileQuery = fileQuery.order(fileOrderColumn, { ascending: sortOrder === 'asc' });
      
      // Pagination
      fileQuery = fileQuery.range(offset, offset + limit - 1);
      
      const { data: files, error: filesError, count: filesCount } = await fileQuery;
      
      if (filesError) throw filesError;
      
      results.files = files || [];
      results.total += filesCount || files.length;
    }
    
    // Get starred folders
    if (type === 'all' || type === 'folders') {
      let folderQuery = supabase
        .from('folders')
        .select('*')
        .eq('owner_email', userEmail)
        .eq('is_starred', true);
      
      // Sorting
      const folderOrderColumn = sortBy === 'date' ? 'created_at' : 'name';
      folderQuery = folderQuery.order(folderOrderColumn, { ascending: sortOrder === 'asc' });
      
      // Pagination
      folderQuery = folderQuery.range(offset, offset + limit - 1);
      
      const { data: folders, error: foldersError, count: foldersCount } = await folderQuery;
      
      if (foldersError) throw foldersError;
      
      results.folders = folders || [];
      results.total += foldersCount || folders.length;
    }
    
    res.json({
      results,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: results.total,
        pages: Math.ceil(results.total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching starred items:', error);
    res.status(500).json({ error: 'Failed to fetch starred items' });
  }
});

// GET /search/recent - Get recently accessed items
router.get('/recent', requireAuth, async (req, res) => {
  try {
    const { 
      type = 'all', 
      limit = 20 
    } = req.query;
    const userEmail = req.user.email;
    
    const results = {
      files: [],
      folders: [],
      total: 0
    };
    
    // Get recent files
    if (type === 'all' || type === 'files') {
      const { data: files, error: filesError } = await supabase
        .from('files')
        .select('*')
        .eq('owner_email', userEmail)
        .eq('is_deleted', false)
        .order('updated_at', { ascending: false })
        .limit(parseInt(limit));
      
      if (filesError) throw filesError;
      
      results.files = files || [];
      results.total += files.length;
    }
    
    // Get recent folders
    if (type === 'all' || type === 'folders') {
      const { data: folders, error: foldersError } = await supabase
        .from('folders')
        .select('*')
        .eq('owner_email', userEmail)
        .order('updated_at', { ascending: false })
        .limit(parseInt(limit));
      
      if (foldersError) throw foldersError;
      
      results.folders = folders || [];
      results.total += folders.length;
    }
    
    res.json({ results });
  } catch (error) {
    console.error('Error fetching recent items:', error);
    res.status(500).json({ error: 'Failed to fetch recent items' });
  }
});

// GET /search/suggestions - Get search suggestions
router.get('/suggestions', requireAuth, async (req, res) => {
  try {
    const { query, limit = 10 } = req.query;
    const userEmail = req.user.email;
    
    if (!query || query.trim().length === 0) {
      return res.json({ suggestions: [] });
    }
    
    const searchTerm = query.trim();
    const suggestions = [];
    
    // Get file name suggestions
    const { data: fileSuggestions, error: filesError } = await supabase
      .from('files')
      .select('name')
      .eq('owner_email', userEmail)
      .eq('is_deleted', false)
      .ilike('name', `%${searchTerm}%`)
      .limit(parseInt(limit));
    
    if (!filesError && fileSuggestions) {
      suggestions.push(...fileSuggestions.map(f => ({ type: 'file', name: f.name })));
    }
    
    // Get folder name suggestions
    const { data: folderSuggestions, error: foldersError } = await supabase
      .from('folders')
      .select('name')
      .eq('owner_email', userEmail)
      .ilike('name', `%${searchTerm}%`)
      .limit(parseInt(limit));
    
    if (!foldersError && folderSuggestions) {
      suggestions.push(...folderSuggestions.map(f => ({ type: 'folder', name: f.name })));
    }
    
    // Remove duplicates and limit results
    const uniqueSuggestions = suggestions
      .filter((suggestion, index, self) => 
        index === self.findIndex(s => s.name === suggestion.name)
      )
      .slice(0, parseInt(limit));
    
    res.json({ suggestions: uniqueSuggestions });
  } catch (error) {
    console.error('Error getting search suggestions:', error);
    res.status(500).json({ error: 'Failed to get search suggestions' });
  }
});

// GET /search/advanced - Advanced search with multiple filters
router.get('/advanced', requireAuth, async (req, res) => {
  try {
    const { 
      query,
      fileTypes,
      minSize,
      maxSize,
      dateFrom,
      dateTo,
      starred,
      sortBy = 'name',
      sortOrder = 'asc',
      page = 1,
      limit = 20
    } = req.query;
    const userEmail = req.user.email;
    
    const offset = (page - 1) * limit;
    const results = {
      files: [],
      folders: [],
      total: 0
    };
    
    // Build file query
    let fileQuery = supabase
      .from('files')
      .select('*')
      .eq('owner_email', userEmail)
      .eq('is_deleted', false);
    
    // Add search term
    if (query && query.trim().length > 0) {
      fileQuery = fileQuery.ilike('name', `%${query.trim()}%`);
    }
    
    // Add file type filter
    if (fileTypes) {
      const types = fileTypes.split(',');
      fileQuery = fileQuery.in('mime_type', types);
    }
    
    // Add size filters
    if (minSize) {
      fileQuery = fileQuery.gte('size', parseInt(minSize));
    }
    if (maxSize) {
      fileQuery = fileQuery.lte('size', parseInt(maxSize));
    }
    
    // Add date filters
    if (dateFrom) {
      fileQuery = fileQuery.gte('created_at', dateFrom);
    }
    if (dateTo) {
      fileQuery = fileQuery.lte('created_at', dateTo);
    }
    
    // Add star filter
    if (starred === 'true') {
      fileQuery = fileQuery.eq('is_starred', true);
    }
    
    // Sorting
    const fileOrderColumn = sortBy === 'date' ? 'created_at' : sortBy === 'size' ? 'size' : 'name';
    fileQuery = fileQuery.order(fileOrderColumn, { ascending: sortOrder === 'asc' });
    
    // Pagination
    fileQuery = fileQuery.range(offset, offset + limit - 1);
    
    const { data: files, error: filesError, count: filesCount } = await fileQuery;
    
    if (filesError) throw filesError;
    
    results.files = files || [];
    results.total += filesCount || files.length;
    
    // Build folder query (simpler filters for folders)
    let folderQuery = supabase
      .from('folders')
      .select('*')
      .eq('owner_email', userEmail);
    
    // Add search term
    if (query && query.trim().length > 0) {
      folderQuery = folderQuery.ilike('name', `%${query.trim()}%`);
    }
    
    // Add date filters
    if (dateFrom) {
      folderQuery = folderQuery.gte('created_at', dateFrom);
    }
    if (dateTo) {
      folderQuery = folderQuery.lte('created_at', dateTo);
    }
    
    // Add star filter
    if (starred === 'true') {
      folderQuery = folderQuery.eq('is_starred', true);
    }
    
    // Sorting
    const folderOrderColumn = sortBy === 'date' ? 'created_at' : 'name';
    folderQuery = folderQuery.order(folderOrderColumn, { ascending: sortOrder === 'asc' });
    
    // Pagination
    folderQuery = folderQuery.range(offset, offset + limit - 1);
    
    const { data: folders, error: foldersError, count: foldersCount } = await folderQuery;
    
    if (foldersError) throw foldersError;
    
    results.folders = folders || [];
    results.total += foldersCount || folders.length;
    
    res.json({
      results,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: results.total,
        pages: Math.ceil(results.total / limit)
      },
      filters: {
        query,
        fileTypes,
        minSize,
        maxSize,
        dateFrom,
        dateTo,
        starred
      }
    });
  } catch (error) {
    console.error('Error in advanced search:', error);
    res.status(500).json({ error: 'Failed to perform advanced search' });
  }
});

// GET /search/shared - Get shared items
router.get('/shared', requireAuth, async (req, res) => {
  try {
    const { 
      type = 'all', 
      sortBy = 'name', 
      sortOrder = 'asc', 
      page = 1, 
      limit = 20 
    } = req.query;
    const userEmail = req.user.email;
    
    const offset = (page - 1) * limit;
    const results = {
      files: [],
      folders: [],
      total: 0
    };
    
    // Get shared files (not owned by current user but accessible)
    if (type === 'all' || type === 'files') {
      const permittedFileIds = await getPermittedIds(userEmail, 'file');
      
      if (permittedFileIds.length > 0) {
        let fileQuery = supabase
          .from('files')
          .select('*')
          .eq('is_deleted', false)
          .not('owner_email', 'eq', userEmail)
          .in('id', permittedFileIds);
        
        // Sorting
        const fileOrderColumn = sortBy === 'date' ? 'created_at' : sortBy === 'size' ? 'size' : 'name';
        fileQuery = fileQuery.order(fileOrderColumn, { ascending: sortOrder === 'asc' });
        
        // Pagination
        fileQuery = fileQuery.range(offset, offset + limit - 1);
        
        const { data: files, error: filesError, count: filesCount } = await fileQuery;
        
        if (filesError) throw filesError;
        
        results.files = files || [];
        results.total += filesCount || files.length;
      }
    }
    
    // Get shared folders (not owned by current user but accessible)
    if (type === 'all' || type === 'folders') {
      const permittedFolderIds = await getPermittedIds(userEmail, 'folder');
      
      if (permittedFolderIds.length > 0) {
        let folderQuery = supabase
          .from('folders')
          .select('*')
          .not('owner_email', 'eq', userEmail)
          .in('id', permittedFolderIds);
        
        // Sorting
        const folderOrderColumn = sortBy === 'date' ? 'created_at' : 'name';
        folderQuery = folderQuery.order(folderOrderColumn, { ascending: sortOrder === 'asc' });
        
        // Pagination
        folderQuery = folderQuery.range(offset, offset + limit - 1);
        
        const { data: folders, error: foldersError, count: foldersCount } = await folderQuery;
        
        if (foldersError) throw foldersError;
        
        results.folders = folders || [];
        results.total += foldersCount || folders.length;
      }
    }
    
    res.json({
      results,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: results.total,
        pages: Math.ceil(results.total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching shared items:', error);
    res.status(500).json({ error: 'Failed to fetch shared items' });
  }
});

export default router;


