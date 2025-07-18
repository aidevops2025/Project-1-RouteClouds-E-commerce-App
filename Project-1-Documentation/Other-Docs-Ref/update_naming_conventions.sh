#!/bin/bash

# Script to update naming conventions across all RouteClouds documentation
# This script updates:
# - Cluster name: bootcamp-dev-cluster -> routeclouds-prod-cluster
# - Namespace: 3-tier-app-eks -> routeclouds-ns
# - Folder references: 3-tier-app-eks -> RouteClouds-E-Comm-Project
# - Repository: DevOpsDojo -> RouteClouds-Repo
# - Environment: dev -> prod
# - Prefix: bootcamp -> routeclouds

echo "🔄 Starting RouteClouds naming convention updates..."

# Define the directories to update
DOCS_DIR="Core-Concepts-Dir/New-Documents"
PROJECT_DIR="RouteClouds-E-Comm-Project"

# Function to update a single file
update_file() {
    local file="$1"
    echo "📝 Updating: $file"
    
    # Create backup
    cp "$file" "$file.backup"
    
    # Update cluster name references
    sed -i 's/bootcamp-dev-cluster/routeclouds-prod-cluster/g' "$file"
    
    # Update namespace references
    sed -i 's/3-tier-app-eks/routeclouds-ns/g' "$file"
    
    # Update folder references (be careful with paths)
    sed -i 's|DevOps-Project-36/3-tier-app-eks|DevOps-Project-36/RouteClouds-E-Comm-Project|g' "$file"
    sed -i 's|cd 3-tier-app-eks|cd RouteClouds-E-Comm-Project|g' "$file"
    
    # Update repository references
    sed -i 's/DevOpsDojo/RouteClouds-Repo/g' "$file"
    
    # Update environment references (be careful - only specific contexts)
    sed -i 's/environment.*=.*"dev"/environment = "prod"/g' "$file"
    sed -i 's/ENVIRONMENT="dev"/ENVIRONMENT="prod"/g' "$file"
    
    # Update prefix references
    sed -i 's/prefix.*=.*"bootcamp"/prefix = "routeclouds"/g' "$file"
    sed -i 's/PREFIX="bootcamp"/PREFIX="routeclouds"/g' "$file"
    
    # Update database name references
    sed -i 's/bootcamp-dev-db/routeclouds-prod-db/g' "$file"
    
    # Update ingress name references
    sed -i 's/3-tier-app-ingress/routeclouds-ingress/g' "$file"
    
    echo "✅ Updated: $file"
}

# Update all documentation files
echo "📚 Updating documentation files..."
for file in "$DOCS_DIR"/*.md; do
    if [ -f "$file" ]; then
        update_file "$file"
    fi
done

# Update script files in the project directory
echo "📜 Updating script files..."
for script in "$PROJECT_DIR/k8s"/*.sh; do
    if [ -f "$script" ]; then
        update_file "$script"
    fi
done

# Update any remaining YAML files that might have old references
echo "📄 Updating any remaining YAML files..."
for yaml in "$PROJECT_DIR/k8s"/*.yaml; do
    if [ -f "$yaml" ]; then
        # Only update specific references that might have been missed
        sed -i 's/bootcamp-dev-cluster/routeclouds-prod-cluster/g' "$yaml"
        sed -i 's/bootcamp-dev-db/routeclouds-prod-db/g' "$yaml"
    fi
done

echo "🎉 RouteClouds naming convention updates completed!"
echo "📋 Summary of changes:"
echo "   • Cluster: bootcamp-dev-cluster → routeclouds-prod-cluster"
echo "   • Namespace: 3-tier-app-eks → routeclouds-ns"
echo "   • Folder: 3-tier-app-eks → RouteClouds-E-Comm-Project"
echo "   • Repository: DevOpsDojo → RouteClouds-Repo"
echo "   • Environment: dev → prod"
echo "   • Prefix: bootcamp → routeclouds"
echo ""
echo "💾 Backup files created with .backup extension"
echo "🔍 Please review the changes before proceeding with deployment"
