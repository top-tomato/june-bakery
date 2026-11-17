FROM python:3.13-slim

COPY --from=ghcr.io/astral-sh/uv:0.7.3 /uv /usr/local/bin/uv

ENV PYTHONUNBUFFERED=1 \
    UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    PATH="/app/.venv/bin:$PATH"

WORKDIR /app

COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project

COPY . .

# รวมไฟล์ static ตอน build ใช้ key ชั่วคราวเฉพาะขั้นนี้ key จริงมาจาก secret ตอนรัน
RUN DJANGO_DEBUG=0 DJANGO_SECRET_KEY=build-only python manage.py collectstatic --noinput

ENV DJANGO_DEBUG=0 \
    DATA_DIR=/data

EXPOSE 8000
CMD ["./docker-entrypoint.sh"]
