"""ส่งไฟล์ที่อัปโหลดผ่าน admin (รูป, โมเดล 3D, วิดีโอ)

ใช้แทน django.views.static.serve เพราะตัวนั้นไม่รองรับ HTTP Range: Safari บน iPhone (และเบราว์เซอร์ในแอป LINE)
ขอวิดีโอเป็นช่วง ๆ และจะไม่เล่นวิดีโอถ้าเซิร์ฟเวอร์ตอบทั้งไฟล์แทนการตอบ 206
"""

import mimetypes
import re
from collections.abc import Iterator
from pathlib import Path
from typing import BinaryIO

from django.conf import settings
from django.http import FileResponse, Http404, HttpRequest, HttpResponse, StreamingHttpResponse
from django.utils.http import http_date

RANGE = re.compile(r"bytes=(\d*)-(\d*)")
CHUNK = 64 * 1024


def _read(f: BinaryIO, length: int) -> Iterator[bytes]:
    with f:
        while length > 0:
            block = f.read(min(CHUNK, length))
            if not block:
                return
            length -= len(block)
            yield block


def serve_media(request: HttpRequest, path: str) -> HttpResponse | StreamingHttpResponse | FileResponse:
    root = Path(settings.MEDIA_ROOT).resolve()
    full = (root / path).resolve()
    if not full.is_relative_to(root) or not full.is_file():  # no ../ escapes, no directories
        raise Http404
    stat = full.stat()
    size = stat.st_size
    ctype = mimetypes.guess_type(full.name)[0] or "application/octet-stream"

    m = RANGE.fullmatch(request.headers.get("Range", "").strip())
    if m and (m[1] or m[2]):
        if m[1]:
            start, end = int(m[1]), int(m[2]) if m[2] else size - 1
        else:  # "bytes=-500": the last 500 bytes
            start, end = max(0, size - int(m[2])), size - 1
        end = min(end, size - 1)
        if start > end:
            bad = HttpResponse(status=416)
            bad["Content-Range"] = f"bytes */{size}"
            return bad
        f = full.open("rb")
        f.seek(start)
        resp: HttpResponse | StreamingHttpResponse | FileResponse = StreamingHttpResponse(
            _read(f, end - start + 1), status=206, content_type=ctype
        )
        resp["Content-Range"] = f"bytes {start}-{end}/{size}"
        resp["Content-Length"] = str(end - start + 1)
    else:
        resp = FileResponse(full.open("rb"), content_type=ctype)
    resp["Accept-Ranges"] = "bytes"
    resp["Last-Modified"] = http_date(stat.st_mtime)
    return resp
