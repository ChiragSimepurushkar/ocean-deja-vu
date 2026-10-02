FROM python:3.11-slim

WORKDIR /app

# Install basic system requirements
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# We copy the backend requirements.
COPY backend/requirements.txt ./backend/requirements.txt
RUN pip install --no-cache-dir -r backend/requirements.txt

# Copy ONLY the files required for live serving
# This completely ignores notebooks, training scripts, etc.
COPY backend/src/serving/ ./backend/src/serving/
COPY backend/src/models/ ./backend/src/models/
COPY backend/src/data/ ./backend/src/data/

# Copy model checkpoints and data processing caches
COPY backend/checkpoints/ ./backend/checkpoints/
COPY backend/data/ ./backend/data/

# Start server script
COPY backend/start_server.py ./backend/start_server.py

# Expose the API port
EXPOSE 8000

# Set environment variables for production
ENV PYTHONPATH=/app/backend
ENV ODV_LIVE_MODEL=1
# You may need to adjust this depending on how you inject the Dataset volume
ENV ODV_ZARR_STORE=/app/Dataset 

# Start the application
CMD ["python", "backend/start_server.py"]
