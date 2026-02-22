import express from 'express';
import { body, validationResult, query } from 'express-validator';
import pool from '../config/database.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { uploadImages, uploadPdf } from '../middleware/upload.js';

const router = express.Router();

// Helper function to update auction status
const updateAuctionStatus = async () => {
  const now = new Date();
  // Only mark as expired if auction date has passed
  // Keep 'upcoming' status until auction date arrives
  try {
    // Check if properties table exists first
    const tableExists = await pool.query(
      "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'properties')"
    );

    if (!tableExists.rows[0].exists) {
      console.log('⚠️  properties table does not exist yet, skipping auction status update');
      return;
    }

    await pool.query(
      `UPDATE properties 
       SET auction_status = CASE 
         WHEN auction_status = 'upcoming' AND auction_date <= $1 THEN 'active'
         WHEN auction_status = 'active' AND auction_date < $1 THEN 'expired'
         ELSE auction_status
       END
       WHERE (auction_status = 'upcoming' AND auction_date <= $1)
          OR (auction_status = 'active' AND auction_date < $1)`,
      [now]
    );
  } catch (err) {
    // Log and continue - don't crash the server if DB is unavailable during dev
    console.warn('updateAuctionStatus: database unavailable or query failed', err && err.message ? err.message : err);
  }
};

// Run status update on server start and periodically
// Delay initial run by 5 seconds to allow database initialization
setTimeout(updateAuctionStatus, 5000);
setInterval(updateAuctionStatus, 60000); // Every minute

