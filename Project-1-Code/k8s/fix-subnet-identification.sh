#!/bin/bash

# RouteClouds Subnet Identification and Tagging Fix Script
# This script addresses the issue where public subnets are not properly identified
# due to MapPublicIpOnLaunch being set to False

set -e

echo "🔧 RouteClouds Subnet Identification and Tagging Fix"
echo "=================================================="

# Get VPC ID
VPC_ID=$(aws eks describe-cluster --name routeclouds-prod-cluster --query 'cluster.resourcesVpcConfig.vpcId' --output text)
echo "📍 VPC ID: $VPC_ID"

# Method 1: Identify by name pattern
echo ""
echo "🔍 Method 1: Identifying subnets by name pattern..."
PUBLIC_SUBNETS=$(aws ec2 describe-subnets \
    --filters "Name=vpc-id,Values=$VPC_ID" \
    --query 'Subnets[?contains(Tags[?Key==`Name`].Value|[0], `public`)].SubnetId' \
    --output text)

if [ -n "$PUBLIC_SUBNETS" ]; then
    echo "✅ Found public subnets by name: $PUBLIC_SUBNETS"
else
    echo "⚠️  No subnets found with 'public' in name"
    
    # Method 2: Identify by CIDR pattern
    echo ""
    echo "🔍 Method 2: Identifying by CIDR pattern..."
    PUBLIC_SUBNETS=$(aws ec2 describe-subnets \
        --filters "Name=vpc-id,Values=$VPC_ID" \
        --query 'Subnets[?CidrBlock==`10.0.101.0/24` || CidrBlock==`10.0.102.0/24`].SubnetId' \
        --output text)
    
    if [ -n "$PUBLIC_SUBNETS" ]; then
        echo "✅ Found public subnets by CIDR: $PUBLIC_SUBNETS"
    else
        echo "❌ Could not identify public subnets automatically"
        echo "Please check your subnet configuration manually"
        exit 1
    fi
fi

# Get private subnets (exclude RDS subnets)
PRIVATE_SUBNETS=$(aws ec2 describe-subnets \
    --filters "Name=vpc-id,Values=$VPC_ID" \
    --query 'Subnets[?contains(Tags[?Key==`Name`].Value|[0], `private`) && !contains(Tags[?Key==`Name`].Value|[0], `RDS`)].SubnetId' \
    --output text)

echo "✅ Found private subnets: $PRIVATE_SUBNETS"

# Verify subnet counts
PUBLIC_COUNT=$(echo $PUBLIC_SUBNETS | wc -w)
PRIVATE_COUNT=$(echo $PRIVATE_SUBNETS | wc -w)

echo ""
echo "📊 Subnet Summary:"
echo "   Public subnets: $PUBLIC_COUNT"
echo "   Private subnets: $PRIVATE_COUNT"

if [ $PUBLIC_COUNT -lt 2 ]; then
    echo "❌ ERROR: Need at least 2 public subnets for ALB"
    exit 1
fi

# Display subnet details
echo ""
echo "📋 Public Subnet Details:"
for subnet in $PUBLIC_SUBNETS; do
    aws ec2 describe-subnets --subnet-ids $subnet \
        --query 'Subnets[0].{SubnetId:SubnetId,AZ:AvailabilityZone,CIDR:CidrBlock,MapPublic:MapPublicIpOnLaunch,Name:Tags[?Key==`Name`].Value|[0]}' \
        --output table
done

echo ""
echo "📋 Private Subnet Details:"
for subnet in $PRIVATE_SUBNETS; do
    aws ec2 describe-subnets --subnet-ids $subnet \
        --query 'Subnets[0].{SubnetId:SubnetId,AZ:AvailabilityZone,CIDR:CidrBlock,Name:Tags[?Key==`Name`].Value|[0]}' \
        --output table
done

# Tag subnets for ALB
echo ""
echo "🏷️  Tagging subnets for ALB..."

# Convert to arrays
PUBLIC_SUBNET_ARRAY=($PUBLIC_SUBNETS)
PRIVATE_SUBNET_ARRAY=($PRIVATE_SUBNETS)

# Tag public subnets
echo "Tagging public subnets for internet-facing ALB..."
for subnet in "${PUBLIC_SUBNET_ARRAY[@]}"; do
    echo "  Tagging $subnet..."
    aws ec2 create-tags \
        --resources $subnet \
        --tags Key=kubernetes.io/role/elb,Value=1
    
    aws ec2 create-tags \
        --resources $subnet \
        --tags Key=kubernetes.io/cluster/routeclouds-prod-cluster,Value=shared
done

# Tag private subnets
echo "Tagging private subnets for internal ELB..."
for subnet in "${PRIVATE_SUBNET_ARRAY[@]}"; do
    echo "  Tagging $subnet..."
    aws ec2 create-tags \
        --resources $subnet \
        --tags Key=kubernetes.io/role/internal-elb,Value=1
    
    aws ec2 create-tags \
        --resources $subnet \
        --tags Key=kubernetes.io/cluster/routeclouds-prod-cluster,Value=shared
done

echo ""
echo "✅ Subnet tagging completed!"

# Verify tags
echo ""
echo "🔍 Verifying tags..."
echo "Public subnet tags:"
for subnet in "${PUBLIC_SUBNET_ARRAY[@]}"; do
    echo "  Subnet: $subnet"
    aws ec2 describe-tags \
        --filters "Name=resource-id,Values=$subnet" \
        --query 'Tags[?Key==`kubernetes.io/role/elb` || Key==`kubernetes.io/cluster/routeclouds-prod-cluster`].{Key:Key,Value:Value}' \
        --output table
done

echo ""
echo "Private subnet tags:"
for subnet in "${PRIVATE_SUBNET_ARRAY[@]}"; do
    echo "  Subnet: $subnet"
    aws ec2 describe-tags \
        --filters "Name=resource-id,Values=$subnet" \
        --query 'Tags[?Key==`kubernetes.io/role/internal-elb` || Key==`kubernetes.io/cluster/routeclouds-prod-cluster`].{Key:Key,Value:Value}' \
        --output table
done

echo ""
echo "🎉 Subnet identification and tagging completed successfully!"
echo "You can now proceed with ALB controller installation and ingress deployment."

# Export variables for use in other scripts
echo ""
echo "📤 Exporting subnet variables..."
echo "export PUBLIC_SUBNETS=\"$PUBLIC_SUBNETS\"" > subnet_vars.env
echo "export PRIVATE_SUBNETS=\"$PRIVATE_SUBNETS\"" >> subnet_vars.env
echo "export VPC_ID=\"$VPC_ID\"" >> subnet_vars.env

echo "✅ Subnet variables saved to subnet_vars.env"
echo "   You can source this file: source subnet_vars.env"
