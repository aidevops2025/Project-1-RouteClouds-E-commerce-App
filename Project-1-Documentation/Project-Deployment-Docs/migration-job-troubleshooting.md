# Database Migration Job Troubleshooting Guide

## 🎯 **Quick Problem Identification**

### **Symptoms:**
- Migration job shows `0/1` completions for extended time
- Pods show `StartError`, `ImagePullBackOff`, or `CrashLoopBackOff` status
- Job never completes successfully

### **Common Root Causes:**
1. Missing Docker image
2. Missing secrets or configmaps
3. Database connectivity issues
4. Container command failures
5. Resource constraints

---

## 🔍 **Step 1: Quick Status Check**

```bash
# Check job status
kubectl get jobs -n routeclouds-ns

# Check pod status
kubectl get pods -n routeclouds-ns | grep migration

# Expected healthy output:
# database-migration   1/1     24s        24s
```

**If you see:**
- `0/1` completions for >2 minutes → Continue to Step 2
- `StartError` or `ImagePullBackOff` → Go to Step 3
- `CrashLoopBackOff` → Go to Step 4

---

## 🔍 **Step 2: Detailed Pod Investigation**

```bash
# Get the latest migration pod name
POD_NAME=$(kubectl get pods -n routeclouds-ns | grep migration | head -1 | awk '{print $1}')
echo "Investigating pod: $POD_NAME"

# Check pod details and events
kubectl describe pod $POD_NAME -n routeclouds-ns

# Check pod logs
kubectl logs $POD_NAME -n routeclouds-ns

# Check pod status
kubectl get pod $POD_NAME -n routeclouds-ns -o wide
```

**Look for these key indicators:**
- **Events section**: Shows pull errors, start errors, or resource issues
- **Container Status**: Shows exit codes and restart counts
- **Logs**: Show application-level errors

---

## 🔍 **Step 3: Fix Image and Shell Issues**

### **Problem A: ImagePullBackOff or ErrImagePull**

```bash
# Check if the Docker image exists
docker pull awsfreetier30/routeclouds-backend:latest

# If image doesn't exist locally, check Docker Hub
echo "Check if image exists at: https://hub.docker.com/r/awsfreetier30/routeclouds-backend"
```

### **Problem B: Shell Not Found Error (StartError)**

**Symptoms:**
```
State: Terminated
Reason: StartError
Message: exec: "/bin/bash": stat /bin/bash: no such file or directory: unknown
```

**Root Cause:** The Docker image is based on a minimal/distroless base image that doesn't include `/bin/bash`. This is common with optimized Node.js images.

**Diagnostic Command:**
```bash
# Check the exact error in pod description
kubectl describe pod $POD_NAME -n routeclouds-ns | grep -A 5 "State:"
```

### **Problem C: Missing NPM Scripts Error (Job Completes but No Migration)**

**Symptoms:**
```
npm error Missing script: "migrate"
npm error Missing script: "seed"
Job completed successfully but no database tables created
```

**Root Cause:** The Docker image doesn't have the required migration and seeding scripts defined in package.json.

**Diagnostic Commands:**
```bash
# Check what npm scripts are available
kubectl run npm-check --rm -it --image=awsfreetier30/routeclouds-backend:latest -n routeclouds-ns --restart=Never -- npm run

# Check package.json content
kubectl run package-check --rm -it --image=awsfreetier30/routeclouds-backend:latest -n routeclouds-ns --restart=Never -- cat package.json

# Verify if database has tables after "successful" migration
kubectl run db-verify --rm -it --image=postgres:13 -n routeclouds-ns --restart=Never -- bash -c "
PGPASSWORD='$DB_PASSWORD' psql -h '$DB_HOST' -U '$DB_USER' -d '$DB_NAME' -c '\dt'"
```

**Solutions:**

**Option A: Fix the Migration Job (Quick Fix)**
```bash
# Edit migration_job.yaml and change the command from:
# command: ["/bin/bash", "-c"]
# to:
# command: ["/bin/sh", "-c"]

# Apply the fix
kubectl delete job database-migration -n routeclouds-ns
kubectl apply -f migration_job.yaml
```

**Option B: Use Node.js Directly**
```bash
# Edit migration_job.yaml and change to:
# command: ["node"]
# args: ["-e", "require('child_process').execSync('npm run migrate && npm run seed', {stdio: 'inherit'})"]
```

