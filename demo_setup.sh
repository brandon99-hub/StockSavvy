#!/bin/bash

# StockSavvy Demo Setup Script
# This script prepares the application for demonstration

echo "🚀 Setting up StockSavvy for demonstration..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if we're in the right directory
if [ ! -f "pyproject.toml" ]; then
    print_error "Please run this script from the project root directory"
    exit 1
fi

print_status "Checking prerequisites..."

# Check Python
if ! command -v python3 &> /dev/null; then
    print_error "Python 3 is required but not installed"
    exit 1
fi

# Check Node.js
if ! command -v npm &> /dev/null; then
    print_error "Node.js/npm is required but not installed"
    exit 1
fi

# Check Poetry
if ! command -v poetry &> /dev/null; then
    print_warning "Poetry not found. Installing dependencies with pip instead..."
    USE_PIP=true
else
    USE_PIP=false
fi

print_success "Prerequisites check completed"

# Setup backend
print_status "Setting up backend..."
cd backend

if [ "$USE_PIP" = true ]; then
    print_status "Installing Python dependencies with pip..."
    python3 -m pip install -r requirements.txt
else
    print_status "Installing Python dependencies with Poetry..."
    poetry install
fi

# Database setup
print_status "Setting up database..."
if [ "$USE_PIP" = true ]; then
    python3 manage.py migrate
else
    poetry run python manage.py migrate
fi

# Create superuser if it doesn't exist
print_status "Setting up admin user..."
if [ "$USE_PIP" = true ]; then
    echo "from django.contrib.auth import get_user_model; User = get_user_model(); User.objects.filter(username='admin').exists() or User.objects.create_superuser('admin', 'admin@stocksavvy.com', 'admin123')" | python3 manage.py shell
else
    echo "from django.contrib.auth import get_user_model; User = get_user_model(); User.objects.filter(username='admin').exists() or User.objects.create_superuser('admin', 'admin@stocksavvy.com', 'admin123')" | poetry run python manage.py shell
fi

# Load demo data if available
if [ -f "fixtures/demo_data.json" ]; then
    print_status "Loading demo data..."
    if [ "$USE_PIP" = true ]; then
        python3 manage.py loaddata fixtures/demo_data.json
    else
        poetry run python manage.py loaddata fixtures/demo_data.json
    fi
else
    print_warning "Demo data file not found. You may want to create some sample products manually."
fi

cd ..

# Setup frontend
print_status "Setting up frontend..."
cd frontend

print_status "Installing Node.js dependencies..."
npm install

# Build for production (optional)
print_status "Building frontend..."
npm run build

cd ..

print_success "Setup completed successfully!"

echo ""
echo "🎯 Demo Setup Summary:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📱 Application URLs:"
echo "   Frontend:  http://localhost:5173"
echo "   Backend:   http://localhost:8000"
echo "   Admin:     http://localhost:8000/admin"
echo ""
echo "🔑 Demo Credentials:"
echo "   Username:  admin"
echo "   Password:  admin123"
echo ""
echo "🚀 To start the application:"
echo "   Backend:   cd backend && python3 manage.py runserver"
echo "   Frontend:  cd frontend && npm run dev"
echo ""
echo "💡 Pro Tips for Demo:"
echo "   1. Have sample products with different stock levels"
echo "   2. Create some sales transactions for charts"
echo "   3. Test the forecasting feature with historical data"
echo "   4. Prepare different user roles for access control demo"
echo ""
echo "📋 Demo Checklist:"
echo "   □ Both servers running (backend & frontend)"
echo "   □ Sample data loaded"
echo "   □ Admin account working"
echo "   □ All features tested"
echo "   □ Demo script ready"
echo ""
print_success "StockSavvy is ready for demonstration! 🎉"