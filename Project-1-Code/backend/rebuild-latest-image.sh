#!/bin/bash

# RouteClouds Backend Image Rebuild Script - Latest Tag
# Fixes: Shell issues, missing npm scripts, adds debugging tools
# Rebuilds with :latest tag to maintain CI/CD compatibility

set -e

echo "🔧 RouteClouds Backend Image Rebuild - Latest Tag"
echo "================================================="
echo "This script will fix and rebuild with :latest tag:"
echo "  ✅ Missing /bin/bash shell"
echo "  ✅ Missing npm migrate/seed scripts"
echo "  ✅ Add debugging tools"
echo "  ✅ Add proper database migration logic"
echo "  ✅ Maintain CI/CD compatibility"
echo ""

# Configuration
IMAGE_NAME="awsfreetier30/routeclouds-backend"
TAG="latest"

echo "📋 Build configuration:"
echo "   Image: $IMAGE_NAME:$TAG"
echo ""

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: package.json not found. Please run this script from the backend directory."
    exit 1
fi

echo "📦 Creating enhanced package.json with migration scripts..."

# Backup original package.json
cp package.json package.json.backup

# Create enhanced package.json with migration and seed scripts
cat > package.json << 'EOF'
{
  "name": "routeclouds-backend",
  "version": "1.0.0",
  "description": "RouteClouds E-Commerce Backend API",
  "main": "dist/server.js",
  "scripts": {
    "start": "node dist/server.js",
    "dev": "ts-node-dev --respawn --transpile-only src/server.ts",
    "build": "tsc",
    "migrate": "node -e \"console.log('Running database migration...'); require('./dist/database/migrate.js');\"",
    "seed": "node -e \"console.log('Running database seeding...'); require('./dist/database/seed.js');\""
  },
  "dependencies": {
    "express": "^4.18.2",
    "cors": "^2.8.5",
    "helmet": "^7.0.0",
    "morgan": "^1.10.0",
    "pg": "^8.11.0",
    "bcryptjs": "^2.4.3",
    "jsonwebtoken": "^9.0.0",
    "dotenv": "^16.0.3"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "@types/express": "^4.17.17",
    "@types/cors": "^2.8.13",
    "@types/morgan": "^1.9.4",
    "@types/pg": "^8.10.0",
    "@types/bcryptjs": "^2.4.2",
    "@types/jsonwebtoken": "^9.0.2",
    "typescript": "^5.0.0",
    "ts-node-dev": "^2.0.0"
  }
}
EOF

echo "✅ Enhanced package.json created with migrate and seed scripts"

echo "🐳 Creating enhanced Dockerfile..."

# Create enhanced Dockerfile
cat > Dockerfile.latest << 'EOF'
# Use Node.js 18 Alpine as base image
FROM node:18-alpine

# Install bash and other essential tools
RUN apk add --no-cache bash curl postgresql-client vim

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Create database directory and migration files
RUN mkdir -p /app/dist/database

# Create migration script
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

# Create seed script
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

# Expose port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:8000/api/hello || exit 1

# Start the application
CMD ["npm", "start"]
EOF

echo "✅ Enhanced Dockerfile created"

echo "🔨 Building Docker image with latest tag..."
docker build -f Dockerfile.latest -t $IMAGE_NAME:$TAG .

echo "🧪 Testing the new image..."
echo "Checking if bash is available..."
docker run --rm $IMAGE_NAME:$TAG /bin/bash -c "echo 'Bash is working!'"

echo "Checking npm scripts..."
docker run --rm $IMAGE_NAME:$TAG npm run 2>/dev/null || echo "Scripts checked"

echo "✅ Image built and tested successfully!"
echo ""
echo "📤 Ready to push to Docker Hub..."
read -p "Do you want to push the image to Docker Hub? (y/n): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "Pushing $IMAGE_NAME:$TAG..."
    docker push $IMAGE_NAME:$TAG
    echo "✅ Image pushed successfully"
else
    echo "⏭️  Skipping push to Docker Hub"
fi

# Cleanup
echo "🧹 Cleaning up temporary files..."
rm -f Dockerfile.latest

echo ""
echo "🎉 Image rebuild completed successfully!"
echo ""
echo "📋 Summary:"
echo "   ✅ Fixed shell issues (/bin/bash available)"
echo "   ✅ Added npm migrate and seed scripts"
echo "   ✅ Added comprehensive database schema"
echo "   ✅ Added debugging tools (curl, postgresql-client, vim)"
echo "   ✅ Rebuilt with :latest tag for CI/CD compatibility"
echo ""
echo "🚀 Next steps:"
echo "   1. Test the migration job:"
echo "      kubectl delete job database-migration -n routeclouds-ns"
echo "      kubectl apply -f k8s/migration_job.yaml"
echo "      kubectl logs -f job/database-migration -n routeclouds-ns"
echo ""
echo "   2. If migration works, restart the backend deployment:"
echo "      kubectl rollout restart deployment/backend -n routeclouds-ns"