**Option C: Rebuild Image with Shell (Recommended for Production)**
```bash
# Create a new Dockerfile with shell support
cat > Dockerfile.migration << EOF
FROM awsfreetier30/routeclouds-backend:latest

# Install bash and other essential tools
USER root
RUN apt-get update && apt-get install -y bash curl && rm -rf /var/lib/apt/lists/*

# Switch back to non-root user if needed
USER node
EOF

# Build and push the new image
docker build -f Dockerfile.migration -t awsfreetier30/routeclouds-backend:with-shell .
docker push awsfreetier30/routeclouds-backend:with-shell

# Update migration_job.yaml to use the new image:
# image: awsfreetier30/routeclouds-backend:with-shell
```

**Option D: Use a Different Base Image**
```bash
# If rebuilding the main image, use a base image with shell
# In your main Dockerfile, change from:
# FROM node:alpine (minimal)
# to:
# FROM node:16-slim (includes bash)
```

**Option E: Manual Database Setup (Quick Fix for Missing Scripts)**
```bash
# Create database tables manually when npm scripts are missing
kubectl run db-create-tables --rm -it --image=postgres:13 -n routeclouds-ns --restart=Never -- bash -c "
PGPASSWORD='$DB_PASSWORD' psql -h '$DB_HOST' -U '$DB_USER' -d '$DB_NAME' << 'EOF'
-- Create users table
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create categories table
CREATE TABLE IF NOT EXISTS categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create products table
CREATE TABLE IF NOT EXISTS products (
    id SERIAL PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    price DECIMAL(10,2) NOT NULL,
    category_id INTEGER REFERENCES categories(id),
    stock_quantity INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create orders table
CREATE TABLE IF NOT EXISTS orders (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    total_amount DECIMAL(10,2) NOT NULL,
    status VARCHAR(20) DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert sample data
INSERT INTO categories (name, description) VALUES
('Electronics', 'Electronic devices and gadgets'),
('Clothing', 'Fashion and apparel'),
('Books', 'Books and literature')
ON CONFLICT DO NOTHING;

INSERT INTO products (name, description, price, category_id, stock_quantity) VALUES
('Laptop', 'High-performance laptop', 999.99, 1, 10),
('T-Shirt', 'Cotton t-shirt', 19.99, 2, 50),
('Programming Book', 'Learn to code', 39.99, 3, 25)
ON CONFLICT DO NOTHING;

\dt
EOF
"
```

**Option F: Fix Migration Job to Handle Missing Scripts**
```bash
# Update migration_job.yaml to check for available scripts
# The job will try multiple script names and provide diagnostics
kubectl delete job database-migration -n routeclouds-ns
kubectl apply -f migration_job.yaml  # Uses updated version with script detection
```

---

## 🔍 **Step 4: Fix Missing Dependencies**

### **Check Required Resources:**

```bash
# Check if secrets exist
kubectl get secret db-secrets -n routeclouds-ns
# Expected: db-secrets should exist

# Check if configmap exists  
kubectl get configmap app-config -n routeclouds-ns
# Expected: app-config should exist

# Check namespace exists
kubectl get namespace routeclouds-ns
# Expected: routeclouds-ns should be Active
```

**Fix Missing Resources:**

```bash
# Create namespace if missing
kubectl apply -f namespace.yaml

# Create/update secrets
./update-db-secrets.sh

# Create configmap
kubectl apply -f configmap.yaml

# Verify all resources exist
kubectl get secret,configmap -n routeclouds-ns
```

---

## 🔍 **Step 5: Test with Simple Migration Job**

Create a test job to isolate issues:

```bash
# Apply the test migration job
kubectl apply -f test-migration-job.yaml

# Monitor the test job
kubectl get jobs -n routeclouds-ns
kubectl logs job/test-migration -n routeclouds-ns -f

# Expected output should show:
# - Environment variables are set
# - Database connection succeeds
# - PostgreSQL version information
```

**If test job fails:**
- Check the logs for specific error messages
- Verify database credentials are correct
- Ensure database is accessible from cluster

---

## 🔍 **Step 6: Database Connectivity Verification**

```bash
# Test database connection manually
kubectl run db-test --rm -it --image=postgres:13 -n routeclouds-ns --restart=Never -- bash

# Inside the pod, test connection:
# PGPASSWORD='your-password' psql -h routeclouds-prod-db.xxx.us-east-1.rds.amazonaws.com -U routeclouds_user -d routeclouds_ecommerce_db -c "SELECT version();"
```

