"""Extract the SUDU-Gadgets workbook into a manifest plus raw photo bytes.

Reads the OOXML package directly with the standard library: cell values through
sharedStrings, Weidian links through the sheet's hyperlink relationships, and the
embedded photos through the drawing anchors mapped to their owning row. Standard
library only, no database access, no third-party dependency.
"""

from __future__ import annotations

import json
import posixpath
import re
import sys
import zipfile
from collections import Counter
from pathlib import Path
from xml.etree import ElementTree as ET

SOURCE = Path(r"C:\Users\corra\Desktop\sudu-gadgets 2026-9.xlsx")
OUT_DIR = Path(__file__).resolve().parent / "out"
MEDIA_DIR = OUT_DIR / "media"

MAIN_SHEET = "xl/worksheets/sheet1.xml"
MAIN_DRAWING = "xl/drawings/drawing1.xml"
HOT_SHEET = "xl/worksheets/sheet2.xml"

M = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"
R = "{http://schemas.openxmlformats.org/officeDocument/2006/relationships}"
XDR = "{http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing}"
A = "{http://schemas.openxmlformats.org/drawingml/2006/main}"

# The fixed section vocabulary, already normalised (lowercase, non-alphanumeric
# runs collapsed to one space). Derived by inspection of both header spellings
# the workbook uses; never inferred from "this row has no URL".
SECTIONS = {
    "electronics", "earbuds", "watches", "speakers", "mobile phones", "hair tools",
    "other accsessories", "perfumes", "t shirts", "hoodies sweater jacket", "pants",
    "jersey", "coats", "bags and accessioes", "shoes",
}

ITEM_ID = re.compile(r"itemID=(\d+)")


