"""ใส่ JS/CSS ของหน้าบ้าน (Vite) ลงในหน้า Django

- ตอนพัฒนา (ตั้ง VITE_DEV_SERVER): โหลดจาก Vite dev server ตรง ๆ ได้ hot reload
- ตอนใช้งานจริง: อ่าน frontend/dist/.vite/manifest.json แล้วใส่ไฟล์ที่ build ไว้ (ชื่อไฟล์มี hash อยู่แล้ว)
"""

import json
from functools import cache
from pathlib import Path

from django import template
from django.conf import settings
from django.utils.html import format_html, format_html_join
from django.utils.safestring import SafeString, mark_safe

register = template.Library()


@cache
def _manifest(path: str) -> dict[str, dict[str, object]]:
    return json.loads(Path(path).read_text())


def _url(file: str) -> str:
    # Vite already put a content hash in every file name, so link to it as-is under STATIC_URL
    return f"{settings.STATIC_URL}{file}"


@register.simple_tag
def vite_assets(entry: str = "src/main.tsx") -> SafeString:
    dev = settings.VITE_DEV_SERVER
    if dev:
        # React Fast Refresh needs this preamble when the page is not served by Vite itself
        return format_html(
            '<script type="module">import R from "{0}/@react-refresh";R.injectIntoGlobalHook(window);'
            "window.$RefreshReg$=()=>{{}};window.$RefreshSig$=()=>t=>t;"
            "window.__vite_plugin_react_preamble_installed__=true;</script>"
            '<script type="module" src="{0}/@vite/client"></script>'
            '<script type="module" src="{0}/{1}"></script>',
            dev,
            entry,
        )

    manifest_path = str(settings.VITE_MANIFEST)
    if not Path(manifest_path).exists():
        if settings.DEBUG:
            return mark_safe("<!-- frontend not built: run `npm run build` in frontend/ or set VITE_DEV_SERVER -->")
        raise FileNotFoundError(f"Vite manifest missing: {manifest_path}")
    manifest = _manifest(manifest_path) if not settings.DEBUG else json.loads(Path(manifest_path).read_text())
    chunk = manifest[entry]

    css = [str(f) for f in chunk.get("css", [])]  # type: ignore[union-attr]
    preloads = [str(manifest[i]["file"]) for i in chunk.get("imports", [])]  # type: ignore[union-attr]
    return mark_safe(
        format_html_join("", '<link rel="stylesheet" href="{}">', ((_url(f),) for f in css))
        + format_html_join("", '<link rel="modulepreload" href="{}">', ((_url(f),) for f in preloads))
        + format_html('<script type="module" src="{}"></script>', _url(str(chunk["file"])))
    )