**Common Database Issues:**
- **Connection timeout**: Security group or network issues
- **Authentication failed**: Wrong credentials in secrets
- **Database not found**: Wrong database name
- **Host not found**: DNS resolution issues

---

## 🔧 **Step 7: Clean Up and Retry**

```bash
# Delete failed migration job
kubectl delete job database-migration -n routeclouds-ns

# Clean up any stuck pods
kubectl delete pods -n routeclouds-ns --field-selector=status.phase=Failed
kubectl delete pods -n routeclouds-ns --field-selector=status.phase=Succeeded

# Reapply the migration job
kubectl apply -f migration_job.yaml

# Monitor progress
kubectl get jobs -n routeclouds-ns -w
```

---

## 🔧 **Step 8: Complete Image Rebuild Strategy (RECOMMENDED)**

### **Why Rebuild the Image? (Fixes ALL Issues)**

**Current Problems with the Image:**
1. ❌ Missing `/bin/bash` shell (causes StartError)
2. ❌ Missing npm scripts: `migrate` and `seed`
3. ❌ No debugging tools for troubleshooting
4. ❌ Minimal base image lacks essential utilities

**Benefits of Rebuilding:**
- ✅ Fixes shell issues permanently
- ✅ Adds proper migration and seeding scripts
- ✅ Includes debugging tools (curl, postgresql-client, etc.)
- ✅ Better for production deployments
- ✅ Consistent environment across all deployments
- ✅ Easier troubleshooting and maintenance

### **Complete Image Rebuild Strategy**

**Strategy 1: Complete Backend Image Rebuild (RECOMMENDED)**
```bash
# Navigate to your backend directory
cd ../backend/

# Create a comprehensive Dockerfile that fixes all issues
cat > Dockerfile.complete << EOF
# Use a base image with shell support
FROM node:16-slim

# Install system dependencies and debugging tools
RUN apt-get update && apt-get install -y \\
    bash \\
    curl \\
    wget \\
    postgresql-client \\
    vim \\
    git \\
    && rm -rf /var/lib/apt/lists/*

# Create app directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy application code
COPY . .

# Create a proper package.json with migration scripts
RUN npm pkg set scripts.migrate="node -e \"console.log('Running database migrations...'); require('./migrations/migrate.js')\""
RUN npm pkg set scripts.seed="node -e \"console.log('Running database seeding...'); require('./seeds/seed.js')\""
RUN npm pkg set scripts.db:setup="npm run migrate && npm run seed"

# Create migration and seed directories if they don't exist
RUN mkdir -p migrations seeds

# Create basic migration script
RUN cat > migrations/migrate.js << 'MIGRATE_EOF'
const { Client } = require('pg');

async function runMigrations() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL
  });

  try {
    await client.connect();
    console.log('Connected to database for migrations');

    // Create users table
    await client.query(\`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        email VARCHAR(100) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    \`);

    // Create categories table
    await client.query(\`
      CREATE TABLE IF NOT EXISTS categories (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    \`);

    // Create products table
    await client.query(\`
      CREATE TABLE IF NOT EXISTS products (
        id SERIAL PRIMARY KEY,
        name VARCHAR(200) NOT NULL,
        description TEXT,
        price DECIMAL(10,2) NOT NULL,
        category_id INTEGER REFERENCES categories(id),
        stock_quantity INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    \`);

    // Create orders table
    await client.query(\`
      CREATE TABLE IF NOT EXISTS orders (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        total_amount DECIMAL(10,2) NOT NULL,
        status VARCHAR(20) DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    \`);

    console.log('Database migrations completed successfully');
  } catch (error) {
    console.error('Migration error:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

runMigrations();
MIGRATE_EOF

# Create basic seed script
RUN cat > seeds/seed.js << 'SEED_EOF'
const { Client } = require('pg');

async function runSeeds() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL
  });

  try {
    await client.connect();
    console.log('Connected to database for seeding');

    // Insert sample categories
    await client.query(\`
      INSERT INTO categories (name, description) VALUES
      ('Electronics', 'Electronic devices and gadgets'),
      ('Clothing', 'Fashion and apparel'),
      ('Books', 'Books and literature')
      ON CONFLICT DO NOTHING
    \`);

    // Insert sample products
    await client.query(\`
      INSERT INTO products (name, description, price, category_id, stock_quantity) VALUES
      ('Laptop', 'High-performance laptop', 999.99, 1, 10),
      ('T-Shirt', 'Cotton t-shirt', 19.99, 2, 50),
      ('Programming Book', 'Learn to code', 39.99, 3, 25)
      ON CONFLICT DO NOTHING
    \`);

    console.log('Database seeding completed successfully');
  } catch (error) {
    console.error('Seeding error:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

runSeeds();
SEED_EOF

# Set proper permissions
RUN chmod +x migrations/migrate.js seeds/seed.js

# Create non-root user
RUN useradd -m -s /bin/bash node || true
RUN chown -R node:node /app
USER node

# Set bash as default shell
SHELL ["/bin/bash", "-c"]

# Expose port
EXPOSE 3000

# Default command
CMD ["npm", "start"]
EOF

# Build the complete image
docker build -f Dockerfile.complete -t awsfreetier30/routeclouds-backend:v2 .

# Test the new image
docker run --rm awsfreetier30/routeclouds-backend:v2 npm run

# Push to Docker Hub
docker push awsfreetier30/routeclouds-backend:v2

# Update migration_job.yaml to use new image
# Change: image: awsfreetier30/routeclouds-backend:v2
```

