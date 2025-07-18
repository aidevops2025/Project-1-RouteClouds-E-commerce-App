#!/bin/bash

# EKS Node Group Troubleshooting Script
# This script checks common issues that cause EKS node group creation failures.

set -e

read -p "Enter your AWS region: " REGION
read -p "Enter your EKS cluster name: " CLUSTER_NAME
read -p "Enter your node group IAM role name: " NODE_ROLE
read -p "Enter your subnet IDs (comma-separated): " SUBNET_IDS
read -p "Enter your desired instance type (e.g., t3.medium): " INSTANCE_TYPE

IFS=',' read -ra SUBNET_ARRAY <<< "$SUBNET_IDS"

echo "\n==== 1. Subnet Tagging ===="
for SUBNET in "${SUBNET_ARRAY[@]}"; do
  echo "\nSubnet: $SUBNET"
  aws ec2 describe-subnets --subnet-ids "$SUBNET" --region "$REGION" --query "Subnets[0].Tags"
done

echo "\n==== 2. IAM Role Policies for Node Group ===="
aws iam list-attached-role-policies --role-name "$NODE_ROLE"

echo "\n==== 3. Instance Type Availability in Region ===="
aws ec2 describe-instance-type-offerings \
  --location-type availability-zone \
  --region "$REGION" \
  --filters Name=instance-type,Values="$INSTANCE_TYPE"

echo "\n==== 4. Security Groups for Subnets ===="
for SUBNET in "${SUBNET_ARRAY[@]}"; do
  echo "\nSubnet: $SUBNET"
  RT_ID=$(aws ec2 describe-route-tables --filters Name=association.subnet-id,Values="$SUBNET" --region "$REGION" --query "RouteTables[0].RouteTableId" --output text)
  echo "Route Table: $RT_ID"
  aws ec2 describe-route-tables --route-table-ids "$RT_ID" --region "$REGION"
done

echo "\n==== 5. List NAT Gateways in Region ===="
aws ec2 describe-nat-gateways --region "$REGION" --query "NatGateways[*].{ID:NatGatewayId,State:State,SubnetId:SubnetId}"

echo "\n==== 6. List Internet Gateways in Region ===="
aws ec2 describe-internet-gateways --region "$REGION" --query "InternetGateways[*].{ID:InternetGatewayId,Attachments:Attachments}"

echo "\n==== 7. Security Groups (all) ===="
aws ec2 describe-security-groups --region "$REGION" --query "SecurityGroups[*].{ID:GroupId,Name:GroupName,Ingress:IpPermissions,Egress:IpPermissions}" --output table

echo "\n==== Done. Review the output above for any misconfigurations or missing tags/policies. ====" 