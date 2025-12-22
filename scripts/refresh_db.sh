#!/bin/bash

# Navigate to the backend directory
cd "$(dirname "$0")/.."

echo "WARNING: This will DROP the database and re-create it."
read -p "Are you sure? (y/n) " -n 1 -r
echo    # move to a new line
if [[ ! $REPLY =~ ^[Yy]$ ]]
then
    exit 1
fi

# Load environment to ensure we are targeting the right DB
# We assume development environment for this script as it's destructive
export NODE_ENV=development

echo "Dropping database..."
npm run db:drop:dev

echo "Creating database..."
npm run db:create:dev

echo "Running migrations..."
npm run migrate:dev

echo "Seeding database..."
npm run seed:dev:all

echo "Database refresh complete!"