// @route   GET /api/properties
// @desc    Get all properties (with filters)
// @access  Public
router.get('/', [
  query('status').optional().custom((value) => {
    // Allow empty string for "all properties" or valid status values
    if (value === '' || !value || ['upcoming', 'active', 'expired', 'sold', 'cancelled'].includes(value)) {
      return true;
    }
    throw new Error('Invalid status value');
  }),
  query('city').optional().trim(),
  query('property_type').optional().trim(),
  query('min_price').optional().custom((value) => {
    if (!value || value === '') return true;
    const num = parseFloat(value);
    return !isNaN(num) && num >= 0;
  }),
  query('max_price').optional().custom((value) => {
    if (!value || value === '') return true;
    const num = parseFloat(value);
    return !isNaN(num) && num >= 0;
  }),
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 1000 }), // Increased max for dashboard
  query('sort_by').optional().custom((value) => {
    if (!value || ['created_at', 'reserve_price', 'auction_date'].includes(value)) {
      return true;
    }
    throw new Error('Invalid sort_by value');
  }),
], async (req, res) => {
  try {
    await updateAuctionStatus(); // Update status before fetching

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const {
      status,
      city,
      property_type,
      min_price,
      max_price,
      sort_by,
      page = 1,
      limit = 20
    } = req.query;

    // By default, exclude expired properties unless explicitly requested
    // But if status is empty string, show all (for admin dashboard)
    let query = 'SELECT * FROM properties WHERE is_active = true';
    const params = [];
    let paramCount = 0;
    
    // Handle status filter
    if (status === '') {
      // Empty string means "show all including expired" (for admin dashboard)
      // Don't add any status filter - show everything
    } else if (status) {
      // Specific status requested
      paramCount++;
      query += ` AND auction_status = $${paramCount}`;
      params.push(status);
    } else {
      // No status filter - exclude expired by default (for public website)
      query += ` AND auction_status != 'expired'`;
    }

    if (city) {
      paramCount++;
      query += ` AND city ILIKE $${paramCount}`;
      params.push(`%${city}%`);
    }

    if (property_type) {
      paramCount++;
      query += ` AND property_type = $${paramCount}`;
      params.push(property_type);
    }

    if (min_price) {
      paramCount++;
      query += ` AND reserve_price >= $${paramCount}`;
      params.push(min_price);
    }

    if (max_price) {
      paramCount++;
      query += ` AND reserve_price <= $${paramCount}`;
      params.push(max_price);
    }

    // Get total count
    const countQuery = query.replace('SELECT *', 'SELECT COUNT(*)');
    const countResult = await pool.query(countQuery, params);
    const total = parseInt(countResult.rows[0].count);

    // Add pagination with sorting
    let orderBy = 'created_at DESC';
    if (sort_by === 'reserve_price') {
      orderBy = 'reserve_price ASC';
    } else if (sort_by === 'reserve_price_desc') {
      orderBy = 'reserve_price DESC';
    } else if (sort_by === 'auction_date') {
      orderBy = 'auction_date ASC';
    }
    
    paramCount++;
    query += ` ORDER BY ${orderBy} LIMIT $${paramCount}`;
    params.push(limit);
    
    paramCount++;
    query += ` OFFSET $${paramCount}`;
    params.push((page - 1) * limit);

    const result = await pool.query(query, params);

    // Get images for each property
    for (let property of result.rows) {
      const imagesResult = await pool.query(
        'SELECT id, image_url, image_order FROM property_images WHERE property_id = $1 ORDER BY image_order',
        [property.id]
      );
      // Return as objects with image_url property for consistency
      property.images = imagesResult.rows;
    }

    res.json({
      properties: result.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get properties error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   POST /api/properties
// @desc    Create new property
// @access  Private (Admin/Staff)
router.post('/', authenticate, authorize('admin', 'staff'), uploadImages, [
  body('title').trim().notEmpty(),
  body('description').optional().trim(),
  body('address').trim().notEmpty(),
  body('city').trim().notEmpty(),
  body('property_type').optional().trim(),
  body('reserve_price').isFloat({ min: 0 }),
  body('auction_date').isISO8601(),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const {
      title,
      description,
      property_type,
      address,
      city,
      state,
      zip_code,
      country,
      latitude,
      longitude,
      area_sqft,
      bedrooms,
      bathrooms,
      floors,
      reserve_price,
      auction_date,
      auction_time,
      estimated_market_value,
      built_up_area,
      total_area,
      emd,
      possession_type,
      application_end_date
    } = req.body;

    // Determine cover image
    let coverImageUrl = null;
    if (req.files?.cover_image?.[0]) {
      coverImageUrl = `/uploads/images/${req.files.cover_image[0].filename}`;
    } else if (req.files?.images?.[0]) {
      coverImageUrl = `/uploads/images/${req.files.images[0].filename}`;
    }

    // Create property
    const propertyResult = await pool.query(
      `INSERT INTO properties (
        title, description, property_type, address, city, state, zip_code, country,
        latitude, longitude, area_sqft, bedrooms, bathrooms, floors,
        reserve_price, auction_date, auction_time, cover_image_url, created_by,
        estimated_market_value, built_up_area, total_area, emd, possession_type, application_end_date
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25)
      RETURNING *`,
      [
        title, description || null, property_type || null, address, city,
        state || null, zip_code || null, country || 'India',
        latitude ? parseFloat(latitude) : null, longitude ? parseFloat(longitude) : null,
        area_sqft ? parseFloat(area_sqft) : null,
        bedrooms ? parseInt(bedrooms) : null, bathrooms ? parseInt(bathrooms) : null,
        floors ? parseInt(floors) : null,
        parseFloat(reserve_price), new Date(auction_date), auction_time || null, coverImageUrl, req.user.id,
        estimated_market_value ? parseFloat(estimated_market_value) : null,
        built_up_area ? parseFloat(built_up_area) : null,
        total_area ? parseFloat(total_area) : null,
        emd ? parseFloat(emd) : null,
        possession_type || null,
        application_end_date ? new Date(application_end_date) : null
      ]
    );

    const property = propertyResult.rows[0];

    // Save images
    if (req.files?.images) {
      for (let i = 0; i < req.files.images.length; i++) {
        const imageUrl = `/uploads/images/${req.files.images[i].filename}`;
        await pool.query(
          'INSERT INTO property_images (property_id, image_url, image_order) VALUES ($1, $2, $3)',
          [property.id, imageUrl, i]
        );
      }
    }

    res.status(201).json({ message: 'Property created successfully', property });
  } catch (error) {
    console.error('Create property error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   PUT /api/properties/:id
// @desc    Update property
// @access  Private (Admin/Staff)
router.put('/:id', authenticate, authorize('admin', 'staff'), uploadImages, async (req, res) => {
  try {
    const { id } = req.params;

    // Check if property exists
    const existing = await pool.query('SELECT * FROM properties WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ message: 'Property not found' });
    }

    const {
      title, description, property_type, address, city, state, zip_code, country,
      latitude, longitude, area_sqft, bedrooms, bathrooms, floors,
      reserve_price, auction_date, auction_time, auction_status, is_featured, is_active,
      estimated_market_value, built_up_area, total_area, emd, possession_type, application_end_date
    } = req.body;

    // Build update query dynamically
    const updates = [];
    const values = [];
    let paramCount = 0;

    if (title !== undefined) {
      paramCount++;
      updates.push(`title = $${paramCount}`);
      values.push(title);
    }
    if (description !== undefined) {
      paramCount++;
      updates.push(`description = $${paramCount}`);
      values.push(description);
    }
    if (property_type !== undefined) {
      paramCount++;
      updates.push(`property_type = $${paramCount}`);
      values.push(property_type);
    }
    if (address !== undefined) {
      paramCount++;
      updates.push(`address = $${paramCount}`);
      values.push(address);
    }
    if (city !== undefined) {
      paramCount++;
      updates.push(`city = $${paramCount}`);
      values.push(city);
    }
    if (state !== undefined) {
      paramCount++;
      updates.push(`state = $${paramCount}`);
      values.push(state);
    }
    if (reserve_price !== undefined) {
      paramCount++;
      updates.push(`reserve_price = $${paramCount}`);
      values.push(parseFloat(reserve_price));
    }
    if (auction_date !== undefined) {
      paramCount++;
      updates.push(`auction_date = $${paramCount}`);
      values.push(new Date(auction_date));
    }
    if (auction_status !== undefined) {
      paramCount++;
      updates.push(`auction_status = $${paramCount}`);
      values.push(auction_status);
    }
    if (is_featured !== undefined) {
      paramCount++;
      updates.push(`is_featured = $${paramCount}`);
      values.push(is_featured === 'true' || is_featured === true);
    }
    if (is_active !== undefined) {
      paramCount++;
      updates.push(`is_active = $${paramCount}`);
      values.push(is_active === 'true' || is_active === true);
    }
    if (auction_time !== undefined) {
      paramCount++;
      updates.push(`auction_time = $${paramCount}`);
      values.push(auction_time || null);
    }
    if (estimated_market_value !== undefined) {
      paramCount++;
      updates.push(`estimated_market_value = $${paramCount}`);
      values.push(estimated_market_value ? parseFloat(estimated_market_value) : null);
    }
    if (built_up_area !== undefined) {
      paramCount++;
      updates.push(`built_up_area = $${paramCount}`);
      values.push(built_up_area ? parseFloat(built_up_area) : null);
    }
    if (total_area !== undefined) {
      paramCount++;
      updates.push(`total_area = $${paramCount}`);
      values.push(total_area ? parseFloat(total_area) : null);
    }
    if (emd !== undefined) {
      paramCount++;
      updates.push(`emd = $${paramCount}`);
      values.push(emd ? parseFloat(emd) : null);
    }
    if (possession_type !== undefined) {
      paramCount++;
      updates.push(`possession_type = $${paramCount}`);
      values.push(possession_type || null);
    }
    if (application_end_date !== undefined) {
      paramCount++;
      updates.push(`application_end_date = $${paramCount}`);
      values.push(application_end_date ? new Date(application_end_date) : null);
    }

    // Handle cover image
    if (req.files?.cover_image?.[0]) {
      paramCount++;
      updates.push(`cover_image_url = $${paramCount}`);
      values.push(`/uploads/images/${req.files.cover_image[0].filename}`);
    }

    if (updates.length === 0) {
      return res.status(400).json({ message: 'No fields to update' });
    }

    paramCount++;
    values.push(id);

    const query = `UPDATE properties SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING *`;
    const result = await pool.query(query, values);

    // Handle new images
    if (req.files?.images) {
      for (let i = 0; i < req.files.images.length; i++) {
        const imageUrl = `/uploads/images/${req.files.images[i].filename}`;
        const maxOrder = await pool.query(
          'SELECT COALESCE(MAX(image_order), -1) + 1 as next_order FROM property_images WHERE property_id = $1',
          [id]
        );
        await pool.query(
          'INSERT INTO property_images (property_id, image_url, image_order) VALUES ($1, $2, $3)',
          [id, imageUrl, maxOrder.rows[0].next_order]
        );
      }
    }

    res.json({ message: 'Property updated successfully', property: result.rows[0] });
  } catch (error) {
    console.error('Update property error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   DELETE /api/properties/:id
// @desc    Delete property (soft delete)
// @access  Private (Admin/Staff)
router.delete('/:id', authenticate, authorize('admin', 'staff'), async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      'UPDATE properties SET is_active = false WHERE id = $1 RETURNING id',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Property not found' });
    }

    res.json({ message: 'Property deleted successfully' });
  } catch (error) {
    console.error('Delete property error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   POST /api/properties/:id/images
// @desc    Upload PDF for property
// @access  Private (Admin/Staff)
router.post('/:id/pdf', authenticate, authorize('admin', 'staff'), uploadPdf, async (req, res) => {
  try {
    const { id } = req.params;

    if (!req.file) {
      return res.status(400).json({ message: 'PDF file is required' });
    }

    const pdfUrl = `/uploads/pdfs/${req.file.filename}`;

    await pool.query(
      'UPDATE properties SET pdf_url = $1 WHERE id = $2 RETURNING *',
      [pdfUrl, id]
    );

    res.json({ message: 'PDF uploaded successfully', pdf_url: pdfUrl });
  } catch (error) {
    console.error('Upload PDF error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   GET /api/properties/:id
// @desc    Get single property by ID
// @access  Public
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query('SELECT * FROM properties WHERE id = $1 AND is_active = true', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Property not found' });
    }

    const property = result.rows[0];

    // Get images
    const imagesResult = await pool.query(
      'SELECT id, image_url, image_order FROM property_images WHERE property_id = $1 ORDER BY image_order',
      [id]
    );
    property.images = imagesResult.rows;

    // Increment view count
    await pool.query('UPDATE properties SET views_count = views_count + 1 WHERE id = $1', [id]);

    res.json({ property });
  } catch (error) {
    console.error('Get property error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

export default router;

