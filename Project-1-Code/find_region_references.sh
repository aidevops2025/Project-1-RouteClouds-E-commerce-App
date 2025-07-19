#!/bin/bash

# Set the directory to search
SEARCH_DIR="/path/to/your/infra"

# Set the region to search for
SEARCH_REGION="ap-south-1"

echo "Searching for '$SEARCH_REGION' in Terraform files under $SEARCH_DIR..."
echo "==============================================================="

# Find all Terraform files and search for the region
find "$SEARCH_DIR" -type f \( -name "*.tf" -o -name "*.tfvars" \) -exec grep -l "$SEARCH_REGION" {} \; | while read -r file; do
    echo "Found in file: $file"
    echo "-------------------"
    grep -n "$SEARCH_REGION" "$file" | while read -r line; do
        line_num=$(echo "$line" | cut -d: -f1)
        content=$(echo "$line" | cut -d: -f2-)
        echo "Line $line_num: $content"
    done
    echo ""
done

# Count total occurrences
total_files=$(find "$SEARCH_DIR" -type f \( -name "*.tf" -o -name "*.tfvars" \) -exec grep -l "$SEARCH_REGION" {} \; | wc -l)
total_occurrences=$(find "$SEARCH_DIR" -type f \( -name "*.tf" -o -name "*.tfvars" \) -exec grep -o "$SEARCH_REGION" {} \; | wc -l)

echo "==============================================================="
echo "Summary: Found $SEARCH_REGION in $total_files files with $total_occurrences total occurrences."

# Provide guidance on how to fix
if [ $total_occurrences -gt 0 ]; then
    echo ""
    echo "Recommended fixes:"
    echo "1. Replace hardcoded region strings with variable references:"
    echo "   - Change: \"$SEARCH_REGION\" → \"\${var.aws_region}\""
    echo "   - Change: \"${SEARCH_REGION}a\" → \"\${var.aws_region}a\""
    echo "   - Change: \"${SEARCH_REGION}b\" → \"\${var.aws_region}b\""
    echo ""
    echo "2. Check for provider blocks with hardcoded regions:"
    echo "   provider \"aws\" {"
    echo "     region = \"$SEARCH_REGION\"  # Change this to var.aws_region"
    echo "   }"
    echo ""
    echo "3. Ensure terraform.tfvars has the correct region:"
    echo "   aws_region = \"us-east-1\""
    echo ""
    echo "4. For automated replacement, you can use:"
    echo "   find \"$SEARCH_DIR\" -type f \\( -name \"*.tf\" -o -name \"*.tfvars\" \\) -exec sed -i 's/$SEARCH_REGION/us-east-1/g' {} \\;"
    echo "   (Use with caution and make backups first!)"
fi