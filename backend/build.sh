#!/usr/bin/env bash
# exit on error
set -o errexit

pip install -r requirements.txt

# Create database tables
python -c "from backend import Base, engine; Base.metadata.create_all(bind=engine)"
