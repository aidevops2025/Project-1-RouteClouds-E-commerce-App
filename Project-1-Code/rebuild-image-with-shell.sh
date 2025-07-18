#!/bin/bash

# Script to rebuild RouteClouds backend image with shell support
# This fixes the "bash not found" issue in migration jobs

set -e

echo "🔧 RouteClouds Image Rebuild with Shell Support"
echo "=============================================="

# Configuration
IMAGE_NAME="awsfreetier30/routeclouds-backend"
ORIGINAL_TAG="latest"
SHELL_TAG="with-shell"
MIGRATION_TAG="migration"

echo "📋 Current configuration:"
echo "   Base image: $IMAGE_NAME:$ORIGINAL_TAG"
echo "   New image: $IMAGE_NAME:$SHELL_TAG"
echo "   Migration image: $IMAGE_NAME:$MIGRATION_TAG"
echo ""

# Check if original image exists
echo "🔍 Checking if original image exists..."
if docker pull $IMAGE_NAME:$ORIGINAL_TAG; then
    echo "✅ Original image found and pulled"
else
    echo "❌ Original image not found. Please build the base image first."
    exit 1
fi

# Create Dockerfile for shell-enabled image
echo "📝 Creating Dockerfile with shell support..."
cat > Dockerfile.shell << EOF
# Use the existing backend image as base
FROM $IMAGE_NAME:$ORIGINAL_TAG

# Switch to root to install packages
USER root

# Install bash and essential debugging tools
RUN apt-get update && apt-get install -y \\
    bash \\
    curl \\
    wget \\
    postgresql-client \\
    vim \\
    && rm -rf /var/lib/apt/lists/*

# Create a non-root user if it doesn't exist
RUN id -u node &>/dev/null || useradd -m -s /bin/bash node

# Switch back to node user for security
USER node

# Set bash as default shell
SHELL ["/bin/bash", "-c"]

# Set working directory
WORKDIR /app

# Default command (can be overridden)
CMD ["npm", "start"]
EOF

echo "✅ Dockerfile.shell created"

# Build the shell-enabled image
echo "🔨 Building image with shell support..."
docker build -f Dockerfile.shell -t $IMAGE_NAME:$SHELL_TAG .

echo "✅ Image built successfully: $IMAGE_NAME:$SHELL_TAG"

# Test the new image
echo "🧪 Testing shell functionality..."
if docker run --rm $IMAGE_NAME:$SHELL_TAG /bin/bash -c "echo 'Shell test successful'"; then
    echo "✅ Shell test passed"
else
    echo "❌ Shell test failed"
    exit 1
fi

# Test npm functionality
echo "🧪 Testing npm functionality..."
if docker run --rm $IMAGE_NAME:$SHELL_TAG /bin/bash -c "npm --version"; then
    echo "✅ NPM test passed"
else
    echo "❌ NPM test failed"
    exit 1
fi

# Create migration-specific tag
echo "🏷️  Creating migration-specific tag..."
docker tag $IMAGE_NAME:$SHELL_TAG $IMAGE_NAME:$MIGRATION_TAG
echo "✅ Migration tag created: $IMAGE_NAME:$MIGRATION_TAG"

# Push images to Docker Hub
echo "📤 Pushing images to Docker Hub..."
read -p "Do you want to push the images to Docker Hub? (y/n): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "Pushing $IMAGE_NAME:$SHELL_TAG..."
    docker push $IMAGE_NAME:$SHELL_TAG
    
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
    sed -i "s|image: $IMAGE_NAME:$ORIGINAL_TAG|image: $IMAGE_NAME:$MIGRATION_TAG|g" k8s/migration_job.yaml
    
    echo "✅ Updated migration_job.yaml to use $IMAGE_NAME:$MIGRATION_TAG"
    echo "📄 Backup created: k8s/migration_job.yaml.backup"
else
    echo "⚠️  migration_job.yaml not found in k8s/ directory"
fi

# Cleanup
echo "🧹 Cleaning up temporary files..."
rm -f Dockerfile.shell

echo ""
echo "🎉 Image rebuild completed successfully!"
echo ""
echo "📋 Summary:"
echo "   ✅ Created shell-enabled image: $IMAGE_NAME:$SHELL_TAG"
echo "   ✅ Created migration image: $IMAGE_NAME:$MIGRATION_TAG"
echo "   ✅ Updated migration_job.yaml (backup created)"
echo ""
echo "🚀 Next steps:"
echo "   1. Delete existing failed migration job:"
echo "      kubectl delete job database-migration -n routeclouds-ns"
echo ""
echo "   2. Apply updated migration job:"
echo "      kubectl apply -f k8s/migration_job.yaml"
echo ""
echo "   3. Monitor the job:"
echo "      kubectl get jobs -n routeclouds-ns -w"
echo ""
echo "   4. Check logs:"
echo "      kubectl logs job/database-migration -n routeclouds-ns -f"
echo ""
echo "💡 The new image includes bash, curl, postgresql-client, and other debugging tools!"