def section_key(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", " ", text.replace("\u200b", "").lower()).strip()


def col_index(ref: str) -> int | None:
    match = re.match(r"([A-Z]+)", ref or "")
    if not match:
        return None
    n = 0
    for ch in match.group(1):
        n = n * 26 + (ord(ch) - 64)
    return n


def part_rels(zf: zipfile.ZipFile, part: str) -> dict[str, str]:
    directory, base = posixpath.split(part)
    path = f"{directory}/_rels/{base}.rels" if directory else f"_rels/{base}.rels"
    if path not in zf.namelist():
        return {}
    root = ET.fromstring(zf.read(path))
    return {e.get("Id"): e.get("Target") for e in root}


def anchors_by_row(zf: zipfile.ZipFile, drawing_part: str) -> dict[int, list[str]]:
    """Map 1-based sheet row -> media file names anchored to it."""
    if drawing_part not in zf.namelist():
        return {}
    rels = part_rels(zf, drawing_part)
    id_to_media = {k: v.split("/")[-1] for k, v in rels.items() if "media/" in v}
    out: dict[int, list[str]] = {}
    for anchor in ET.fromstring(zf.read(drawing_part)).iter(XDR + "oneCellAnchor"):
        origin = anchor.find(XDR + "from")
        if origin is None:
            continue
        row_el = origin.find(XDR + "row")
        if row_el is None or row_el.text is None:
            continue
        row = int(row_el.text) + 1
        for blip in anchor.iter(A + "blip"):
            media = id_to_media.get(blip.get(R + "embed"))
            if media:
                out.setdefault(row, []).append(media)
    return out


class Sheet:
    """Resolved cell values and hyperlink targets for one worksheet."""

    def __init__(self, zf: zipfile.ZipFile, part: str, shared: list[str]) -> None:
        self.part = part
        self.shared = shared
        self.values: dict[int, dict[int, str]] = {}
        self.links: dict[int, str] = {}
        root = ET.fromstring(zf.read(part))
        rels = part_rels(zf, part)
        for row in root.iter(M + "row"):
            number = int(row.get("r"))
            cells: dict[int, str] = {}
            for cell in row.findall(M + "c"):
                index = col_index(cell.get("r"))
                if index is not None:
                    cells[index] = self._value(cell)
            self.values[number] = cells
        for link in root.iter(M + "hyperlink"):
            target = rels.get(link.get(R + "id"))
            match = re.match(r"([A-Z]+)(\d+)", link.get("ref") or "")
            if target and target.startswith("http") and match:
                self.links[int(match.group(2))] = target

    def _value(self, cell: ET.Element) -> str:
        kind = cell.get("t")
        if kind == "s":
            v = cell.find(M + "v")
            return self.shared[int(v.text)] if v is not None and v.text is not None else ""
        if kind == "inlineStr":
            return "".join(t.text or "" for t in cell.iter(M + "t"))
        v = cell.find(M + "v")
        return v.text if v is not None and v.text is not None else ""

    def text(self, row: int, col: int) -> str:
        return (self.values.get(row, {}).get(col) or "").strip()

    def url(self, row: int) -> str | None:
        cell = self.text(row, 6)
        if cell.startswith("http"):
            return cell
        return self.links.get(row)


def main() -> None:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    if not SOURCE.exists():
        raise SystemExit(f"Workbook not found: {SOURCE}")

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    MEDIA_DIR.mkdir(parents=True, exist_ok=True)

    with zipfile.ZipFile(SOURCE) as zf:
        shared: list[str] = []
        if "xl/sharedStrings.xml" in zf.namelist():
            for si in ET.fromstring(zf.read("xl/sharedStrings.xml")).findall(M + "si"):
                shared.append("".join(t.text or "" for t in si.iter(M + "t")))

        main = Sheet(zf, MAIN_SHEET, shared)
        hot = Sheet(zf, HOT_SHEET, shared)
        anchors = anchors_by_row(zf, MAIN_DRAWING)

        records: list[dict] = []
        skipped: list[dict] = []
        section = ""

        for row in sorted(main.values):
            name = main.text(row, 1)
            url = main.url(row)
            if not name:
                if url:
                    skipped.append({"row": row, "reason": "url but no model name in column A"})
                continue
            if not url:
                # A no-URL row is a section header only when it is in the fixed
                # vocabulary. Rows 1/3/5 (sheet title, "HOT SALE list !!!", the
                # "Modle" column header) are neither: they are expected, and they
                # are reported in `skipped` for the human to confirm.
                if section_key(name) in SECTIONS:
                    section = name
                else:
                    skipped.append({"row": row, "reason": "not a section header and not a product row"})
                continue
            match = ITEM_ID.search(url)
            records.append({
                "row": row,
                "section": section,
                "raw_name": name,
                "weidian_id": match.group(1) if match else None,
                "images": anchors.get(row, []),
            })

        hot_ids: list[str] = []
        for row in sorted(hot.values):
            url = hot.url(row)
            match = ITEM_ID.search(url) if url else None
            if match:
                hot_ids.append(match.group(1))

        needed = {m for media in anchors.values() for m in media}
        for name in sorted(needed):
            (MEDIA_DIR / name).write_bytes(zf.read(f"xl/media/{name}"))

    manifest = {
        "source": SOURCE.name,
        "hot_sale_weidian_ids": sorted(set(hot_ids)),
        "records": records,
        "skipped": skipped,
    }
    (OUT_DIR / "manifest.json").write_text(
        json.dumps(manifest, indent=2, ensure_ascii=False), encoding="utf-8"
    )

    with_image = sum(1 for r in records if r["images"])
    multi = sum(1 for r in records if len(r["images"]) > 1)
    print(f"records            : {len(records)}")
    print(f"  with >=1 image   : {with_image}")
    print(f"  with 2 images    : {multi}")
    print(f"  without image    : {len(records) - with_image}")
    print(f"skipped            : {len(skipped)}")
    print(f"hot sale entries   : {len(set(hot_ids))}")
    print(f"media written      : {len(needed)} -> {MEDIA_DIR}")
    counts = Counter(r["section"] for r in records)
    print(f"product sections   : {len(counts)}")
    for name in sorted(counts):
        print(f"  {counts[name]:>3}  {name}")


if __name__ == "__main__":
    main()
