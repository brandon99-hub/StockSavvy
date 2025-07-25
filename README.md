# 📊 StockSavvy - Advanced Inventory Management System

> **A modern, AI-powered inventory management solution with predictive analytics and real-time insights**

![StockSavvy Banner](./generated-icon.png)

## 🌟 Overview

StockSavvy is a comprehensive full-stack inventory management system designed for modern businesses. It combines traditional inventory management with cutting-edge AI forecasting capabilities, providing businesses with the tools they need to optimize their stock levels, reduce costs, and improve operational efficiency.

## ✨ Key Features

### 🎯 **Smart Dashboard**
- **Real-time Analytics**: Live sales data, inventory levels, and performance metrics
- **Predictive Insights**: AI-powered demand forecasting using Meta's Prophet algorithm
- **Visual Analytics**: Interactive charts and graphs for data visualization
- **Alert System**: Automated low-stock alerts and reorder recommendations

### 📦 **Advanced Inventory Management**
- **Product Management**: Complete CRUD operations with SKU tracking
- **Category Organization**: Hierarchical category management
- **Batch Tracking**: Track product batches with expiration dates
- **Stock Monitoring**: Real-time stock level tracking with automated alerts
- **Supplier Management**: Integrated supplier information and restock rules

### 💰 **Sales & Point-of-Sale**
- **Transaction Processing**: Complete sales transaction management
- **Discount Engine**: Flexible discount and pricing rules
- **Sales Analytics**: Comprehensive sales reporting and insights
- **Performance Tracking**: Track sales performance across different time periods

### 🤖 **AI-Powered Forecasting**
- **Demand Prediction**: Machine learning-based demand forecasting
- **Inventory Optimization**: Intelligent reorder point calculations
- **Trend Analysis**: Seasonal and trend-based inventory planning
- **Risk Assessment**: Identify potential stockouts before they happen

### 👥 **User Management & Security**
- **Role-Based Access**: Granular permission system
- **User Authentication**: Secure login and session management
- **Activity Logging**: Comprehensive audit trail
- **Multi-user Support**: Support for teams with different access levels

## 🏗️ Technology Stack

### **Backend**
- **Framework**: Django 5.2 with Django REST Framework
- **Database**: PostgreSQL with Redis caching
- **AI/ML**: Prophet for time series forecasting
- **Task Queue**: Django-Q for background processing
- **Authentication**: JWT-based authentication
- **Deployment**: Gunicorn + WhiteNoise for production

### **Frontend**
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite for fast development and optimized builds
- **UI Library**: Radix UI components with Tailwind CSS
- **State Management**: TanStack Query for server state
- **Charts**: Chart.js and Recharts for data visualization
- **Routing**: Wouter for lightweight routing

### **DevOps & Deployment**
- **Containerization**: Docker-ready configuration
- **Cloud Deployment**: Render.com deployment configuration
- **Dependency Management**: Poetry for Python, npm for Node.js
- **Version Control**: Git with comprehensive branching strategy

## 🚀 Quick Start

### Prerequisites
- Python 3.11+
- Node.js 18+
- PostgreSQL 12+
- Redis (optional, for caching)

### Backend Setup
```bash
# Install dependencies
poetry install

# Setup database
cd backend
python3 manage.py migrate

# Create superuser
python3 manage.py createsuperuser

# Run development server
python3 manage.py runserver
```

### Frontend Setup
```bash
# Install dependencies
cd frontend
npm install

# Start development server
npm run dev
```

### Quick Start (All-in-One)
```bash
# For Windows users
./start_stocksavvy.bat

# For manual setup
# Terminal 1: Backend
cd backend && python3 manage.py runserver

# Terminal 2: Frontend  
cd frontend && npm run dev
```

**Access the application:**
- Frontend: http://localhost:5173
- Backend API: http://localhost:8000
- Admin Panel: http://localhost:8000/admin

## 📱 Application Screenshots

### Dashboard Overview
The main dashboard provides a comprehensive overview of your inventory status:
- **Key Metrics**: Total products, low stock items, sales figures
- **Sales Charts**: Interactive charts showing sales trends
- **Category Analysis**: Visual breakdown of inventory by category
- **AI Forecasts**: Tomorrow's top 3 forecasted products
- **Activity Feed**: Real-time activity tracking

