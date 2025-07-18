#!/bin/bash

# Add Helm repos
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm repo add grafana https://grafana.github.io/helm-charts
helm repo update

# Create monitoring namespace
kubectl create namespace monitoring

# Install Prometheus
helm install prometheus prometheus-community/prometheus \
  --namespace monitoring \
  --set alertmanager.persistentVolume.storageClass="gp2" \
  --set server.persistentVolume.storageClass="gp2"

# Install Grafana
helm install grafana grafana/grafana \
  --namespace monitoring \
  --set persistence.storageClassName="gp2" \
  --set persistence.enabled=true \
  --set adminPassword='EKS!sAw3s0m3' \
  --values - <<EOF
datasources:
  datasources.yaml:
    apiVersion: 1
    datasources:
    - name: Prometheus
      type: prometheus
      url: http://prometheus-server.monitoring.svc.cluster.local
      access: proxy
      isDefault: true
EOF

# Get Grafana admin password
echo "Grafana admin password: EKS!sAw3s0m3"

# Make the script executable
chmod +x setup-monitoring.sh

echo "Monitoring setup complete. Access Grafana by port-forwarding:"
echo "kubectl port-forward svc/grafana 3000:80 -n monitoring"
echo "Then visit: http://localhost:3000 (admin / EKS!sAw3s0m3)"
