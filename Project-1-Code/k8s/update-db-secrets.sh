#!/bin/bash

# Script to update Kubernetes database secrets with current AWS RDS credentials
# This ensures the secrets are always in sync with the actual database

set -e

echo "🔍 Retrieving database credentials from AWS Secrets Manager..."

# Get the secret value from AWS Secrets Manager
SECRET_VALUE=$(aws secretsmanager get-secret-value \
    --secret-id db/routeclouds-prod-db \
    --region us-east-1 \
    --query SecretString \
    --output text)

echo "✅ Retrieved secret from AWS Secrets Manager"

# Parse the PostgreSQL connection string
# Format: postgresql://username:password@host:port/database
DB_USER=$(echo "$SECRET_VALUE" | sed -n 's/.*:\/\/\([^:]*\):.*/\1/p')
DB_PASSWORD=$(echo "$SECRET_VALUE" | sed -n 's/.*:\/\/[^:]*:\([^@]*\)@.*/\1/p')
DB_HOST=$(echo "$SECRET_VALUE" | sed -n 's/.*@\([^:]*\):.*/\1/p')
DB_PORT=$(echo "$SECRET_VALUE" | sed -n 's/.*:\([0-9]*\)\/.*/\1/p')
DB_NAME=$(echo "$SECRET_VALUE" | sed -n 's/.*\/\([^?]*\).*/\1/p')

echo "📋 Parsed credentials:"
echo "  DB_HOST: $DB_HOST"
echo "  DB_USER: $DB_USER"
echo "  DB_NAME: $DB_NAME"
echo "  DB_PORT: $DB_PORT"
echo "  DB_PASSWORD: [HIDDEN]"

# Base64 encode the values
DB_HOST_B64=$(echo -n "$DB_HOST" | base64 -w 0)
DB_USER_B64=$(echo -n "$DB_USER" | base64 -w 0)
DB_PASSWORD_B64=$(echo -n "$DB_PASSWORD" | base64 -w 0)
DB_NAME_B64=$(echo -n "$DB_NAME" | base64 -w 0)
DATABASE_URL_B64=$(echo -n "$SECRET_VALUE" | base64 -w 0)
SECRET_KEY_B64=$(echo -n "some-random-secret-key" | base64 -w 0)

echo "🔄 Updating Kubernetes secret..."

# Check if secret exists, create or update accordingly
if kubectl get secret db-secrets -n routeclouds-ns >/dev/null 2>&1; then
    echo "Secret exists, updating..."
    # Update the existing Kubernetes secret
    kubectl patch secret db-secrets -n routeclouds-ns --type='merge' -p="{
      \"data\": {
        \"DB_HOST\": \"$DB_HOST_B64\",
        \"DB_USER\": \"$DB_USER_B64\",
        \"DB_PASSWORD\": \"$DB_PASSWORD_B64\",
        \"DB_NAME\": \"$DB_NAME_B64\",
        \"DATABASE_URL\": \"$DATABASE_URL_B64\",
        \"SECRET_KEY\": \"$SECRET_KEY_B64\"
      }
    }"
    echo "✅ Kubernetes secret updated successfully!"
else
    echo "Secret doesn't exist, creating new one..."
    # Create new secret
    kubectl create secret generic db-secrets \
        --from-literal=DB_HOST="$DB_HOST" \
        --from-literal=DB_USER="$DB_USER" \
        --from-literal=DB_PASSWORD="$DB_PASSWORD" \
        --from-literal=DB_NAME="$DB_NAME" \
        --from-literal=DATABASE_URL="$SECRET_VALUE" \
        --from-literal=SECRET_KEY="some-random-secret-key" \
        -n routeclouds-ns
    echo "✅ Kubernetes secret created successfully!"
fi

echo ""
echo "🧪 Testing database connectivity..."

# Clean up any existing test pods first
echo "🧹 Cleaning up any existing test pods..."
kubectl delete pod db-connectivity-test -n routeclouds-ns --ignore-not-found=true

# Wait a moment for cleanup
sleep 2

# Test database connectivity
echo "Creating test pod..."
kubectl run db-connectivity-test --rm -it --image=postgres:13 -n routeclouds-ns --restart=Never -- bash -c "
echo 'Testing connection to database...'
PGPASSWORD='$DB_PASSWORD' psql -h '$DB_HOST' -U '$DB_USER' -d '$DB_NAME' -c 'SELECT version();'
echo 'Database connectivity test completed!'
"

echo "🎉 Database connectivity test completed!"

# Additional cleanup (in case the pod gets stuck)
echo ""
echo "📝 If the test pod gets stuck, use these cleanup commands:"
echo "   kubectl delete pod db-connectivity-test -n routeclouds-ns --force --grace-period=0"
echo "   kubectl get pods -n routeclouds-ns | grep db-connectivity-test"
