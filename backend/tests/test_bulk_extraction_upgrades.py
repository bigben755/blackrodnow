"""Tests for bulk-import extraction upgrades: OCR spacing, PPTX, legacy-format guidance."""
import sys
import zipfile
from io import BytesIO
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import server  # noqa: E402


def test_normalize_ocr_line_restores_word_spacing():
    assert server._normalize_ocr_line("Saturday12September2026") == "Saturday 12 September 2026"
    assert server._normalize_ocr_line("BlackrodVillageGreen") == "Blackrod Village Green"


def test_normalize_ocr_line_protects_postcodes_and_times():
    assert server._normalize_ocr_line("BL6 5PF") == "BL6 5PF"
    assert server._normalize_ocr_line("11am-4pm") == "11am-4pm"
    assert server._normalize_ocr_line("7:30pm") == "7:30pm"


def _make_pptx(*slide_texts):
    slide_tmpl = (
        '<?xml version="1.0"?>'
        '<p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" '
        'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">'
        "<p:cSld><p:spTree><p:sp><p:txBody>{body}</p:txBody></p:sp></p:spTree></p:cSld></p:sld>"
    )
    buf = BytesIO()
    with zipfile.ZipFile(buf, "w") as z:
        for i, lines in enumerate(slide_texts, start=1):
            body = "".join(f"<a:p><a:r><a:t>{line}</a:t></a:r></a:p>" for line in lines)
            z.writestr(f"ppt/slides/slide{i}.xml", slide_tmpl.format(body=body))
    return buf.getvalue()


def test_extract_pptx_text_reads_slides_in_order():
    data = _make_pptx(["History Talk", "14 October 2026"], ["Blackrod Library"])
    text, warnings = server._extract_pptx_text(data)
    assert warnings == []
    assert text.index("History Talk") < text.index("Blackrod Library")
    assert "14 October 2026" in text


def test_extract_document_text_routes_pptx():
    data = _make_pptx(["Quiz Night"])
    text, source_type, warnings = server._extract_document_text("deck.pptx", "application/octet-stream", data)
    assert source_type == "pptx"
    assert "Quiz Night" in text


def test_legacy_doc_gets_actionable_warning():
    text, source_type, warnings = server._extract_document_text("old.doc", "application/msword", b"\xd0\xcf\x11\xe0")
    assert text == ""
    assert any("re-save the file as DOCX" in w for w in warnings)
