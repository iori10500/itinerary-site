#!/usr/bin/env python3
"""Read the emailed Salsify XLSX export without modifying the workbook."""

from __future__ import annotations

import hashlib
import json
import re
import sys
import zipfile
from collections import Counter
from datetime import date
from pathlib import Path
from urllib.parse import parse_qs, urlparse
from xml.etree import ElementTree as ET


ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "data" / "sources" / "explora"
DEFAULT_XLSX = DATA_DIR / "raw" / "salsify" / "products.xlsx"
OFFICIAL_PATH = DATA_DIR / "catalog.json"
PUBLIC_INDEX_PATH = DATA_DIR / "salsify-catalog.json"
OUTPUT_PATH = DATA_DIR / "salsify-export-diff.json"
MAIN_NS = "http://schemas.openxmlformats.org/spreadsheetml/2006/main"


def column_index(reference: str) -> int:
    letters = re.match(r"[A-Z]+", reference).group(0)
    value = 0
    for char in letters:
        value = value * 26 + ord(char) - 64
    return value - 1


def cell_value(cell: ET.Element) -> str:
    inline = cell.find(f"{{{MAIN_NS}}}is")
    if inline is not None:
        return "".join(node.text or "" for node in inline.iter(f"{{{MAIN_NS}}}t"))
    value = cell.find(f"{{{MAIN_NS}}}v")
    return value.text if value is not None and value.text is not None else ""


def read_first_sheet(path: Path) -> tuple[str, str, list[dict[str, str]]]:
    with zipfile.ZipFile(path) as archive:
        workbook = ET.fromstring(archive.read("xl/workbook.xml"))
        sheet = workbook.find(f"{{{MAIN_NS}}}sheets/{{{MAIN_NS}}}sheet")
        sheet_name = sheet.attrib["name"]
        worksheet = ET.fromstring(archive.read("xl/worksheets/sheet1.xml"))
        dimension = worksheet.find(f"{{{MAIN_NS}}}dimension").attrib["ref"]
        xml_rows = worksheet.find(f"{{{MAIN_NS}}}sheetData")

        decoded_rows: list[list[str]] = []
        for xml_row in xml_rows:
            values: dict[int, str] = {}
            for cell in xml_row:
                values[column_index(cell.attrib["r"])] = cell_value(cell)
            width = max(values, default=-1) + 1
            decoded_rows.append([values.get(index, "") for index in range(width)])

    headers = decoded_rows[0]
    records = []
    for values in decoded_rows[1:]:
        padded = values + [""] * (len(headers) - len(values))
        records.append(dict(zip(headers, padded)))
    return sheet_name, dimension, records


def normalize_text(value: object) -> str:
    return re.sub(r"\s+", " ", str(value or "")).strip()


def field_mismatch(official: object, exported: object) -> bool:
    return normalize_text(official) != normalize_text(exported)


def numeric_mismatch(official: object, exported: object) -> bool:
    try:
        return float(official) != float(exported)
    except (TypeError, ValueError):
        return field_mismatch(official, exported)


