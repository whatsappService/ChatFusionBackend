#!/bin/bash

# Navigate to the backend directory
cd "$(dirname "$0")/.."

echo "Stopping backend containers..."
npm run docker:down

echo "Rebuilding and starting backend containers..."
# Using --build to ensure image is updated
docker-compose -f docker-compose.yml -f docker-compose.override.yml up -d --build backend

echo "Waiting for backend to be ready..."
sleep 5

echo "Showing logs..."
npm run docker:logs