**Strategy 2: Rebuild Main Image with Shell**
```bash
# Edit your main Dockerfile
# Change FROM line from:
# FROM node:alpine
# to:
# FROM node:16-slim

# Or add shell installation:
# RUN apt-get update && apt-get install -y bash && rm -rf /var/lib/apt/lists/*

# Rebuild and push
docker build -t awsfreetier30/routeclouds-backend:latest .
docker push awsfreetier30/routeclouds-backend:latest
```

**Strategy 3: Multi-Stage Build with Shell**
```bash
# Create optimized Dockerfile with shell support
cat > Dockerfile.optimized << EOF
# Build stage
FROM node:16-slim as builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

# Runtime stage with shell
FROM node:16-slim
RUN apt-get update && apt-get install -y bash curl && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY . .
EXPOSE 3000
CMD ["npm", "start"]
EOF

# Build and push
docker build -f Dockerfile.optimized -t awsfreetier30/routeclouds-backend:v2 .
docker push awsfreetier30/routeclouds-backend:v2
```

### **Testing the New Image**

```bash
# Test the new image locally
docker run --rm -it awsfreetier30/routeclouds-backend:migration /bin/bash -c "echo 'Shell test successful'"

# Test npm commands
docker run --rm -it awsfreetier30/routeclouds-backend:migration /bin/bash -c "npm --version"

# Update migration job to use new image
kubectl delete job database-migration -n routeclouds-ns
# Edit migration_job.yaml to use new image
kubectl apply -f migration_job.yaml
```

---

## 🔧 **Step 9: Advanced Troubleshooting**

### **Check Resource Constraints:**

```bash
# Check node resources
kubectl top nodes

# Check if pods are pending due to resources
kubectl get pods -n routeclouds-ns | grep Pending

# Describe pending pods
kubectl describe pod <pending-pod-name> -n routeclouds-ns
```

### **Check Container Command Issues:**

```bash
# Test the container command manually
kubectl run debug-migration --rm -it --image=awsfreetier30/routeclouds-backend:latest -n routeclouds-ns --restart=Never -- bash

# Inside the container, test commands:
# npm run migrate
# npm run seed
```

---

## ✅ **Success Indicators**

**Job completed successfully when you see:**
```bash
kubectl get jobs -n routeclouds-ns
# NAME                 COMPLETIONS   DURATION   AGE
# database-migration   1/1           45s        2m
```

**Verification steps:**
```bash
# Check job completion
kubectl get job database-migration -n routeclouds-ns -o jsonpath='{.status.conditions[0].type}'
# Should return: Complete

# Check migration logs
kubectl logs job/database-migration -n routeclouds-ns
# Should show successful migration and seeding

# Verify database tables were created (correct method)
DB_PASSWORD=$(kubectl get secret db-secrets -n routeclouds-ns -o jsonpath='{.data.DB_PASSWORD}' | base64 -d)
DB_HOST=$(kubectl get secret db-secrets -n routeclouds-ns -o jsonpath='{.data.DB_HOST}' | base64 -d)
DB_USER=$(kubectl get secret db-secrets -n routeclouds-ns -o jsonpath='{.data.DB_USER}' | base64 -d)
DB_NAME=$(kubectl get secret db-secrets -n routeclouds-ns -o jsonpath='{.data.DB_NAME}' | base64 -d)

kubectl run db-verify --rm -it --image=postgres:13 -n routeclouds-ns --restart=Never -- bash -c "
PGPASSWORD='$DB_PASSWORD' psql -h '$DB_HOST' -U '$DB_USER' -d '$DB_NAME' -c '\dt'"
```

