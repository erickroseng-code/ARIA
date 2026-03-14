#!/usr/bin/env python3
"""
MinerU PDF → Markdown converter for Maverick knowledge base.

Usage:
  python scripts/pdf-to-md.py                        # convert all PDFs
  python scripts/pdf-to-md.py --category copywriting # only copywriting PDFs
  python scripts/pdf-to-md.py --force                # re-convert even if .md exists

Output: data/knowledge/copywriting/parsed/<filename>.md
        data/knowledge/books/parsed/<filename>.md
"""

import argparse
import json
import os
import shutil
import sys
from pathlib import Path

# ── Source folders ────────────────────────────────────────────────────────────
SCRIPT_DIR = Path(__file__).parent
DATA_DIR = SCRIPT_DIR.parent / "data" / "knowledge"

SOURCES = [
    {
        "category": "copywriting",
        "input_dir": DATA_DIR / "copywriting" / "frameworks",
        "output_dir": DATA_DIR / "copywriting" / "parsed",
    },
    {
        "category": "analysis",
        "input_dir": DATA_DIR / "books",
        "output_dir": DATA_DIR / "books" / "parsed",
    },
]


def convert_pdf(pdf_path: Path, output_dir: Path, force: bool = False) -> bool:
    """Convert a single PDF to markdown using MinerU pipeline backend (CPU-safe)."""
    output_md = output_dir / (pdf_path.stem + ".md")

    if output_md.exists() and not force:
        print(f"  [SKIP] {pdf_path.name} — already parsed (use --force to reconvert)")
        return False

    print(f"  [CONVERTING] {pdf_path.name}...")

    # Use a temp working dir per file to avoid collision
    tmp_dir = output_dir / "_tmp" / pdf_path.stem
    tmp_dir.mkdir(parents=True, exist_ok=True)

    try:
        from mineru.cli.common import do_parse

        # Read PDF bytes
        pdf_bytes = pdf_path.read_bytes()

        # Pipeline backend = CPU-safe, no GPU required
        # parse_method "auto" lets MinerU decide the best strategy per page
        do_parse(
            output_dir=str(tmp_dir),
            pdf_file_names=[pdf_path.name],
            pdf_bytes_list=[pdf_bytes],
            p_lang_list=["en"],
            backend="pipeline",
            parse_method="auto",
            formula_enable=False,   # disable formula OCR (not needed for business books)
            table_enable=True,
            f_draw_layout_bbox=False,
            f_draw_span_bbox=False,
            f_dump_md=True,
            f_dump_middle_json=False,
            f_dump_model_output=False,
            f_dump_orig_pdf=False,
            f_dump_content_list=False,
        )

        # MinerU outputs to: tmp_dir/<pdf_stem>/auto/<pdf_stem>.md
        candidates = list(tmp_dir.rglob("*.md"))
        if not candidates:
            print(f"  [WARN] No .md output found for {pdf_path.name}")
            return False

        # Pick the largest .md (the main content file)
        best = max(candidates, key=lambda f: f.stat().st_size)
        shutil.copy2(best, output_md)
        print(f"  [OK] {pdf_path.name} → {output_md.name} ({output_md.stat().st_size // 1024} KB)")
        return True

    except Exception as e:
        print(f"  [ERROR] {pdf_path.name}: {e}")
        import traceback
        traceback.print_exc()
        return False
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)


def main():
    parser = argparse.ArgumentParser(description="Convert PDFs to Markdown via MinerU")
    parser.add_argument("--category", help="Filter by category (copywriting, analysis)")
    parser.add_argument("--force", action="store_true", help="Re-convert even if .md exists")
    parser.add_argument("--file", help="Convert a single specific PDF file path")
    args = parser.parse_args()

    if args.file:
        pdf = Path(args.file)
        if not pdf.exists():
            print(f"[ERROR] File not found: {pdf}")
            sys.exit(1)
        # Use same output dir as the source
        out = pdf.parent.parent / "parsed"
        out.mkdir(parents=True, exist_ok=True)
        convert_pdf(pdf, out, args.force)
        return

    sources = SOURCES
    if args.category:
        sources = [s for s in SOURCES if s["category"] == args.category]
        if not sources:
            print(f"[ERROR] Unknown category '{args.category}'. Valid: {[s['category'] for s in SOURCES]}")
            sys.exit(1)

    total_converted = 0
    total_skipped = 0

    for source in sources:
        input_dir = source["input_dir"]
        output_dir = source["output_dir"]

        if not input_dir.exists():
            print(f"\n[SKIP] Folder not found: {input_dir}")
            continue

        pdfs = sorted(input_dir.glob("*.pdf"))
        print(f"\n[{source['category'].upper()}] {len(pdfs)} PDFs found in {input_dir.name}/")
        output_dir.mkdir(parents=True, exist_ok=True)

        for pdf in pdfs:
            # Run each PDF in an isolated subprocess to avoid memory accumulation
            import subprocess
            result = subprocess.run(
                [sys.executable, __file__, "--file", str(pdf)] + (["--force"] if args.force else []),
                capture_output=False,
            )
            if result.returncode == 0:
                output_md = output_dir / (pdf.stem + ".md")
                if output_md.exists():
                    total_converted += 1
                else:
                    total_skipped += 1
            else:
                total_skipped += 1

    print(f"\n✅ Done — {total_converted} converted, {total_skipped} skipped.")
    if total_converted > 0:
        print("Next step: run the Scholar ingestion to re-index the parsed files.")
        print("  npm run ingest --prefix apps/api")


if __name__ == "__main__":
    main()
