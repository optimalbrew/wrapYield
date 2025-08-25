FROM python:3.11-slim

# Set working directory
WORKDIR /app

# Install system dependencies including git for pip git+https dependencies and curl for health checks
RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    git \
    curl \
    libffi-dev \
    libssl-dev \
    pkg-config \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first for better caching
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY app/ ./app/

# Note: btc-vaultero will be mounted at runtime or copied separately
# COPY ../btc-vaultero/ ./btc-vaultero/

# Create non-root user for security
RUN useradd --create-home --shell /bin/bash btcyield
RUN chown -R btcyield:btcyield /app
USER btcyield

# Expose port
EXPOSE 8001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8001/health || exit 1

# Run the application
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8001", "--log-level", "info"]
