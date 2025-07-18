# Use an official Node.js runtime as a parent image
FROM node:18-alpine

# Install bash and essential tools for debugging and database operations
RUN apk add --no-cache bash curl postgresql-client vim

# Set the working directory in the container
WORKDIR /app

# Copy package.json and package-lock.json (for better Docker layer caching)
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the application code
COPY . .

# Build TypeScript application
RUN npm run build

# Create database directory and migration files
RUN mkdir -p /app/dist/database

# Create migration script (embedded in Dockerfile for CI/CD compatibility)
RUN cat > /app/dist/database/migrate.js << 'MIGRATE_EOF'
const { Pool } = require('pg');

const pool = new Pool({
  user: process.env.DB_USER || 'routeclouds_user',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'routeclouds_ecommerce_db',
  password: process.env.DB_PASSWORD || 'routeclouds_ecommerce_password',
  port: process.env.DB_PORT || 5432,
});

async function migrate() {
  console.log('🔄 Starting database migration...');

  try {
    // Test connection
    await pool.query('SELECT NOW()');
    console.log('✅ Database connection successful');

    // Create users table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        email VARCHAR(100) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        full_name VARCHAR(100),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Users table created/verified');

    // Create categories table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS categories (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) UNIQUE NOT NULL,
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Categories table created/verified');

    // Create products table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS products (
        id SERIAL PRIMARY KEY,
        name VARCHAR(200) NOT NULL,
        description TEXT,
        price DECIMAL(10,2) NOT NULL,
        category_id INTEGER REFERENCES categories(id),
        stock_quantity INTEGER DEFAULT 0,
        image_url VARCHAR(500),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Products table created/verified');

    // Create cart_items table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS cart_items (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
        quantity INTEGER NOT NULL DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, product_id)
      )
    `);
    console.log('✅ Cart items table created/verified');

    // Create orders table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS orders (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        total_amount DECIMAL(10,2) NOT NULL,
        status VARCHAR(50) DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Orders table created/verified');

    // Create order_items table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS order_items (
        id SERIAL PRIMARY KEY,
        order_id INTEGER REFERENCES orders(id) ON DELETE CASCADE,
        product_id INTEGER REFERENCES products(id),
        quantity INTEGER NOT NULL,
        price DECIMAL(10,2) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Order items table created/verified');

    console.log('🎉 Database migration completed successfully!');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

migrate();
MIGRATE_EOF

# Create seed script (embedded in Dockerfile for CI/CD compatibility)
RUN cat > /app/dist/database/seed.js << 'SEED_EOF'
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const pool = new Pool({
  user: process.env.DB_USER || 'routeclouds_user',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'routeclouds_ecommerce_db',
  password: process.env.DB_PASSWORD || 'routeclouds_ecommerce_password',
  port: process.env.DB_PORT || 5432,
});

async function seed() {
  console.log('🌱 Starting database seeding...');

  try {
    // Check if data already exists
    const userCount = await pool.query('SELECT COUNT(*) FROM users');
    if (parseInt(userCount.rows[0].count) > 0) {
      console.log('📊 Database already contains data, skipping seeding');
      return;
    }

    // Seed categories
    const categories = [
      { name: 'Electronics', description: 'Electronic devices and gadgets' },
      { name: 'Clothing', description: 'Fashion and apparel' },
      { name: 'Books', description: 'Books and educational materials' },
      { name: 'Home & Garden', description: 'Home improvement and gardening' }
    ];

    for (const category of categories) {
      await pool.query(
        'INSERT INTO categories (name, description) VALUES ($1, $2)',
        [category.name, category.description]
      );
    }
    console.log('✅ Categories seeded');

    // Seed test user
    const hashedPassword = await bcrypt.hash('password123', 10);
    await pool.query(
      'INSERT INTO users (username, email, password_hash, full_name) VALUES ($1, $2, $3, $4)',
      ['testuser', 'test@routeclouds.com', hashedPassword, 'Test User']
    );
    console.log('✅ Test user created (username: testuser, password: password123)');

    // Seed products
    const products = [
      { name: 'Laptop Pro', description: 'High-performance laptop', price: 1299.99, category_id: 1, stock: 10 },
      { name: 'Smartphone X', description: 'Latest smartphone model', price: 899.99, category_id: 1, stock: 25 },
      { name: 'Cotton T-Shirt', description: 'Comfortable cotton t-shirt', price: 29.99, category_id: 2, stock: 50 },
      { name: 'Programming Guide', description: 'Complete programming handbook', price: 49.99, category_id: 3, stock: 15 }
    ];

    for (const product of products) {
      await pool.query(
        'INSERT INTO products (name, description, price, category_id, stock_quantity) VALUES ($1, $2, $3, $4, $5)',
        [product.name, product.description, product.price, product.category_id, product.stock]
      );
    }
    console.log('✅ Products seeded');

    console.log('🎉 Database seeding completed successfully!');

  } catch (error) {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

seed();
SEED_EOF

# Make scripts executable
RUN chmod +x /app/dist/database/migrate.js
RUN chmod +x /app/dist/database/seed.js

# Expose the port the app runs on
EXPOSE 8000

# Add health check for better container monitoring
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:8000/api/hello || exit 1

# Define the command to run the app
CMD [ "npm", "start" ]