### Inventory Management
- **Product Catalog**: Complete product management with search and filtering
- **Stock Monitoring**: Real-time stock levels with visual indicators
- **Category Management**: Organize products into hierarchical categories
- **Batch Tracking**: Track product batches with expiration monitoring

### Sales Management
- **Point of Sale**: Intuitive interface for processing sales
- **Transaction History**: Complete sales transaction tracking
- **Analytics**: Sales performance metrics and insights
- **Reporting**: Comprehensive sales reports

### Advanced Analytics
- **Demand Forecasting**: AI-powered predictions for inventory planning
- **Trend Analysis**: Historical data analysis and pattern recognition
- **Performance Metrics**: KPIs and business intelligence dashboards

## 🔧 Configuration

### Environment Variables
```env
# Backend (.env in backend directory)
DEBUG=False
SECRET_KEY=your-secret-key
DATABASE_URL=postgresql://user:password@localhost:5432/stocksavvy
REDIS_URL=redis://localhost:6379/0

# Frontend (.env in frontend directory)  
VITE_API_URL=http://localhost:8000
```

### Database Configuration
The application supports PostgreSQL out of the box. Update your database settings in `backend/backend/settings.py`.

## 📊 API Documentation

### Core Endpoints
- `GET /api/dashboard/stats/` - Dashboard statistics
- `GET /api/products/` - Product listing with pagination
- `POST /api/sales/` - Create new sale
- `GET /api/products/forecasts/` - AI forecasting data
- `GET /api/activities/` - Recent activities

### Authentication
```bash
# Login
POST /api/auth/login/
{
  "username": "your_username",
  "password": "your_password"
}

# Access protected endpoints with JWT token
Authorization: Bearer <token>
```

## 🚀 Deployment

### Render.com (Recommended)
The application includes a `render.yaml` configuration for one-click deployment:

```yaml
services:
  - type: web
    name: stocksavvy
    runtime: python
    buildCommand: |
      poetry install && 
      cd frontend && npm install && npm run build &&
      cd ../backend && python manage.py migrate &&
      python manage.py collectstatic --noinput
    startCommand: gunicorn backend.wsgi:application
```

### Docker Deployment
```bash
# Build and run with Docker Compose
docker-compose up --build
```

## 🧪 Testing

### Backend Tests
```bash
cd backend
python3 manage.py test
```

### Frontend Tests
```bash
cd frontend
npm run test
```

## 🔍 Key Business Benefits

### **Operational Efficiency**
- **Automated Alerts**: Reduce manual monitoring with intelligent notifications
- **Streamlined Workflows**: Intuitive interface reduces training time
- **Real-time Data**: Make informed decisions with up-to-date information

### **Cost Optimization**
- **Reduced Overstock**: AI forecasting prevents excess inventory
- **Minimize Stockouts**: Predictive analytics prevent lost sales
- **Optimized Purchasing**: Data-driven reorder recommendations

### **Business Intelligence**
- **Performance Insights**: Comprehensive analytics and reporting
- **Trend Analysis**: Understand seasonal patterns and market trends
- **Predictive Planning**: Plan inventory needs weeks in advance

### **Scalability**
- **Multi-user Support**: Grows with your team
- **Cloud-Ready**: Easy deployment and scaling
- **API-First**: Integrate with existing business systems

## 🛡️ Security Features

- **JWT Authentication**: Secure token-based authentication
- **Role-Based Access**: Granular permission system
- **Data Validation**: Comprehensive input validation and sanitization
- **Audit Trail**: Complete activity logging and tracking
- **HTTPS Ready**: Production-ready security configurations

## 📈 Performance Optimizations

- **Redis Caching**: Fast data retrieval for frequently accessed data
- **Database Indexing**: Optimized database queries
- **Asset Optimization**: Minimized and compressed frontend assets
- **Lazy Loading**: Efficient component loading in React
- **API Pagination**: Efficient data loading for large datasets

## 🤝 Contributing

We welcome contributions! Please see our contributing guidelines for more information.

### Development Workflow
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 💬 Support

For support, please contact [your.email@example.com] or create an issue in the GitHub repository.

---

**StockSavvy** - *Intelligent Inventory Management for Modern Businesses*

> Built with ❤️ using Django, React, and AI-powered forecasting