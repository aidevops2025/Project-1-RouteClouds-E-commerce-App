"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const pg_1 = require("pg");
const cors_1 = __importDefault(require("cors"));
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const app = (0, express_1.default)();
const port = process.env.PORT || 8000;
// JWT Secret for token signing
const JWT_SECRET = process.env.JWT_SECRET || 'routeclouds-ecommerce-secret-key-2025';
const SALT_ROUNDS = 10;
// PostgreSQL connection pool
const pool = new pg_1.Pool({
    user: process.env.DB_USER || 'routeclouds_ecommerce_user',
    host: process.env.DB_HOST || 'db',
    database: process.env.DB_NAME || 'routeclouds_ecommerce_db',
    password: process.env.DB_PASSWORD || 'routeclouds_ecommerce_password',
    port: parseInt(process.env.DB_PORT || '5432'),
});
// Middleware
app.use(express_1.default.json());
app.use((0, cors_1.default)({
    origin: function (origin, callback) {
        // Allow requests with no origin (like mobile apps or curl requests)
        if (!origin)
            return callback(null, true);
        const allowedOrigins = [
            'http://localhost:3000',
            'http://192.168.1.11:3000',
            process.env.FRONTEND_URL,
            // Allow any ALB URL pattern
            /^http:\/\/k8s-.*\.elb\.amazonaws\.com$/,
            // Allow any ELB URL pattern
            /^http:\/\/.*\.elb\.amazonaws\.com$/
        ].filter(Boolean); // Remove any undefined values
        // Check string origins
        if (typeof origin === 'string' && allowedOrigins.some(allowed => typeof allowed === 'string' ? allowed === origin : allowed.test(origin))) {
            callback(null, true);
        }
        else {
            console.log(`CORS blocked origin: ${origin}`);
            callback(null, true); // Allow all origins for now to debug
        }
    },
    credentials: true
}));
// Request logging middleware
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path} - ${req.ip}`);
    next();
});
// Health check endpoint (for Kubernetes)
app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        service: 'routeclouds-ecommerce-backend',
        timestamp: new Date().toISOString()
    });
});
// Database status endpoint
app.get('/api/status', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const client = yield pool.connect();
        const result = yield client.query('SELECT NOW()');
        client.release();
        res.json({
            status: 'ok',
            database: 'connected',
            timestamp: result.rows[0].now
        });
    }
    catch (err) {
        console.error('Database connection error', err);
        res.status(500).json({
            status: 'error',
            database: 'disconnected',
            error: err instanceof Error ? err.message : 'Unknown error'
        });
    }
}));
// Legacy endpoints for compatibility
app.get('/api/hello', (req, res) => {
    res.json({
        message: 'Hello from the RouteClouds E-Commerce Backend API!',
        version: '2.0.0',
        features: [
            'User Authentication & Authorization',
            'Product Catalog Management',
            'Shopping Cart System',
            'Order Management',
            'Database Integration'
        ],
        endpoints: {
            'Health & Status': [
                'GET /health',
                'GET /api/status'
            ],
            'Authentication': [
                'POST /api/auth/register',
                'POST /api/auth/login',
                'GET /api/auth/profile (protected)'
            ],
            'Products & Categories': [
                'GET /api/categories',
                'GET /api/products',
                'GET /api/products/:id',
                'POST /api/categories (admin)',
                'POST /api/products (admin)'
            ],
            'Shopping Cart (Protected)': [
                'GET /api/cart',
                'POST /api/cart/add',
                'PUT /api/cart/update/:cartItemId',
                'DELETE /api/cart/remove/:cartItemId',
                'DELETE /api/cart/clear'
            ],
            'Order Management (Protected)': [
                'POST /api/orders/create',
                'GET /api/orders',
                'GET /api/orders/:orderId'
            ]
        }
    });
});
const authenticateToken = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN
    if (!token) {
        return res.status(401).json({ message: 'Access token required' });
    }
    try {
        const decoded = jsonwebtoken_1.default.verify(token, JWT_SECRET);
        // Verify user still exists and is active
        const client = yield pool.connect();
        const result = yield client.query('SELECT id, username, email, role, is_active FROM users WHERE id = $1 AND is_active = TRUE', [decoded.userId]);
        client.release();
        if (result.rows.length === 0) {
            return res.status(401).json({ message: 'Invalid token or user not found' });
        }
        req.user = result.rows[0];
        next();
    }
    catch (error) {
        return res.status(403).json({ message: 'Invalid or expired token' });
    }
});
// User Authentication Endpoints
// User Registration
app.post('/api/auth/register', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { username, email, password, firstName, lastName } = req.body;
    // Basic validation
    if (!username || !email || !password) {
        return res.status(400).json({
            message: 'Username, email, and password are required'
        });
    }
    if (password.length < 6) {
        return res.status(400).json({
            message: 'Password must be at least 6 characters long'
        });
    }
    try {
        const client = yield pool.connect();
        // Check if user already exists
        const existingUser = yield client.query('SELECT id FROM users WHERE username = $1 OR email = $2', [username, email]);
        if (existingUser.rows.length > 0) {
            client.release();
            return res.status(409).json({
                message: 'Username or email already exists'
            });
        }
        // Hash password
        const passwordHash = yield bcryptjs_1.default.hash(password, SALT_ROUNDS);
        // Create user
        const result = yield client.query(`
      INSERT INTO users (username, email, password_hash, first_name, last_name, role)
      VALUES ($1, $2, $3, $4, $5, 'user')
      RETURNING id, username, email, first_name, last_name, role, created_at
    `, [username, email, passwordHash, firstName || null, lastName || null]);
        client.release();
        const newUser = result.rows[0];
        // Generate JWT token
        const token = jsonwebtoken_1.default.sign({ userId: newUser.id, username: newUser.username }, JWT_SECRET, { expiresIn: '24h' });
        res.status(201).json({
            message: 'User registered successfully',
            user: {
                id: newUser.id,
                username: newUser.username,
                email: newUser.email,
                firstName: newUser.first_name,
                lastName: newUser.last_name,
                role: newUser.role,
                createdAt: newUser.created_at
            },
            token
        });
    }
    catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({
            message: 'Internal server error during registration'
        });
    }
}));
// User Login
app.post('/api/auth/login', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({
            message: 'Username and password are required'
        });
    }
    try {
        const client = yield pool.connect();
        // Find user by username or email
        const result = yield client.query('SELECT * FROM users WHERE (username = $1 OR email = $1) AND is_active = TRUE', [username]);
        client.release();
        if (result.rows.length === 0) {
            return res.status(401).json({
                message: 'Invalid credentials'
            });
        }
        const user = result.rows[0];
        // Verify password
        const isValidPassword = yield bcryptjs_1.default.compare(password, user.password_hash);
        if (!isValidPassword) {
            return res.status(401).json({
                message: 'Invalid credentials'
            });
        }
        // Generate JWT token
        const token = jsonwebtoken_1.default.sign({ userId: user.id, username: user.username }, JWT_SECRET, { expiresIn: '24h' });
        res.json({
            message: 'Login successful',
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                firstName: user.first_name,
                lastName: user.last_name,
                role: user.role
            },
            token
        });
    }
    catch (error) {
        console.error('Login error:', error);
        res.status(500).json({
            message: 'Internal server error during login'
        });
    }
}));
// Get current user profile (protected route)
app.get('/api/auth/profile', authenticateToken, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const client = yield pool.connect();
        const result = yield client.query('SELECT id, username, email, first_name, last_name, role, created_at FROM users WHERE id = $1', [req.user.id]);
        client.release();
        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'User not found' });
        }
        const user = result.rows[0];
        res.json({
            id: user.id,
            username: user.username,
            email: user.email,
            firstName: user.first_name,
            lastName: user.last_name,
            role: user.role,
            createdAt: user.created_at
        });
    }
    catch (error) {
        console.error('Profile fetch error:', error);
        res.status(500).json({
            message: 'Internal server error'
        });
    }
}));
app.get('/api/db-test', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const client = yield pool.connect();
        const result = yield client.query('SELECT NOW()');
        client.release();
        res.json({
            message: 'Database connection successful!',
            time: result.rows[0].now,
            database: process.env.DB_NAME
        });
    }
    catch (err) {
        console.error('Database connection error', err);
        res.status(500).json({
            message: 'Database connection failed',
            error: err instanceof Error ? err.message : 'Unknown error'
        });
    }
}));
// E-Commerce API Endpoints
// Categories endpoints
app.get('/api/categories', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const client = yield pool.connect();
        const result = yield client.query('SELECT * FROM categories ORDER BY name');
        client.release();
        res.json(result.rows);
    }
    catch (err) {
        console.error('Error fetching categories:', err);
        res.status(500).json({
            error: 'Failed to fetch categories',
            message: err instanceof Error ? err.message : 'Unknown error'
        });
    }
}));
app.post('/api/categories', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { name, slug, parent_id } = req.body;
    if (!name || !slug) {
        return res.status(400).json({ error: 'Name and slug are required' });
    }
    try {
        const client = yield pool.connect();
        const result = yield client.query('INSERT INTO categories (name, slug, parent_id) VALUES ($1, $2, $3) RETURNING *', [name, slug, parent_id || null]);
        client.release();
        res.status(201).json(result.rows[0]);
    }
    catch (err) {
        console.error('Error creating category:', err);
        res.status(500).json({
            error: 'Failed to create category',
            message: err instanceof Error ? err.message : 'Unknown error'
        });
    }
}));
// Products endpoints
// Search products endpoint (must come before /api/products/:id)
app.get('/api/products/search', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { q, category, minPrice, maxPrice, limit = 20 } = req.query;
    if (!q || typeof q !== 'string' || q.trim().length === 0) {
        return res.status(400).json({
            error: 'Search query is required',
            message: 'Please provide a search term using the "q" parameter'
        });
    }
    try {
        const client = yield pool.connect();
        let query = `
      SELECT p.*, c.name as category_name
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE (
        LOWER(p.name) LIKE LOWER($1) OR
        LOWER(p.brand) LIKE LOWER($1) OR
        LOWER(p.description) LIKE LOWER($1) OR
        LOWER(c.name) LIKE LOWER($1)
      )
    `;
        const params = [`%${q.trim()}%`];
        let paramIndex = 2;
        // Add category filter
        if (category && typeof category === 'string') {
            query += ` AND (c.slug = $${paramIndex} OR c.name ILIKE $${paramIndex})`;
            params.push(category);
            paramIndex++;
        }
        // Add price range filters
        if (minPrice && !isNaN(Number(minPrice))) {
            query += ` AND p.price >= $${paramIndex}`;
            params.push(Number(minPrice));
            paramIndex++;
        }
        if (maxPrice && !isNaN(Number(maxPrice))) {
            query += ` AND p.price <= $${paramIndex}`;
            params.push(Number(maxPrice));
            paramIndex++;
        }
        // Add ordering and limit
        query += ` ORDER BY
      CASE
        WHEN LOWER(p.name) LIKE LOWER($1) THEN 1
        WHEN LOWER(p.brand) LIKE LOWER($1) THEN 2
        WHEN LOWER(p.description) LIKE LOWER($1) THEN 3
        ELSE 4
      END,
      p.featured DESC,
      p.created_at DESC
      LIMIT $${paramIndex}
    `;
        params.push(Math.min(Number(limit), 100)); // Cap at 100 results
        const result = yield client.query(query, params);
        client.release();
        res.json({
            query: q,
            results: result.rows,
            count: result.rows.length,
            filters: {
                category: category || null,
                minPrice: minPrice ? Number(minPrice) : null,
                maxPrice: maxPrice ? Number(maxPrice) : null
            }
        });
    }
    catch (err) {
        console.error('Error searching products:', err);
        res.status(500).json({
            error: 'Failed to search products',
            message: err instanceof Error ? err.message : 'Unknown error'
        });
    }
}));
// Get all products
app.get('/api/products', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const client = yield pool.connect();
        const result = yield client.query(`
      SELECT p.*, c.name as category_name
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      ORDER BY p.created_at DESC
    `);
        client.release();
        res.json(result.rows);
    }
    catch (err) {
        console.error('Error fetching products:', err);
        res.status(500).json({
            error: 'Failed to fetch products',
            message: err instanceof Error ? err.message : 'Unknown error'
        });
    }
}));
app.get('/api/products/:id', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { id } = req.params;
    try {
        const client = yield pool.connect();
        const result = yield client.query(`
      SELECT p.*, c.name as category_name
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE p.id = $1
    `, [id]);
        client.release();
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Product not found' });
        }
        res.json(result.rows[0]);
    }
    catch (err) {
        console.error('Error fetching product:', err);
        res.status(500).json({
            error: 'Failed to fetch product',
            message: err instanceof Error ? err.message : 'Unknown error'
        });
    }
}));
app.post('/api/products', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { name, brand, category_id, sub_category, price, description, specifications, images, stock, featured } = req.body;
    if (!name || !price) {
        return res.status(400).json({ error: 'Name and price are required' });
    }
    try {
        const client = yield pool.connect();
        const result = yield client.query(`
      INSERT INTO products (
        name, brand, category_id, sub_category, price,
        description, specifications, images, stock, featured
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `, [
            name,
            brand || null,
            category_id || null,
            sub_category || null,
            price,
            description || null,
            specifications || null,
            images || [],
            stock || 0,
            featured || false
        ]);
        client.release();
        res.status(201).json(result.rows[0]);
    }
    catch (err) {
        console.error('Error creating product:', err);
        res.status(500).json({
            error: 'Failed to create product',
            message: err instanceof Error ? err.message : 'Unknown error'
        });
    }
}));
// Shopping Cart API Endpoints
// Get user's cart items
app.get('/api/cart', authenticateToken, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const client = yield pool.connect();
        const result = yield client.query(`
      SELECT
        ci.id as cart_item_id,
        ci.quantity,
        ci.created_at as added_at,
        p.id as product_id,
        p.name,
        p.brand,
        p.price,
        p.description,
        p.images,
        p.stock,
        c.name as category_name,
        (ci.quantity * p.price) as total_price
      FROM cart_items ci
      JOIN products p ON ci.product_id = p.id
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE ci.user_id = $1
      ORDER BY ci.created_at DESC
    `, [req.user.id]);
        client.release();
        const cartItems = result.rows.map(item => ({
            id: item.cart_item_id,
            product: {
                id: item.product_id,
                name: item.name,
                brand: item.brand,
                price: parseFloat(item.price),
                description: item.description,
                images: item.images || [],
                stock: item.stock,
                category: item.category_name
            },
            quantity: item.quantity,
            totalPrice: parseFloat(item.total_price),
            addedAt: item.added_at
        }));
        const cartTotal = cartItems.reduce((sum, item) => sum + item.totalPrice, 0);
        res.json({
            items: cartItems,
            totalItems: cartItems.reduce((sum, item) => sum + item.quantity, 0),
            totalAmount: cartTotal
        });
    }
    catch (error) {
        console.error('Error fetching cart:', error);
        res.status(500).json({
            message: 'Failed to fetch cart items'
        });
    }
}));
// Add item to cart
app.post('/api/cart/add', authenticateToken, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { productId, quantity = 1 } = req.body;
    if (!productId || quantity < 1) {
        return res.status(400).json({
            message: 'Valid product ID and quantity are required'
        });
    }
    try {
        const client = yield pool.connect();
        // Check if product exists and has sufficient stock
        const productResult = yield client.query('SELECT id, name, price, stock FROM products WHERE id = $1', [productId]);
        if (productResult.rows.length === 0) {
            client.release();
            return res.status(404).json({ message: 'Product not found' });
        }
        const product = productResult.rows[0];
        if (product.stock < quantity) {
            client.release();
            return res.status(400).json({
                message: `Insufficient stock. Only ${product.stock} items available`
            });
        }
        // Check if item already exists in cart
        const existingItem = yield client.query('SELECT id, quantity FROM cart_items WHERE user_id = $1 AND product_id = $2', [req.user.id, productId]);
        if (existingItem.rows.length > 0) {
            // Update existing cart item
            const newQuantity = existingItem.rows[0].quantity + quantity;
            if (newQuantity > product.stock) {
                client.release();
                return res.status(400).json({
                    message: `Cannot add ${quantity} more items. Maximum available: ${product.stock - existingItem.rows[0].quantity}`
                });
            }
            yield client.query('UPDATE cart_items SET quantity = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', [newQuantity, existingItem.rows[0].id]);
        }
        else {
            // Add new cart item
            yield client.query('INSERT INTO cart_items (user_id, product_id, quantity) VALUES ($1, $2, $3)', [req.user.id, productId, quantity]);
        }
        client.release();
        res.json({
            message: 'Item added to cart successfully',
            product: {
                id: product.id,
                name: product.name,
                price: parseFloat(product.price)
            },
            quantity
        });
    }
    catch (error) {
        console.error('Error adding to cart:', error);
        res.status(500).json({
            message: 'Failed to add item to cart'
        });
    }
}));
// Update cart item quantity
app.put('/api/cart/update/:cartItemId', authenticateToken, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { cartItemId } = req.params;
    const { quantity } = req.body;
    if (!quantity || quantity < 1) {
        return res.status(400).json({
            message: 'Valid quantity is required'
        });
    }
    try {
        const client = yield pool.connect();
        // Verify cart item belongs to user and get product info
        const cartItemResult = yield client.query(`
      SELECT ci.id, ci.product_id, p.stock, p.name
      FROM cart_items ci
      JOIN products p ON ci.product_id = p.id
      WHERE ci.id = $1 AND ci.user_id = $2
    `, [cartItemId, req.user.id]);
        if (cartItemResult.rows.length === 0) {
            client.release();
            return res.status(404).json({ message: 'Cart item not found' });
        }
        const cartItem = cartItemResult.rows[0];
        if (quantity > cartItem.stock) {
            client.release();
            return res.status(400).json({
                message: `Insufficient stock. Only ${cartItem.stock} items available`
            });
        }
        // Update quantity
        yield client.query('UPDATE cart_items SET quantity = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', [quantity, cartItemId]);
        client.release();
        res.json({
            message: 'Cart item updated successfully',
            cartItemId,
            quantity
        });
    }
    catch (error) {
        console.error('Error updating cart item:', error);
        res.status(500).json({
            message: 'Failed to update cart item'
        });
    }
}));
// Remove item from cart
app.delete('/api/cart/remove/:cartItemId', authenticateToken, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { cartItemId } = req.params;
    try {
        const client = yield pool.connect();
        // Verify cart item belongs to user
        const result = yield client.query('DELETE FROM cart_items WHERE id = $1 AND user_id = $2 RETURNING id', [cartItemId, req.user.id]);
        client.release();
        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Cart item not found' });
        }
        res.json({
            message: 'Item removed from cart successfully',
            cartItemId
        });
    }
    catch (error) {
        console.error('Error removing cart item:', error);
        res.status(500).json({
            message: 'Failed to remove cart item'
        });
    }
}));
// Clear entire cart
app.delete('/api/cart/clear', authenticateToken, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const client = yield pool.connect();
        const result = yield client.query('DELETE FROM cart_items WHERE user_id = $1 RETURNING id', [req.user.id]);
        client.release();
        res.json({
            message: 'Cart cleared successfully',
            removedItems: result.rows.length
        });
    }
    catch (error) {
        console.error('Error clearing cart:', error);
        res.status(500).json({
            message: 'Failed to clear cart'
        });
    }
}));
// Order Management API Endpoints
// Create order from cart
app.post('/api/orders/create', authenticateToken, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { shippingAddress, billingAddress, paymentMethod, notes } = req.body;
    if (!shippingAddress) {
        return res.status(400).json({
            message: 'Shipping address is required'
        });
    }
    try {
        const client = yield pool.connect();
        // Start transaction
        yield client.query('BEGIN');
        // Get cart items with product details
        const cartResult = yield client.query(`
      SELECT
        ci.product_id,
        ci.quantity,
        p.name,
        p.price,
        p.stock,
        (ci.quantity * p.price) as total_price
      FROM cart_items ci
      JOIN products p ON ci.product_id = p.id
      WHERE ci.user_id = $1
    `, [req.user.id]);
        if (cartResult.rows.length === 0) {
            yield client.query('ROLLBACK');
            client.release();
            return res.status(400).json({ message: 'Cart is empty' });
        }
        // Check stock availability for all items
        for (const item of cartResult.rows) {
            if (item.stock < item.quantity) {
                yield client.query('ROLLBACK');
                client.release();
                return res.status(400).json({
                    message: `Insufficient stock for ${item.name}. Only ${item.stock} available`
                });
            }
        }
        // Calculate total amount
        const totalAmount = cartResult.rows.reduce((sum, item) => sum + parseFloat(item.total_price), 0);
        // Create order
        const orderResult = yield client.query(`
      INSERT INTO orders (
        user_id, total_amount, shipping_address, billing_address,
        payment_method, notes, status, payment_status
      ) VALUES ($1, $2, $3, $4, $5, $6, 'confirmed', 'pending')
      RETURNING id, created_at
    `, [
            req.user.id,
            totalAmount,
            shippingAddress,
            billingAddress || shippingAddress,
            paymentMethod || 'cash_on_delivery',
            notes || null
        ]);
        const orderId = orderResult.rows[0].id;
        // Create order items and update product stock
        for (const item of cartResult.rows) {
            // Add order item
            yield client.query(`
        INSERT INTO order_items (order_id, product_id, quantity, unit_price, total_price)
        VALUES ($1, $2, $3, $4, $5)
      `, [orderId, item.product_id, item.quantity, item.price, item.total_price]);
            // Update product stock
            yield client.query('UPDATE products SET stock = stock - $1 WHERE id = $2', [item.quantity, item.product_id]);
        }
        // Clear cart
        yield client.query('DELETE FROM cart_items WHERE user_id = $1', [req.user.id]);
        // Commit transaction
        yield client.query('COMMIT');
        client.release();
        res.status(201).json({
            message: 'Order created successfully',
            order: {
                id: orderId,
                totalAmount,
                status: 'confirmed',
                paymentStatus: 'pending',
                createdAt: orderResult.rows[0].created_at,
                itemCount: cartResult.rows.length
            }
        });
    }
    catch (error) {
        console.error('Error creating order:', error);
        res.status(500).json({
            message: 'Failed to create order'
        });
    }
}));
// Get user's orders
app.get('/api/orders', authenticateToken, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const client = yield pool.connect();
        const result = yield client.query(`
      SELECT
        o.id,
        o.total_amount,
        o.status,
        o.payment_status,
        o.shipping_address,
        o.payment_method,
        o.notes,
        o.created_at,
        o.updated_at,
        COUNT(oi.id) as item_count
      FROM orders o
      LEFT JOIN order_items oi ON o.id = oi.order_id
      WHERE o.user_id = $1
      GROUP BY o.id
      ORDER BY o.created_at DESC
    `, [req.user.id]);
        client.release();
        const orders = result.rows.map(order => ({
            id: order.id,
            totalAmount: parseFloat(order.total_amount),
            status: order.status,
            paymentStatus: order.payment_status,
            shippingAddress: order.shipping_address,
            paymentMethod: order.payment_method,
            notes: order.notes,
            itemCount: parseInt(order.item_count),
            createdAt: order.created_at,
            updatedAt: order.updated_at
        }));
        res.json({
            orders,
            totalOrders: orders.length
        });
    }
    catch (error) {
        console.error('Error fetching orders:', error);
        res.status(500).json({
            message: 'Failed to fetch orders'
        });
    }
}));
// Get specific order details
app.get('/api/orders/:orderId', authenticateToken, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { orderId } = req.params;
    try {
        const client = yield pool.connect();
        // Get order details
        const orderResult = yield client.query(`
      SELECT * FROM orders WHERE id = $1 AND user_id = $2
    `, [orderId, req.user.id]);
        if (orderResult.rows.length === 0) {
            client.release();
            return res.status(404).json({ message: 'Order not found' });
        }
        // Get order items
        const itemsResult = yield client.query(`
      SELECT
        oi.id,
        oi.quantity,
        oi.unit_price,
        oi.total_price,
        p.id as product_id,
        p.name as product_name,
        p.brand,
        p.description,
        p.images,
        c.name as category_name
      FROM order_items oi
      JOIN products p ON oi.product_id = p.id
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE oi.order_id = $1
      ORDER BY oi.id
    `, [orderId]);
        client.release();
        const order = orderResult.rows[0];
        const items = itemsResult.rows.map(item => ({
            id: item.id,
            product: {
                id: item.product_id,
                name: item.product_name,
                brand: item.brand,
                description: item.description,
                images: item.images || [],
                category: item.category_name
            },
            quantity: item.quantity,
            unitPrice: parseFloat(item.unit_price),
            totalPrice: parseFloat(item.total_price)
        }));
        res.json({
            id: order.id,
            totalAmount: parseFloat(order.total_amount),
            status: order.status,
            paymentStatus: order.payment_status,
            shippingAddress: order.shipping_address,
            billingAddress: order.billing_address,
            paymentMethod: order.payment_method,
            notes: order.notes,
            items,
            createdAt: order.created_at,
            updatedAt: order.updated_at
        });
    }
    catch (error) {
        console.error('Error fetching order details:', error);
        res.status(500).json({
            message: 'Failed to fetch order details'
        });
    }
}));
// Initialize database tables
function initializeDatabase() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const client = yield pool.connect();
            // Create categories table
            yield client.query(`
      CREATE TABLE IF NOT EXISTS categories (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        slug VARCHAR(100) UNIQUE NOT NULL,
        parent_id INTEGER REFERENCES categories(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
            // Create products table
            yield client.query(`
      CREATE TABLE IF NOT EXISTS products (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        brand VARCHAR(100),
        category_id INTEGER REFERENCES categories(id),
        sub_category VARCHAR(100),
        price DECIMAL(10,2) NOT NULL,
        description TEXT,
        specifications JSONB,
        images TEXT[],
        stock INTEGER DEFAULT 0,
        featured BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
            // Insert sample categories if none exist
            const categoryCount = yield client.query('SELECT COUNT(*) FROM categories');
            if (parseInt(categoryCount.rows[0].count) === 0) {
                yield client.query(`
        INSERT INTO categories (name, slug) VALUES
        ('Cloud Infrastructure', 'cloud-infrastructure'),
        ('Networking Equipment', 'networking-equipment'),
        ('Security Solutions', 'security-solutions'),
        ('DevOps Tools', 'devops-tools')
      `);
                console.log('Sample categories inserted');
            }
            // Insert sample products if none exist
            const productCount = yield client.query('SELECT COUNT(*) FROM products');
            if (parseInt(productCount.rows[0].count) === 0) {
                yield client.query(`
        INSERT INTO products (name, brand, category_id, price, description, stock, featured) VALUES
        ('AWS EC2 Instance', 'Amazon', 1, 99.99, 'Scalable cloud computing instance', 100, true),
        ('Cisco Router', 'Cisco', 2, 299.99, 'Enterprise-grade networking router', 50, false),
        ('Firewall Appliance', 'Fortinet', 3, 599.99, 'Next-generation firewall solution', 25, true),
        ('Jenkins CI/CD Platform', 'Jenkins', 4, 0.00, 'Open-source automation server', 999, false)
      `);
                console.log('Sample products inserted');
            }
            // Create users table for authentication
            yield client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        email VARCHAR(100) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        first_name VARCHAR(50),
        last_name VARCHAR(50),
        role VARCHAR(20) DEFAULT 'user',
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
            console.log('Users table created/verified');
            // Create cart_items table for persistent shopping cart
            yield client.query(`
      CREATE TABLE IF NOT EXISTS cart_items (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
        quantity INTEGER NOT NULL DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, product_id)
      )
    `);
            console.log('Cart items table created/verified');
            // Create orders table
            yield client.query(`
      CREATE TABLE IF NOT EXISTS orders (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        total_amount DECIMAL(10,2) NOT NULL,
        status VARCHAR(50) DEFAULT 'pending',
        shipping_address TEXT,
        billing_address TEXT,
        payment_method VARCHAR(50),
        payment_status VARCHAR(50) DEFAULT 'pending',
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
            console.log('Orders table created/verified');
            // Create order_items table
            yield client.query(`
      CREATE TABLE IF NOT EXISTS order_items (
        id SERIAL PRIMARY KEY,
        order_id INTEGER REFERENCES orders(id) ON DELETE CASCADE,
        product_id INTEGER REFERENCES products(id),
        quantity INTEGER NOT NULL,
        unit_price DECIMAL(10,2) NOT NULL,
        total_price DECIMAL(10,2) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
            console.log('Order items table created/verified');
            client.release();
            console.log('Database initialized successfully');
        }
        catch (err) {
            console.error('Database initialization error:', err);
        }
    });
}
app.listen(port, () => __awaiter(void 0, void 0, void 0, function* () {
    console.log(`RouteClouds E-Commerce Backend API listening on port ${port}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`Database: ${process.env.DB_NAME}`);
    // Initialize database on startup
    yield initializeDatabase();
}));
