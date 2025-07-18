#!/bin/bash

# Complete RouteClouds Backend Image Rebuild Script
# Fixes: Shell issues, missing npm scripts, adds debugging tools

set -e

echo "🔧 RouteClouds Complete Image Rebuild"
echo "====================================="
echo "This script will fix:"
echo "  ✅ Missing /bin/bash shell"
echo "  ✅ Missing npm migrate/seed scripts"
echo "  ✅ Add debugging tools"
echo "  ✅ Add proper database migration logic"
echo ""

# Configuration
IMAGE_NAME="awsfreetier30/routeclouds-backend"
NEW_TAG="v2-complete"
MIGRATION_TAG="migration-ready"

echo "📋 Build configuration:"
echo "   New image: $IMAGE_NAME:$NEW_TAG"
echo "   Migration image: $IMAGE_NAME:$MIGRATION_TAG"
echo ""

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ package.json not found. Please run this script from the backend directory."
    echo "   Expected location: RouteClouds-E-Comm-Project/backend/"
    exit 1
fi

echo "📝 Creating comprehensive Dockerfile..."
cat > Dockerfile.complete << 'EOF'
# Use a base image with shell support
FROM node:16-slim

# Install system dependencies and debugging tools
RUN apt-get update && apt-get install -y \
    bash \
    curl \
    wget \
    postgresql-client \
    vim \
    git \
    && rm -rf /var/lib/apt/lists/*

# Create app directory
WORKDIR /app

# Copy package files first for better caching
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy application code
COPY . .

# Ensure pg dependency is available for migrations
RUN npm install pg

# Create migration and seed directories
RUN mkdir -p migrations seeds

# Create comprehensive migration script
RUN cat > migrations/migrate.js << 'MIGRATE_SCRIPT'
const { Client } = require('pg');

async function runMigrations() {
  console.log('🔄 Starting database migrations...');
  
  const client = new Client({
    connectionString: process.env.DATABASE_URL
  });

  try {
    await client.connect();
    console.log('✅ Connected to database');

    // Create users table
    console.log('Creating users table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        email VARCHAR(100) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        first_name VARCHAR(50),
        last_name VARCHAR(50),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create categories table
    console.log('Creating categories table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS categories (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        description TEXT,
        image_url VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create products table
    console.log('Creating products table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS products (
        id SERIAL PRIMARY KEY,
        name VARCHAR(200) NOT NULL,
        description TEXT,
        price DECIMAL(10,2) NOT NULL,
        category_id INTEGER REFERENCES categories(id),
        stock_quantity INTEGER DEFAULT 0,
        image_url VARCHAR(255),
        sku VARCHAR(50) UNIQUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create orders table
    console.log('Creating orders table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS orders (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        total_amount DECIMAL(10,2) NOT NULL,
        status VARCHAR(20) DEFAULT 'pending',
        shipping_address TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create order_items table
    console.log('Creating order_items table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS order_items (
        id SERIAL PRIMARY KEY,
        order_id INTEGER REFERENCES orders(id),
        product_id INTEGER REFERENCES products(id),
        quantity INTEGER NOT NULL,
        price DECIMAL(10,2) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    console.log('✅ All database migrations completed successfully');
    
    // Show created tables
    const result = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);
    
    console.log('📋 Created tables:');
    result.rows.forEach(row => console.log(`  - ${row.table_name}`));
    
  } catch (error) {
    console.error('❌ Migration error:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

if (require.main === module) {
  runMigrations();
}

module.exports = { runMigrations };
MIGRATE_SCRIPT

# Create comprehensive seed script
RUN cat > seeds/seed.js << 'SEED_SCRIPT'
const { Client } = require('pg');

async function runSeeds() {
  console.log('🌱 Starting database seeding...');
  
  const client = new Client({
    connectionString: process.env.DATABASE_URL
  });

  try {
    await client.connect();
    console.log('✅ Connected to database for seeding');

    // Insert sample categories
    console.log('Seeding categories...');
    await client.query(`
      INSERT INTO categories (name, description, image_url) VALUES 
      ('Electronics', 'Electronic devices and gadgets', '/images/electronics.jpg'),
      ('Clothing', 'Fashion and apparel', '/images/clothing.jpg'),
      ('Books', 'Books and literature', '/images/books.jpg'),
      ('Home & Garden', 'Home improvement and gardening', '/images/home.jpg'),
      ('Sports', 'Sports and outdoor equipment', '/images/sports.jpg')
      ON CONFLICT (name) DO NOTHING
    `);

    // Insert sample products
    console.log('Seeding products...');
    await client.query(`
      INSERT INTO products (name, description, price, category_id, stock_quantity, sku) VALUES 
      ('Gaming Laptop', 'High-performance gaming laptop with RTX graphics', 1299.99, 1, 15, 'LAPTOP-001'),
      ('Wireless Headphones', 'Noise-cancelling wireless headphones', 199.99, 1, 30, 'HEADPHONE-001'),
      ('Cotton T-Shirt', 'Premium cotton t-shirt', 29.99, 2, 100, 'TSHIRT-001'),
      ('Denim Jeans', 'Classic blue denim jeans', 79.99, 2, 50, 'JEANS-001'),
      ('JavaScript Guide', 'Complete guide to modern JavaScript', 49.99, 3, 25, 'BOOK-001'),
      ('Python Cookbook', 'Advanced Python programming techniques', 59.99, 3, 20, 'BOOK-002')
      ON CONFLICT (sku) DO NOTHING
    `);

    // Insert sample users (for testing)
    console.log('Seeding test users...');
    await client.query(`
      INSERT INTO users (username, email, password_hash, first_name, last_name) VALUES 
      ('testuser', 'test@routeclouds.com', '$2b$10$dummy.hash.for.testing', 'Test', 'User'),
      ('admin', 'admin@routeclouds.com', '$2b$10$dummy.hash.for.admin', 'Admin', 'User')
      ON CONFLICT (username) DO NOTHING
    `);

    console.log('✅ Database seeding completed successfully');
    
    // Show seeded data counts
    const categoryCount = await client.query('SELECT COUNT(*) FROM categories');
    const productCount = await client.query('SELECT COUNT(*) FROM products');
    const userCount = await client.query('SELECT COUNT(*) FROM users');
    
    console.log('📊 Seeded data summary:');
    console.log(`  - Categories: ${categoryCount.rows[0].count}`);
    console.log(`  - Products: ${productCount.rows[0].count}`);
    console.log(`  - Users: ${userCount.rows[0].count}`);
    
  } catch (error) {
    console.error('❌ Seeding error:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

if (require.main === module) {
  runSeeds();
}

module.exports = { runSeeds };
SEED_SCRIPT

# Update package.json with proper scripts
RUN npm pkg set scripts.migrate="node migrations/migrate.js"
RUN npm pkg set scripts.seed="node seeds/seed.js"
RUN npm pkg set scripts.db:setup="npm run migrate && npm run seed"
RUN npm pkg set scripts.db:reset="npm run migrate && npm run seed"

# Set proper permissions
RUN chmod +x migrations/migrate.js seeds/seed.js

# Create non-root user if it doesn't exist
RUN id -u node &>/dev/null || useradd -m -s /bin/bash node
RUN chown -R node:node /app
USER node

# Set bash as default shell
SHELL ["/bin/bash", "-c"]

# Expose port
EXPOSE 3000

# Default command
CMD ["npm", "start"]
EOF

echo "✅ Dockerfile.complete created"

# Build the complete image
echo "🔨 Building complete image with all fixes..."
docker build -f Dockerfile.complete -t $IMAGE_NAME:$NEW_TAG .

echo "✅ Image built successfully: $IMAGE_NAME:$NEW_TAG"

# Test the new image
echo "🧪 Testing npm scripts in new image..."
if docker run --rm $IMAGE_NAME:$NEW_TAG npm run 2>&1 | grep -E "(migrate|seed)"; then
    echo "✅ NPM scripts test passed"
else
    echo "❌ NPM scripts test failed"
    exit 1
fi

# Test shell functionality
echo "🧪 Testing shell functionality..."
if docker run --rm $IMAGE_NAME:$NEW_TAG /bin/bash -c "echo 'Shell test successful'"; then
    echo "✅ Shell test passed"
else
    echo "❌ Shell test failed"
    exit 1
fi

# Create migration-ready tag
echo "🏷️  Creating migration-ready tag..."
docker tag $IMAGE_NAME:$NEW_TAG $IMAGE_NAME:$MIGRATION_TAG
echo "✅ Migration tag created: $IMAGE_NAME:$MIGRATION_TAG"

# Push images to Docker Hub
echo "📤 Ready to push images to Docker Hub..."
read -p "Do you want to push the images to Docker Hub? (y/n): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "Pushing $IMAGE_NAME:$NEW_TAG..."
    docker push $IMAGE_NAME:$NEW_TAG
    
    echo "Pushing $IMAGE_NAME:$MIGRATION_TAG..."
    docker push $IMAGE_NAME:$MIGRATION_TAG
    
    echo "✅ Images pushed successfully"
else
    echo "⏭️  Skipping push to Docker Hub"
fi

# Update migration job file
echo "📝 Updating migration job configuration..."
if [ -f "k8s/migration_job.yaml" ]; then
    # Create backup
    cp k8s/migration_job.yaml k8s/migration_job.yaml.backup
    
    # Update image reference
    sed -i "s|image: awsfreetier30/routeclouds-backend:.*|image: $IMAGE_NAME:$MIGRATION_TAG|g" k8s/migration_job.yaml
    
    echo "✅ Updated migration_job.yaml to use $IMAGE_NAME:$MIGRATION_TAG"
    echo "📄 Backup created: k8s/migration_job.yaml.backup"
else
    echo "⚠️  migration_job.yaml not found in k8s/ directory"
fi

# Cleanup
echo "🧹 Cleaning up temporary files..."
rm -f Dockerfile.complete

echo ""
echo "🎉 Complete image rebuild finished successfully!"
echo ""
echo "📋 Summary:"
echo "   ✅ Fixed shell issues (/bin/bash available)"
echo "   ✅ Added npm migrate and seed scripts"
echo "   ✅ Added comprehensive database schema"
echo "   ✅ Added debugging tools (curl, postgresql-client, vim)"
echo "   ✅ Created production-ready image: $IMAGE_NAME:$NEW_TAG"
echo "   ✅ Created migration-ready image: $IMAGE_NAME:$MIGRATION_TAG"
echo ""
echo "🚀 Next steps:"
echo "   1. Delete existing failed migration job:"
echo "      kubectl delete job database-migration -n routeclouds-ns"
echo ""
echo "   2. Apply updated migration job:"
echo "      kubectl apply -f k8s/migration_job.yaml"
echo ""
echo "   3. Monitor the migration:"
echo "      kubectl get jobs -n routeclouds-ns -w"
echo ""
echo "   4. Check migration logs:"
echo "      kubectl logs job/database-migration -n routeclouds-ns -f"
echo ""
echo "   5. Verify database tables:"
echo "      kubectl run db-verify --rm -it --image=postgres:13 -n routeclouds-ns --restart=Never -- bash -c \"PGPASSWORD='\$DB_PASSWORD' psql -h '\$DB_HOST' -U '\$DB_USER' -d '\$DB_NAME' -c '\\dt'\""
echo ""
echo "💡 The new image includes everything needed for a successful deployment!"
