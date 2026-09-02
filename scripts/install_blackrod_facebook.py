"""One-time source patcher for the Blackrod Now Facebook publishing feature.

This script is intentionally idempotent. The workflow only runs when this
installer changes, so normal pushes to main do not rewrite application files.
"""
from pathlib import Path

# Installer revision 1: initial production wiring.


def patch_server() -> bool:
    path = Path("backend/server.py")
    text = path.read_text(encoding="utf-8")
    marker = "install_facebook_integration("
    if marker in text:
        print("server.py already contains Facebook integration")
        return False

    anchor = "\napp.include_router(api)\napp.add_middleware(\n"
    if anchor not in text:
        raise SystemExit("Could not find server.py router anchor; refusing to make an unsafe patch")

    block = '''\n# ─────────── Facebook Page event publishing ───────────\n# The token is server-side only. Never expose FACEBOOK_PAGE_ACCESS_TOKEN to the browser.\nfrom facebook_integration import install_facebook_integration\n\ninstall_facebook_integration(\n    app=app,\n    api=api,\n    db=db,\n    public_url=PUBLIC_URL,\n    admin_code=ADMIN_LAUNCH_CODE,\n)\n\napp.include_router(api)\napp.add_middleware(\n'''
    path.write_text(text.replace(anchor, block, 1), encoding="utf-8")
    print("Patched backend/server.py")
    return True


def patch_admin_events() -> bool:
    path = Path("frontend/src/pages/AdminEvents.jsx")
    text = path.read_text(encoding="utf-8")
    changed = False

    import_line = 'import FacebookPublishingPanel from "@/components/admin/FacebookPublishingPanel";\n'
    if import_line not in text:
        anchor = 'import { CalendarDays, ChevronLeft, AlertTriangle, Download, ChevronRight } from "lucide-react";\n'
        if anchor not in text:
            raise SystemExit("Could not find AdminEvents import anchor; refusing to make an unsafe patch")
        text = text.replace(anchor, anchor + import_line, 1)
        changed = True

    render_line = "            <FacebookPublishingPanel />\n\n"
    if render_line not in text:
        anchor = '            <section className="rounded-3xl border border-border bg-surface p-5 mb-6">\n                <h2 className="font-display font-bold text-xl inline-flex items-center gap-2 mb-3">\n                    <AlertTriangle'
        if anchor not in text:
            raise SystemExit("Could not find AdminEvents attention-panel anchor; refusing to make an unsafe patch")
        text = text.replace(anchor, render_line + anchor, 1)
        changed = True

    if changed:
        path.write_text(text, encoding="utf-8")
        print("Patched frontend/src/pages/AdminEvents.jsx")
    else:
        print("AdminEvents.jsx already contains Facebook panel")
    return changed


if __name__ == "__main__":
    server_changed = patch_server()
    frontend_changed = patch_admin_events()
    print(f"Done. server_changed={server_changed} frontend_changed={frontend_changed}")
