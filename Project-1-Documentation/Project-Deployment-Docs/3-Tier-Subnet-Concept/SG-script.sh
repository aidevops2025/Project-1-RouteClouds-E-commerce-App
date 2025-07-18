#!/bin/bash

# Output directory - use home directory to avoid permission issues
OUTPUT_DIR="$HOME/sg_analysis"
mkdir -p "$OUTPUT_DIR"

echo "AWS credentials setup"
echo "====================="
echo "Please enter your AWS credentials:"
read -p "AWS Access Key ID: " AWS_ACCESS_KEY_ID
read -p "AWS Secret Access Key: " AWS_SECRET_ACCESS_KEY
read -p "AWS Region [us-east-1]: " AWS_REGION
AWS_REGION=${AWS_REGION:-us-east-1}

# Export the credentials
export AWS_ACCESS_KEY_ID
export AWS_SECRET_ACCESS_KEY
export AWS_DEFAULT_REGION="$AWS_REGION"

# Verify credentials
echo "Verifying AWS credentials..."
if ! aws sts get-caller-identity &>/dev/null; then
    echo "AWS credentials verification failed. Please check your credentials and try again."
    exit 1
fi
echo "AWS credentials verified successfully!"

# Get the VPC ID from your EKS cluster
read -p "Enter your EKS cluster name [bootcamp-dev-cluster]: " CLUSTER_NAME
CLUSTER_NAME=${CLUSTER_NAME:-bootcamp-dev-cluster}

echo "Retrieving VPC ID from EKS cluster: $CLUSTER_NAME"
VPC_ID=$(aws eks describe-cluster --name $CLUSTER_NAME --region $AWS_DEFAULT_REGION --query "cluster.resourcesVpcConfig.vpcId" --output text)

if [ -z "$VPC_ID" ] || [ "$VPC_ID" == "None" ]; then
    echo "Failed to retrieve VPC ID from EKS cluster. Would you like to enter it manually? (y/n)"
    read -p "> " MANUAL_VPC
    if [[ "$MANUAL_VPC" == "y" ]]; then
        read -p "Enter VPC ID: " VPC_ID
    else
        echo "Exiting script."
        exit 1
    fi
fi

echo "Analyzing security groups for VPC: $VPC_ID"

# Get all security groups in the VPC
echo "Fetching all security groups..."
SG_IDS=$(aws ec2 describe-security-groups --filters "Name=vpc-id,Values=$VPC_ID" --query "SecurityGroups[*].GroupId" --output text --region $AWS_DEFAULT_REGION)

if [ -z "$SG_IDS" ]; then
    echo "No security groups found in VPC $VPC_ID. Exiting."
    exit 1
fi

echo "Found security groups: $SG_IDS"

# Function to get security group details
get_sg_details() {
    local sg_id=$1
    echo "Analyzing security group: $sg_id"
    
    # Get basic info
    aws ec2 describe-security-groups --group-ids $sg_id --region $AWS_DEFAULT_REGION > "$OUTPUT_DIR/${sg_id}_details.json"
    
    # Extract name and description
    SG_NAME=$(aws ec2 describe-security-groups --group-ids $sg_id --query "SecurityGroups[0].GroupName" --output text --region $AWS_DEFAULT_REGION)
    SG_DESC=$(aws ec2 describe-security-groups --group-ids $sg_id --query "SecurityGroups[0].Description" --output text --region $AWS_DEFAULT_REGION)
    
    echo "Security Group: $sg_id ($SG_NAME)" > "$OUTPUT_DIR/${sg_id}_summary.txt"
    echo "Description: $SG_DESC" >> "$OUTPUT_DIR/${sg_id}_summary.txt"
    echo "" >> "$OUTPUT_DIR/${sg_id}_summary.txt"
    
    # Analyze inbound rules
    echo "INBOUND RULES:" >> "$OUTPUT_DIR/${sg_id}_summary.txt"
    aws ec2 describe-security-groups --group-ids $sg_id --query "SecurityGroups[0].IpPermissions" --output json --region $AWS_DEFAULT_REGION | jq -r '.[] | "Protocol: \(.IpProtocol) | Ports: \(.FromPort)-\(.ToPort) | Source: \(if .UserIdGroupPairs then .UserIdGroupPairs[].GroupId else .IpRanges[].CidrIp end)"' >> "$OUTPUT_DIR/${sg_id}_summary.txt"
    
    # Analyze outbound rules
    echo "" >> "$OUTPUT_DIR/${sg_id}_summary.txt"
    echo "OUTBOUND RULES:" >> "$OUTPUT_DIR/${sg_id}_summary.txt"
    aws ec2 describe-security-groups --group-ids $sg_id --query "SecurityGroups[0].IpPermissionsEgress" --output json --region $AWS_DEFAULT_REGION | jq -r '.[] | "Protocol: \(.IpProtocol) | Ports: \(.FromPort)-\(.ToPort) | Destination: \(if .UserIdGroupPairs then .UserIdGroupPairs[].GroupId else .IpRanges[].CidrIp end)"' >> "$OUTPUT_DIR/${sg_id}_summary.txt"
    
    # Find references to this security group
    echo "" >> "$OUTPUT_DIR/${sg_id}_summary.txt"
    echo "REFERENCED BY:" >> "$OUTPUT_DIR/${sg_id}_summary.txt"
    for other_sg in $SG_IDS; do
        if [ "$other_sg" != "$sg_id" ]; then
            REFS=$(aws ec2 describe-security-groups --group-ids $other_sg --query "SecurityGroups[0].IpPermissions[].UserIdGroupPairs[?GroupId=='$sg_id'].GroupId" --output text --region $AWS_DEFAULT_REGION)
            if [ ! -z "$REFS" ]; then
                OTHER_SG_NAME=$(aws ec2 describe-security-groups --group-ids $other_sg --query "SecurityGroups[0].GroupName" --output text --region $AWS_DEFAULT_REGION)
                echo "- $other_sg ($OTHER_SG_NAME)" >> "$OUTPUT_DIR/${sg_id}_summary.txt"
            fi
        fi
    done
}

