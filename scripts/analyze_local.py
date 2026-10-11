"""Run the Vakeel pipeline locally against a PDF, without any deployed infra.

Usage: python scripts/analyze_local.py sample_data/filing_01.pdf [--only 1,3] [--out out/analysis.json]
"""

import argparse
import json
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent.parent / "backend"))

from vakeel import pdf, pipeline, verify  # noqa: E402


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("pdf")
    parser.add_argument("--only", default="")
    parser.add_argument("--out", default="out/analysis.json")
    parser.add_argument("--force", action="store_true")
    args = parser.parse_args()

    pages = pdf.extract_pages(pathlib.Path(args.pdf).read_bytes())
    segments = pdf.segment_projects(pages)
    only = {int(x) for x in args.only.split(",") if x}
    index = verify.SourceIndex(pages)

    out_path = pathlib.Path(args.out)
    results = json.loads(out_path.read_text(encoding="utf-8")) if out_path.exists() else {}
    for seg in segments:
        if only and seg["index"] not in only:
            continue
        if str(seg["index"]) in results and not args.force:
            print(f"project {seg['index']}: cached, skipping")
            continue
        print(f"project {seg['index']}: {len(seg['text']):,} chars from page {seg['startPage']}", flush=True)
        project = pipeline.analyze_segment(seg, index, log=lambda m: print("  " + m, flush=True))
        results[str(seg["index"])] = project
        tokens = sum(u["inputTokens"] for u in project["usage"]), sum(u["outputTokens"] for u in project["usage"])
        print(f"  headline: {project['headline']}\n  tokens in/out {tokens[0]}/{tokens[1]}", flush=True)
        out_path.parent.mkdir(parents=True, exist_ok=True)
        out_path.write_text(json.dumps(results, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"wrote {out_path}")


if __name__ == "__main__":
    main()
