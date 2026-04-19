FROM python:3.12-slim

WORKDIR /app

# Install deps before copying source so layer is cached
COPY pyproject.toml .
RUN pip install --no-cache-dir -e .

COPY . .

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
