FROM python:3.12-slim

WORKDIR /app

# Railway builds from the repo root, so paths are relative to there.
# Install deps first so this layer is cached on code-only changes.
COPY apps/rules/pyproject.toml .
RUN pip install --no-cache-dir -e .

COPY apps/rules/ .

CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}"]