def main() -> None:
    xlsx_path = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else DEFAULT_XLSX
    sheet_name, dimension, rows = read_first_sheet(xlsx_path)
    official = json.loads(OFFICIAL_PATH.read_text())
    public_index = json.loads(PUBLIC_INDEX_PATH.read_text())

    headers = list(rows[0]) if rows else []
    ids = [row.get("Product ID", "").strip() for row in rows]
    id_counts = Counter(ids)
    export_by_id = {row["Product ID"].strip(): row for row in rows if row.get("Product ID", "").strip()}
    official_by_id = {row["id"]: row for row in official["departures"]}
    voyage_by_id = {row["id"]: row for row in official["voyages"]}
    public_ids = {row["id"] for row in public_index["products"]}

    export_ids = set(export_by_id)
    journey_id_pattern = re.compile(r"^E[A-Z]\d{8}[A-Z0-9]+$")
    export_journey_ids = {product_id for product_id in export_ids if journey_id_pattern.match(product_id)}
    export_reference_ids = export_ids - export_journey_ids
    official_ids = set(official_by_id)
    common_ids = sorted(export_journey_ids & official_ids)
    export_only_journeys = sorted(export_journey_ids - official_ids)
    official_only = sorted(official_ids - export_journey_ids)

    comparisons = {
        "title_en": [],
        "duration_n": [],
        "embarkation_date": [],
        "disembarkation_date": [],
        "url_product_id": [],
        "url_journey_slug": [],
        "url_region": [],
    }
    for product_id in common_ids:
        exported = export_by_id[product_id]
        departure = official_by_id[product_id]
        exported_url = exported.get("URL_en", "")
        parsed_url = urlparse(exported_url)
        query_id = parse_qs(parsed_url.query).get("id-journey", [""])[0]
        path_parts = parsed_url.path.strip("/").split("/")
        exported_region = path_parts[-3].upper() if len(path_parts) >= 3 else ""
        exported_slug = path_parts[-1] if path_parts else ""
        exported_voyage_id = f"explora:{exported_slug}"
        expected_voyage_ids = departure.get("voyage_ids", [departure["voyage_id"]])
        matched_voyage_id = (
            exported_voyage_id if exported_voyage_id in expected_voyage_ids
            else departure["voyage_id"]
        )
        matched_voyage = voyage_by_id[matched_voyage_id]

        checks = {
            "title_en": (matched_voyage["title"], exported.get("Product Title_en", "")),
            "duration_n": (departure["nights"], exported.get("Duration (n)_en", "")),
            "embarkation_date": (departure["embarkation_date"], exported.get("Embarkation Date_en", "")),
            "disembarkation_date": (departure["disembarkation_date"], exported.get("Disembarkation Date_en", "")),
            "url_product_id": (product_id, query_id),
            "url_journey_slug": ([item.removeprefix("explora:") for item in expected_voyage_ids], exported_slug),
            "url_region": (departure["region_codes"][0], exported_region),
        }
        for field, (official_value, export_value) in checks.items():
            if field == "duration_n":
                mismatch = numeric_mismatch(official_value, export_value)
            elif field == "url_journey_slug":
                mismatch = export_value not in official_value
            else:
                mismatch = field_mismatch(official_value, export_value)
            if mismatch:
                comparisons[field].append({
                    "id": product_id,
                    "official": official_value,
                    "salsify_export": export_value,
                })

    locale_fields = [
        "Product Title", "Product Images", "Digital Assets - Map",
        "Digital Assets - Map - PDF", "URL", "Technical Status", "Parent",
        "Duration (n)", "Disembarkation Date", "Embarkation Date",
        "Disembarkation Port", "Embarkation Port", "Description",
    ]
    journey_rows = [export_by_id[product_id] for product_id in sorted(export_journey_ids)]
    locale_completeness = {}
    for base in locale_fields:
        locale_completeness[base] = {
            locale: sum(bool(row.get(f"{base}_{locale}", "").strip()) for row in journey_rows)
            for locale in ("en", "de", "es", "fr", "it")
        }

    technical_status_gaps = {
        locale: sorted(
            row["Product ID"] for row in journey_rows
            if not row.get(f"Technical Status_{locale}", "").strip()
        )
        for locale in ("en", "de", "es", "fr", "it")
    }

    official_only_details = []
    for product_id in official_only:
        departure = official_by_id[product_id]
        official_only_details.append({
            "id": product_id,
            "vessel_id": departure["vessel_id"],
            "embarkation_date": departure["embarkation_date"],
            "disembarkation_date": departure["disembarkation_date"],
            "embarkation_port": departure["embarkation_port"],
            "disembarkation_port": departure["disembarkation_port"],
            "nights": departure["nights"],
            "source_url": departure["source_url"],
        })

    digest = hashlib.sha256(xlsx_path.read_bytes()).hexdigest()
    result = {
        "schema_version": 1,
        "generated_at": date.today().isoformat(),
        "source": {
            "type": "emailed_salsify_xlsx_export",
            "path": str(xlsx_path.relative_to(ROOT)),
            "sha256": digest,
            "sheet": sheet_name,
            "range": dimension,
        },
        "stats": {
            "export_rows": len(rows),
            "export_columns": len(headers),
            "unique_product_ids": len(export_ids),
            "duplicate_product_ids": sorted(product_id for product_id, count in id_counts.items() if product_id and count > 1),
            "export_journey_products": len(export_journey_ids),
            "export_reference_products": len(export_reference_ids),
            "public_index_products": len(public_ids),
            "official_departures": len(official_ids),
            "export_and_official_common": len(common_ids),
            "export_only_journeys": len(export_only_journeys),
            "official_only": len(official_only),
            "public_index_missing_from_export": len(public_ids - export_journey_ids),
            "export_journeys_not_in_public_index": len(export_journey_ids - public_ids),
        },
        "official_only": official_only,
        "official_only_details": official_only_details,
        "export_only_journeys": export_only_journeys,
        "reference_product_sample": sorted(export_reference_ids)[:20],
        "public_index_missing_from_export": sorted(public_ids - export_journey_ids),
        "field_comparison": {
            field: {"mismatch_count": len(items), "mismatches": items}
            for field, items in comparisons.items()
        },
        "locale_completeness": locale_completeness,
        "technical_status_gaps": technical_status_gaps,
    }
    OUTPUT_PATH.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n")
    print(json.dumps({
        "output": str(OUTPUT_PATH.relative_to(ROOT)),
        **result["stats"],
        "field_mismatch_counts": {
            field: value["mismatch_count"] for field, value in result["field_comparison"].items()
        },
    }, ensure_ascii=False))


if __name__ == "__main__":
    main()