---

## 🚨 **Emergency Recovery**

**If everything fails:**

```bash
# 1. Reset everything
kubectl delete job database-migration -n routeclouds-ns
kubectl delete job test-migration -n routeclouds-ns

# 2. Recreate secrets and configmaps
kubectl delete secret db-secrets -n routeclouds-ns
kubectl delete configmap app-config -n routeclouds-ns
kubectl apply -f configmap.yaml
./update-db-secrets.sh

# 3. Test basic connectivity
kubectl run emergency-db-test --rm -it --image=postgres:13 -n routeclouds-ns --restart=Never -- bash

# 4. Try migration again
kubectl apply -f migration_job.yaml
```

---

## 🎯 **FINAL RECOMMENDATION: Complete Image Rebuild**

### **Why You Should Rebuild the Image:**

**Current Issues with awsfreetier30/routeclouds-backend:latest:**
1. ❌ **Missing Shell**: No `/bin/bash` causing StartError
2. ❌ **Missing Scripts**: No `migrate` or `seed` npm scripts
3. ❌ **No Migration Logic**: No actual database migration code
4. ❌ **Limited Debugging**: No tools for troubleshooting
5. ❌ **Production Issues**: Will cause problems in CI/CD pipelines

**Benefits of Complete Rebuild:**
1. ✅ **Fixes All Issues**: Shell, scripts, and migration logic
2. ✅ **Production Ready**: Proper database schema and seeding
3. ✅ **Better Debugging**: Includes postgresql-client, curl, vim
4. ✅ **Future Proof**: Won't have these issues again
5. ✅ **Complete E-commerce Schema**: Users, products, orders, categories

### **Automated Rebuild Process:**

```bash
# Navigate to backend directory
cd backend/  # or wherever your backend code is

# Run the complete rebuild script
../rebuild-complete-image.sh

# Follow the prompts to push to Docker Hub
# The script will automatically update your migration_job.yaml
```

### **Manual Rebuild Process:**

```bash
# If you prefer manual control, follow Strategy 1 in Step 8 above
# This gives you full control over the build process
```

### **After Rebuilding:**

```bash
# Clean up old failed jobs
kubectl delete job database-migration -n routeclouds-ns

# Apply the updated migration job (now uses new image)
kubectl apply -f k8s/migration_job.yaml

# Monitor the migration
kubectl get jobs -n routeclouds-ns -w

# Check logs
kubectl logs job/database-migration -n routeclouds-ns -f

# Verify database tables
kubectl run db-verify --rm -it --image=postgres:13 -n routeclouds-ns --restart=Never -- bash -c "
PGPASSWORD='\$DB_PASSWORD' psql -h '\$DB_HOST' -U '\$DB_USER' -d '\$DB_NAME' -c '\dt'"
```

**Expected Result After Rebuild:**
- ✅ Migration job completes successfully
- ✅ Database has proper e-commerce tables
- ✅ Sample data is seeded
- ✅ Ready for application deployment

---

## 📞 **Quick Reference Commands**

```bash
# Status check
kubectl get jobs,pods -n routeclouds-ns | grep migration

# Logs
kubectl logs job/database-migration -n routeclouds-ns

# Cleanup
kubectl delete job database-migration -n routeclouds-ns

# Retry
kubectl apply -f migration_job.yaml

# Monitor
kubectl get jobs -n routeclouds-ns -w
```

---

## 🎯 **Next Steps After Successful Migration**

Once migration completes successfully:

```bash
# Verify database has tables
kubectl run db-verify --rm -it --image=postgres:13 -n routeclouds-ns --restart=Never -- bash
# Inside: PGPASSWORD='password' psql -h host -U user -d db -c "\dt"

# Deploy backend application
kubectl apply -f backend.yaml

# Deploy frontend application  
kubectl apply -f frontend.yaml

# Check application status
kubectl get pods -n routeclouds-ns
```