# Process each security group
for sg_id in $SG_IDS; do
    get_sg_details $sg_id
done

# Create a summary file
echo "Creating summary report..."
echo "SECURITY GROUP ANALYSIS SUMMARY" > "$OUTPUT_DIR/summary.txt"
echo "===============================" >> "$OUTPUT_DIR/summary.txt"
echo "" >> "$OUTPUT_DIR/summary.txt"

for sg_id in $SG_IDS; do
    SG_NAME=$(aws ec2 describe-security-groups --group-ids $sg_id --query "SecurityGroups[0].GroupName" --output text --region $AWS_DEFAULT_REGION)
    echo "- $sg_id ($SG_NAME)" >> "$OUTPUT_DIR/summary.txt"
done

# Create a visualization of security group relationships
echo "Creating relationship map..."
echo "digraph SecurityGroups {" > "$OUTPUT_DIR/sg_relationships.dot"
echo "  rankdir=LR;" >> "$OUTPUT_DIR/sg_relationships.dot"
echo "  node [shape=box, style=filled, fillcolor=lightblue];" >> "$OUTPUT_DIR/sg_relationships.dot"

for sg_id in $SG_IDS; do
    SG_NAME=$(aws ec2 describe-security-groups --group-ids $sg_id --query "SecurityGroups[0].GroupName" --output text --region $AWS_DEFAULT_REGION)
    echo "  \"$sg_id\" [label=\"$SG_NAME\\n$sg_id\"];" >> "$OUTPUT_DIR/sg_relationships.dot"
    
    # Find outbound references
    REFS=$(aws ec2 describe-security-groups --group-ids $sg_id --query "SecurityGroups[0].IpPermissionsEgress[].UserIdGroupPairs[].GroupId" --output text --region $AWS_DEFAULT_REGION)
    for ref in $REFS; do
        echo "  \"$sg_id\" -> \"$ref\" [label=\"outbound\"];" >> "$OUTPUT_DIR/sg_relationships.dot"
    done
    
    # Find inbound references
    REFS=$(aws ec2 describe-security-groups --group-ids $sg_id --query "SecurityGroups[0].IpPermissions[].UserIdGroupPairs[].GroupId" --output text --region $AWS_DEFAULT_REGION)
    for ref in $REFS; do
        echo "  \"$sg_id\" -> \"$ref\" [label=\"inbound\", style=dashed, color=red];" >> "$OUTPUT_DIR/sg_relationships.dot"
    done
done

echo "}" >> "$OUTPUT_DIR/sg_relationships.dot"

echo "Analysis complete! Check the $OUTPUT_DIR directory for results."
echo "To visualize the relationships, install Graphviz and run: dot -Tpng $OUTPUT_DIR/sg_relationships.dot -o $OUTPUT_DIR/sg_relationships.png"
