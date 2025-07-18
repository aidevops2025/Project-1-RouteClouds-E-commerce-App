# RouteClouds E-Commerce Application Details

This document provides comprehensive details about the RouteClouds E-Commerce 3-tier application components, including Dockerfile configurations, application architecture, database connections, CI/CD pipeline, and inter-service communication patterns.

## Table of Contents
1. [Application Architecture Overview](#application-architecture-overview)
2. [Frontend Application Details](#frontend-application-details)
3. [Backend Application Details](#backend-application-details)
4. [Database Configuration](#database-configuration)
5. [Docker Configuration](#docker-configuration)
6. [Kubernetes Deployment Configuration](#kubernetes-deployment-configuration)
7. [CI/CD Pipeline Configuration](#cicd-pipeline-configuration)
8. [Application Communication Flow](#application-communication-flow)
9. [Environment Configuration](#environment-configuration)
10. [Development and Testing](#development-and-testing)
11. [Production Deployment](#production-deployment)

## Application Architecture Overview

### 3-Tier E-Commerce Architecture Components

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │    Backend      │    │    Database     │
│ (React + Vite)  │◄──►│(Node.js + TS)   │◄──►│  (PostgreSQL)   │
│   Port: 80      │    │   Port: 8000    │    │   Port: 5432    │
│ Health: /login  │    │Health: /api/hello│    │routeclouds_db   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         ▲                       ▲                       ▲
         │                       │                       │
    Docker Hub              Docker Hub               AWS RDS
  awsfreetier30/          awsfreetier30/         routeclouds_ecommerce_db
routeclouds-frontend    routeclouds-backend
```

### Technology Stack

**Frontend Tier:**
- **Framework**: React.js 18.2.0
- **Styling**: TailwindCSS with modern UI components
- **Build Tool**: Vite (fast build and development)
- **Web Server**: Nginx (Alpine)
- **Container Port**: 80
- **Environment**: VITE_API_URL for API communication

**Backend Tier:**
- **Framework**: Node.js with Express.js
- **Language**: TypeScript for type safety
- **Database Client**: PostgreSQL client with connection pooling
- **Authentication**: JWT-based user authentication
- **Container Port**: 8000
- **API Endpoints**: RESTful API with comprehensive e-commerce features

**Database Tier:**
- **Engine**: PostgreSQL 14.x
- **Instance Type**: AWS RDS db.t3.micro
- **Storage**: 30GB GP3 with auto-scaling
- **Database Name**: routeclouds_ecommerce_db
- **User**: routeclouds_user
- **Port**: 5432

### Application Purpose

The **RouteClouds E-Commerce Platform** is a modern, full-featured e-commerce application designed for cloud infrastructure services:
- **Product Catalog**: Browse cloud infrastructure products and services
- **Category Management**: Organized product categories (Cloud Infrastructure, Networking, Security, DevOps Tools)
- **Shopping Cart**: Real-time cart functionality with product management
- **User Authentication**: Secure user registration and login system
- **Order Management**: Complete order processing and tracking
- **Admin Dashboard**: Product and category management interface
- **Responsive Design**: Optimized for desktop usage

## Frontend Application Details

### React + Vite Application Structure

```
frontend/
├── public/
│   ├── index.html          # Main HTML template
│   ├── favicon.ico         # RouteClouds application icon
│   └── vite.svg           # Vite logo
├── src/
│   ├── components/
│   │   ├── Header.tsx      # Navigation header component
│   │   ├── Footer.tsx      # Footer component
│   │   ├── ProductCard.tsx # Product display component
│   │   ├── CartItem.tsx    # Shopping cart item component
│   │   └── demo/           # API integration demo components
│   ├── pages/
│   │   ├── HomePage.tsx    # Landing page with product showcase
│   │   ├── LoginPage.tsx   # User authentication page
│   │   ├── ProductsPage.tsx # Product catalog page
│   │   ├── CartPage.tsx    # Shopping cart page
│   │   └── CheckoutPage.tsx # Order checkout page
│   ├── services/
│   │   ├── api.ts          # API service layer with TypeScript
│   │   └── auth.ts         # Authentication service
│   ├── styles/
│   │   └── globals.css     # Global TailwindCSS styles
│   ├── types/
│   │   └── index.ts        # TypeScript type definitions
│   ├── App.tsx             # Main application component
│   └── main.tsx            # Application entry point (Vite)
├── package.json            # Dependencies and scripts
├── vite.config.js          # Vite configuration
├── tailwind.config.js      # TailwindCSS configuration
├── tsconfig.json           # TypeScript configuration
├── Dockerfile              # Multi-stage Docker build
└── nginx.conf              # Nginx configuration for production
```

### Frontend Dependencies

```json
{
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-router-dom": "^6.22.0",
    "@types/react": "^18.2.0",
    "@types/react-dom": "^18.2.0",
    "typescript": "^5.0.0"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.0.0",
    "vite": "^4.4.0",
    "tailwindcss": "^3.4.1",
    "autoprefixer": "^10.4.17",
    "postcss": "^8.4.35"
  }
}
```

### Frontend Features

**Core Components:**
- **Home Component**: Landing page with navigation to different sections
- **Quiz Component**: Interactive quiz interface with question navigation
- **Question Manager**: Administrative interface for CRUD operations on questions
- **Navbar**: Responsive navigation with routing

**Styling and UI:**
- **TailwindCSS**: Utility-first CSS framework for responsive design
- **Responsive Design**: Mobile-first approach with breakpoint optimization
- **Component-based Architecture**: Reusable React components

**API Integration:**
- **Service Layer**: Centralized API communication
- **Error Handling**: Comprehensive error handling for API calls
- **State Management**: React hooks for state management

### Frontend Build Process

**Development Mode:**
```bash
npm start                    # Starts development server on port 3000
npm test                     # Runs test suite
npm run build               # Creates production build
```

**Production Build:**
```bash
# Multi-stage Docker build
FROM node:20-alpine as build
WORKDIR /app
COPY package*.json ./
RUN npm install
RUN npm install @tailwindcss/forms
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/build /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

## Backend Application Details

### Flask Application Structure

```
backend/
├── app/
│   ├── __init__.py         # Application factory
│   ├── config.py           # Configuration management
│   ├── models/
│   │   ├── __init__.py     # Database initialization
│   │   └── models.py       # SQLAlchemy models
│   └── routes/
│       ├── __init__.py     # Blueprint registration
│       ├── api_routes.py   # Health and status endpoints
│       ├── quiz_routes.py  # Quiz-related endpoints
│       └── topic_routes.py # Topic management endpoints
├── migrations/             # Database migration files
├── questions-answers/      # CSV files with quiz data
├── requirements.txt        # Python dependencies
├── run.py                  # Application entry point
├── seed_data.py           # Database seeding script
└── migrate.sh             # Database migration script
```

### Backend Dependencies

```python
# Core Framework
Flask==2.2.5                # Web framework
Flask-CORS==4.0.0           # Cross-origin resource sharing
Flask-SQLAlchemy==3.0.2     # ORM integration
Flask-Migrate==4.0.4        # Database migrations

# Database
psycopg2-binary==2.9.5      # PostgreSQL adapter
sqlalchemy==1.4.46          # SQL toolkit and ORM

# Production Server
gunicorn==21.2.0            # WSGI HTTP server

# Utilities
python-dotenv==1.0.0        # Environment variable management
```

### API Endpoints

**Health and Status Endpoints:**
```python
GET /health                 # Application health check
GET /api/status            # Database connectivity status
```

**Topic Management:**
```python
GET /api/topics            # List all topics
POST /api/topics           # Create new topic
GET /api/topics/<id>       # Get specific topic
PUT /api/topics/<id>       # Update topic
DELETE /api/topics/<id>    # Delete topic
```

**Quiz Management:**
```python
GET /api/quiz/<topic>      # Get quiz questions for topic
POST /api/quiz/submit      # Submit quiz answers
GET /api/questions         # List all questions (admin)
POST /api/questions        # Create new question (admin)
PUT /api/questions/<id>    # Update question (admin)
DELETE /api/questions/<id> # Delete question (admin)
```

### Database Models

**Topic Model:**
```python
class Topic(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False, unique=True)
    description = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    questions = db.relationship('Question', backref='topic', lazy=True)
```

**Question Model:**
```python
class Question(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    topic_id = db.Column(db.Integer, db.ForeignKey('topic.id'), nullable=False)
    question_text = db.Column(db.Text, nullable=False)
    option_a = db.Column(db.String(255), nullable=False)
    option_b = db.Column(db.String(255), nullable=False)
    option_c = db.Column(db.String(255), nullable=False)
    option_d = db.Column(db.String(255), nullable=False)
    correct_answer = db.Column(db.String(1), nullable=False)
    explanation = db.Column(db.Text)
    difficulty = db.Column(db.String(20), default='medium')
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
```

### Configuration Management

**Environment-based Configuration:**
```python
class Config:
    SECRET_KEY = os.getenv('SECRET_KEY', 'dev-secret-key')
    SQLALCHEMY_DATABASE_URI = os.getenv('DATABASE_URL', 
        'postgresql://postgres:postgres@db:5432/devops_learning')
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    DEBUG = bool(int(os.getenv('FLASK_DEBUG', '0')))
```

**CORS Configuration:**
```python
# Dynamic CORS configuration
if os.getenv('ALLOWED_ORIGINS'):
    allowed_origins = os.getenv('ALLOWED_ORIGINS').split(',')
    CORS(app, origins=allowed_origins)
else:
    CORS(app)  # Allow all origins in development
```

## Database Configuration

### PostgreSQL Setup

**AWS RDS Configuration:**
```yaml
Engine: PostgreSQL 14.15
Instance Class: db.t3.micro
Allocated Storage: 20 GB (GP2)
Multi-AZ: Disabled (development)
Backup Retention: 7 days
Deletion Protection: Disabled (development)
```

**Database Connection Details:**
```bash
# Production (AWS RDS)
Host: routeclouds-prod-db.c6t4q0g6i4n5.us-east-1.rds.amazonaws.com
Port: 5432
Database: postgres
Username: postgres
Password: [Stored in Kubernetes Secret]

# Local Development
Host: localhost
Port: 5432
Database: devops_learning
Username: postgres
Password: postgres
```

### Database Schema

**Tables Structure:**
```sql
-- Topics table
CREATE TABLE topic (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Questions table
CREATE TABLE question (
    id SERIAL PRIMARY KEY,
    topic_id INTEGER REFERENCES topic(id),
    question_text TEXT NOT NULL,
    option_a VARCHAR(255) NOT NULL,
    option_b VARCHAR(255) NOT NULL,
    option_c VARCHAR(255) NOT NULL,
    option_d VARCHAR(255) NOT NULL,
    correct_answer VARCHAR(1) NOT NULL,
    explanation TEXT,
    difficulty VARCHAR(20) DEFAULT 'medium',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Sample Data Topics:**
- Docker (Container fundamentals, Dockerfile, Docker Compose)
- Kubernetes (Pods, Services, Deployments, ConfigMaps)
- Jenkins (CI/CD pipelines, Jenkinsfile, Plugins)
- AWS (EC2, S3, EKS, RDS, VPC)
- Linux (Commands, File systems, Process management)

### Database Migration Process

**Migration Scripts:**
```bash
# Initialize database
flask db init

# Create migration
flask db migrate -m "Initial migration"

# Apply migration
flask db upgrade

# Seed initial data
python seed_data.py
```

**Kubernetes Migration Job:**
```yaml
apiVersion: batch/v1
kind: Job
metadata:
  name: database-migration
  namespace: routeclouds-ns
spec:
  ttlSecondsAfterFinished: 100
  template:
    spec:
      containers:
      - name: migration
        image: livingdevopswithakhilesh/devopsdozo:backend-latest
        command: ["/bin/bash", "-c"]
        args:
        - |
          export FLASK_APP=run.py
          flask db upgrade
          python seed_data.py
```

## Docker Configuration

### Frontend Dockerfile

**Multi-stage Build Process:**
```dockerfile
# Build stage
FROM node:20-alpine as build
WORKDIR /app

# Copy package files for dependency caching
COPY package*.json ./
RUN npm install
RUN npm install @tailwindcss/forms

# Copy source and build
COPY . .
RUN npm run build

# Production stage
FROM nginx:alpine
COPY --from=build /app/build /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

**Nginx Configuration:**
```nginx
server {
    listen 80;

    # Serve static React app files
    location / {
        root /usr/share/nginx/html;
        index index.html index.htm;
        try_files $uri $uri/ /index.html;
    }

    # Proxy /api requests to backend service
    location /api {
        proxy_pass http://backend.routeclouds-ns.svc.cluster.local:8000/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### Backend Dockerfile

**Python Application Container:**
```dockerfile
FROM python:3.11-slim
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    postgresql-client \
    libpq-dev \
    gcc \
    python3-dev \
    bash \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .
RUN chmod +x migrate.sh

EXPOSE 8000
CMD ["gunicorn", "--bind", "0.0.0.0:8000", "run:app"]
```

### Docker Compose for Local Development

**Complete Development Stack:**
```yaml
version: '3.8'

services:
  db:
    image: postgres:13
    environment:
      POSTGRES_DB: devops_learning
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 10s
      timeout: 5s
      retries: 5

  backend:
    build: ./backend
    volumes:
      - ./backend:/app
    environment:
      - FLASK_APP=run.py
      - FLASK_DEBUG=1
      - DATABASE_URL=postgresql://postgres:postgres@db:5432/devops_learning
      - SECRET_KEY=your-secret-key-here
    ports:
      - "8000:8000"
    depends_on:
      db:
        condition: service_healthy

  frontend:
    build: ./frontend
    volumes:
      - ./frontend:/app
      - /app/node_modules
    ports:
      - "3000:80"
    environment:
      - REACT_APP_API_URL=http://localhost:8000/api
    depends_on:
      - backend

volumes:
  postgres_data:
```

## Kubernetes Deployment Configuration

### Frontend Deployment

**Kubernetes Manifest:**
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: frontend
  namespace: routeclouds-ns
spec:
  replicas: 2
  selector:
    matchLabels:
      app: frontend
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 0
  template:
    metadata:
      labels:
        app: frontend
    spec:
      containers:
      - name: frontend
        image: skymonil/frontend-image:v4
        imagePullPolicy: Always
        ports:
        - containerPort: 80
        env:
        - name: REACT_APP_API_URL
          value: "/api"
        resources:
          requests:
            memory: "128Mi"
            cpu: "100m"
          limits:
            memory: "256Mi"
            cpu: "300m"
        readinessProbe:
          httpGet:
            path: /
            port: 80
          initialDelaySeconds: 10
          periodSeconds: 5
        livenessProbe:
          httpGet:
            path: /
            port: 80
          initialDelaySeconds: 15
          periodSeconds: 20
```

### Backend Deployment

**Kubernetes Manifest:**
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: backend
  namespace: routeclouds-ns
spec:
  replicas: 2
  selector:
    matchLabels:
      app: backend
  template:
    metadata:
      labels:
        app: backend
    spec:
      containers:
      - name: backend
        image: livingdevopswithakhilesh/devopsdozo:backend-latest
        ports:
        - containerPort: 8000
        envFrom:
        - secretRef:
            name: db-secrets
        - configMapRef:
            name: app-config
        resources:
          requests:
            memory: "256Mi"
            cpu: "200m"
          limits:
            memory: "512Mi"
            cpu: "500m"
        readinessProbe:
          httpGet:
            path: /health
            port: 8000
          initialDelaySeconds: 30
          periodSeconds: 10
        livenessProbe:
          httpGet:
            path: /health
            port: 8000
          initialDelaySeconds: 60
          periodSeconds: 30
```

### Service Configuration

**Frontend Service:**
```yaml
apiVersion: v1
kind: Service
metadata:
  name: frontend
  namespace: routeclouds-ns
spec:
  selector:
    app: frontend
  ports:
  - port: 80
    targetPort: 80
  type: ClusterIP
```

**Backend Service:**
```yaml
apiVersion: v1
kind: Service
metadata:
  name: backend
  namespace: routeclouds-ns
spec:
  selector:
    app: backend
  ports:
  - port: 8000
    targetPort: 8000
  type: ClusterIP
```

### Configuration Management

**Secrets (Base64 Encoded):**
```yaml
apiVersion: v1
kind: Secret
metadata:
  name: db-secrets
  namespace: routeclouds-ns
type: Opaque
data:
  DB_HOST: Ym9vdGNhbXAtZGV2LWRiLmM2dDRxMGc2aTRuNS51cy1lYXN0LTEucmRzLmFtYXpvbmF3cy5jb20=
  DB_NAME: cG9zdGdyZXM=
  DB_USER: cG9zdGdyZXM=
  DB_PASSWORD: ZEpRWlpyeUxMaQ==
  DATABASE_URL: cG9zdGdyZXNxbDovL3Bvc3RncmVzOmRKUVpacnlMTGlAYm9vdGNhbXAtZGV2LWRiLmM2dDRxMGc2aTRuNS51cy1lYXN0LTEucmRzLmFtYXpvbmF3cy5jb206NTQzMi9wb3N0Z3Jlcw==
  SECRET_KEY: c29tZS1yYW5kb20tc2VjcmV0LWtleQ==
```

**ConfigMap:**
```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: app-config
  namespace: routeclouds-ns
data:
  DB_PORT: "5432"
  FLASK_DEBUG: "0"
```

## Application Communication Flow

### Request Flow Architecture

```
Internet → ALB → Ingress → Frontend Service → Frontend Pod
                     ↓
                 Backend Service → Backend Pod → RDS PostgreSQL
```

### Detailed Communication Patterns

**1. Frontend to Backend Communication:**
```javascript
// Frontend API calls
const API_BASE_URL = process.env.REACT_APP_API_URL || '/api';

// Health check
fetch(`${API_BASE_URL}/health`)
  .then(response => response.json())
  .then(data => console.log(data));

// Get topics
fetch(`${API_BASE_URL}/topics`)
  .then(response => response.json())
  .then(topics => setTopics(topics));

// Submit quiz
fetch(`${API_BASE_URL}/quiz/submit`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify(answers)
});
```

**2. Backend to Database Communication:**
```python
# SQLAlchemy ORM queries
from app.models.models import Topic, Question

# Get all topics
topics = Topic.query.all()

# Get questions by topic
questions = Question.query.filter_by(topic_id=topic_id).all()

# Create new question
question = Question(
    topic_id=topic_id,
    question_text=data['question_text'],
    option_a=data['option_a'],
    option_b=data['option_b'],
    option_c=data['option_c'],
    option_d=data['option_d'],
    correct_answer=data['correct_answer']
)
db.session.add(question)
db.session.commit()
```

**3. Nginx Proxy Configuration:**
```nginx
# Frontend serves static files
location / {
    try_files $uri $uri/ /index.html;
}

# API requests proxied to backend
location /api {
    proxy_pass http://backend.routeclouds-ns.svc.cluster.local:8000/;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
}
```

### Load Balancing and High Availability

**Application Load Balancer (ALB):**
- **Target Groups**: Frontend and Backend services
- **Health Checks**: HTTP health check endpoints
- **Sticky Sessions**: Disabled (stateless application)
- **SSL Termination**: Optional with ACM certificates

**Kubernetes Services:**
- **Frontend Service**: ClusterIP with 2 replicas
- **Backend Service**: ClusterIP with 2 replicas
- **Load Distribution**: Round-robin by default

## Environment Configuration

### Development Environment

**Local Development Setup:**
```bash
# Backend setup
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Database setup
docker run --name flask_postgres \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=password \
  -e POSTGRES_DB=devops_learning \
  -p 5432:5432 -d postgres

# Initialize database
export FLASK_APP=run.py
flask db init
flask db migrate -m "Initial migration"
flask db upgrade
python seed_data.py

# Start backend
python run.py
```

```bash
# Frontend setup
cd frontend
npm install
npm install @tailwindcss/forms

# Start development server
npm start
```

### Production Environment Variables

**Backend Environment Variables:**
```bash
# Database Configuration
DATABASE_URL=postgresql://postgres:password@rds-endpoint:5432/postgres
DB_HOST=routeclouds-prod-db.c6t4q0g6i4n5.us-east-1.rds.amazonaws.com
DB_NAME=postgres
DB_USER=postgres
DB_PASSWORD=dJQZZryLLi
DB_PORT=5432

# Application Configuration
SECRET_KEY=some-random-secret-key
FLASK_DEBUG=0
FLASK_APP=run.py

# CORS Configuration
ALLOWED_ORIGINS=https://your-domain.com,https://www.your-domain.com
```

**Frontend Environment Variables:**
```bash
# API Configuration
REACT_APP_API_URL=/api

# Build Configuration
NODE_ENV=production
PUBLIC_URL=/
```

## Development and Testing

### Local Development Workflow

**1. Database Setup:**
```bash
# Start PostgreSQL container
docker run --name dev_postgres \
  -e POSTGRES_DB=devops_learning \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -p 5432:5432 -d postgres:13
```

**2. Backend Development:**
```bash
# Install dependencies
pip install -r requirements.txt

# Run database migrations
flask db upgrade

# Seed test data
python seed_data.py

# Start development server
python run.py
```

**3. Frontend Development:**
```bash
# Install dependencies
npm install

# Start development server
npm start

# Run tests
npm test

# Build for production
npm run build
```

### Testing Endpoints

**Health Check Endpoints:**
```bash
# Backend health
curl http://localhost:8000/health
# Expected: {"status": "healthy"}

# Database status
curl http://localhost:8000/api/status
# Expected: {"database": "connected", "status": "ok"}
```

**API Testing:**
```bash
# Get all topics
curl http://localhost:8000/api/topics

# Get quiz questions
curl http://localhost:8000/api/quiz/docker

# Submit quiz answers
curl -X POST http://localhost:8000/api/quiz/submit \
  -H "Content-Type: application/json" \
  -d '{"answers": {"1": "a", "2": "b"}}'
```

### Data Management

**Bulk Data Upload:**
```bash
# Upload questions from CSV files
python bulk_upload_questions.py questions-answers/docker_questions.csv
python bulk_upload_questions.py questions-answers/kubernetes_questions.csv
python bulk_upload_questions.py questions-answers/jenkins_questions.csv
python bulk_upload_questions.py questions-answers/aws.csv
python bulk_upload_questions.py questions-answers/linux.csv
```

**CSV Format Example:**
```csv
topic,question,option_a,option_b,option_c,option_d,correct_answer,explanation,difficulty
Docker,What is Docker?,Container platform,VM platform,OS platform,Cloud platform,a,Docker is a containerization platform,easy
```

## Production Deployment

### Container Images

**Frontend Image:**
- **Registry**: Docker Hub
- **Image**: `skymonil/frontend-image:v4`
- **Size**: ~50MB (Alpine-based)
- **Build**: Multi-stage with Node.js and Nginx

**Backend Image:**
- **Registry**: Docker Hub
- **Image**: `livingdevopswithakhilesh/devopsdozo:backend-latest`
- **Size**: ~200MB (Python slim-based)
- **Build**: Single-stage with Python 3.11

### Deployment Strategy

**Rolling Update Configuration:**
```yaml
strategy:
  type: RollingUpdate
  rollingUpdate:
    maxSurge: 1
    maxUnavailable: 0
```

**Resource Management:**
```yaml
resources:
  requests:
    memory: "128Mi"    # Frontend
    cpu: "100m"
  limits:
    memory: "256Mi"    # Frontend
    cpu: "300m"
```

### Monitoring and Health Checks

**Readiness Probes:**
```yaml
readinessProbe:
  httpGet:
    path: /health
    port: 8000
  initialDelaySeconds: 30
  periodSeconds: 10
```

**Liveness Probes:**
```yaml
livenessProbe:
  httpGet:
    path: /health
    port: 8000
  initialDelaySeconds: 60
  periodSeconds: 30
```

### Security Considerations

**Container Security:**
- Non-root user execution
- Minimal base images (Alpine/Slim)
- Regular security updates
- Vulnerability scanning

**Network Security:**
- Private subnets for database
- Security groups with minimal access
- TLS encryption for external traffic
- Internal service mesh communication

**Data Security:**
- Kubernetes secrets for sensitive data
- AWS Secrets Manager integration (optional)
- Database encryption at rest
- Regular backup procedures

---

## Summary

This 3-tier application demonstrates modern cloud-native development practices with:

- **Containerized Architecture**: Docker containers for consistent deployment
- **Microservices Design**: Separate frontend, backend, and database tiers
- **Cloud-Native Deployment**: Kubernetes orchestration on AWS EKS
- **Infrastructure as Code**: Terraform for reproducible infrastructure
- **CI/CD Integration**: GitHub Actions for automated deployment
- **Production-Ready Features**: Health checks, monitoring, scaling, and security

The application serves as an excellent example of DevOps best practices, combining development efficiency with production reliability and scalability.
