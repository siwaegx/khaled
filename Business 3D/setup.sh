#!/bin/bash

# ============================================
# CRM Project Setup Script (Linux/Mac)
# ============================================
# This script initializes the CRM project with all dependencies
# Run this before starting the application for the first time

echo ""
echo "============================================"
echo "   CRM Project Setup"
echo "============================================"
echo ""

# Check if Node.js is installed
echo "[1/4] Checking Node.js installation..."
if ! command -v node &> /dev/null; then
    echo "ERROR: Node.js is not installed!"
    echo "Please install Node.js from https://nodejs.org/"
    exit 1
fi
NODE_VERSION=$(node --version)
echo "Found: $NODE_VERSION"
echo ""

# Check if npm is installed
echo "[2/4] Checking npm installation..."
if ! command -v npm &> /dev/null; then
    echo "ERROR: npm is not installed!"
    echo "Please install npm as part of Node.js"
    exit 1
fi
NPM_VERSION=$(npm --version)
echo "Found: npm $NPM_VERSION"
echo ""

# Install project dependencies
echo "[3/4] Installing project dependencies..."
echo "This may take a few minutes..."
echo ""
npm install
if [ $? -ne 0 ]; then
    echo "ERROR: Failed to install dependencies"
    exit 1
fi
echo "Dependencies installed successfully!"
echo ""

# Create environment file if it doesn't exist
echo "[4/4] Configuring environment..."
if [ ! -f .env ]; then
    echo "Creating .env configuration file..."
    cp .env.example .env 2>/dev/null
    if [ -f .env ]; then
        echo ".env file created successfully!"
        echo ""
        echo "You can edit .env to customize:"
        echo "- PORT: Server port (default: 3000)"
        echo "- HOST: Server host (default: 0.0.0.0 for network access)"
        echo "- SMTP_HOST: Email settings (optional)"
    fi
else
    echo ".env file already exists, skipping..."
fi
echo ""

# Make START.bat and setup.sh executable (if on Linux/Mac)
if [ -f "START.bat" ]; then
    chmod +x start.sh 2>/dev/null
fi

# Setup complete
echo "============================================"
echo "   Setup Complete!"
echo "============================================"
echo ""
echo "Next steps:"
echo "1. Edit .env file if needed (optional)"
echo "2. Run: node server.js"
echo "3. Open http://localhost:3000 in your browser"
echo "4. Login with PIN: 1996"
echo ""
echo "For more information, see SETUP.md"
echo ""
