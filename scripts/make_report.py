#!/usr/bin/env python3
"""학생맞춤통합지원 실적 보고서 생성 스크립트.

웹앱(app/index.html)의 「데이터·설정 → 내보내기」로 만든 TSV 파일
(학생사례_*.tsv, 지원기록_*.tsv)을 읽어 기간별 실적 통계를 마크다운으로 만듭니다.
엑셀에서 직접 관리하는 TSV라도 열 이름만 같으면 사용할 수 있습니다.

- 표준 라이브러리만 사용 (파이썬 3.8+)
- 보고서에는 학생 이름 등 개인정보가 들어가지 않습니다.

사용 예:
    python3 scripts/make_report.py \
        --students 학생사례_2026-09-02.tsv \
        --logs 지원기록_2026-09-02.tsv \
        --from 2026-03-01 --to 2026-09-02 \
        --school "○○고등학교" -o 실적보고서.md
"""

import argparse
import csv
import datetime
import re
import sys

STUDENT_REQUIRED = ["관리번호", "위기영역", "위기수준", "단계", "등록일"]
LOG_REQUIRED = ["관리번호", "날짜", "유형"]
DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")


def read_tsv(path, required):
    """TSV 파일을 dict 목록으로 읽고 필수 열이 있는지 확인한다."""
    try:
        # utf-8-sig: 웹앱이 엑셀 호환을 위해 붙이는 BOM을 자동 제거
        with open(path, encoding="utf-8-sig", newline="") as f:
            rows = list(csv.DictReader(f, delimiter="\t"))
    except FileNotFoundError:
        sys.exit(f"오류: 파일을 찾을 수 없습니다 — {path}")
    except UnicodeDecodeError:
        sys.exit(f"오류: {path} 는 UTF-8 텍스트가 아닙니다. 웹앱에서 내보낸 TSV를 사용해 주세요.")
    if not rows:
        return []
    missing = [c for c in required if c not in rows[0]]
    if missing:
        sys.exit(f"오류: {path} 에 필수 열이 없습니다: {', '.join(missing)}\n"
                 f"(현재 열: {', '.join(k for k in rows[0].keys() if k)})")
    return rows


def valid_date(s):
    if not DATE_RE.match(s or ""):
        raise argparse.ArgumentTypeError(f"날짜는 YYYY-MM-DD 형식으로 입력하세요: {s!r}")
    return s


def cell(row, key):
    return (row.get(key) or "").strip()


def main():
    ap = argparse.ArgumentParser(description="학생맞춤통합지원 실적 보고서 생성")
    ap.add_argument("--students", required=True, help="학생 사례 TSV 경로")
    ap.add_argument("--logs", help="지원 기록 TSV 경로 (없으면 사례 통계만 집계)")
    ap.add_argument("--from", dest="date_from", type=valid_date, required=True, help="집계 시작일 (YYYY-MM-DD)")
    ap.add_argument("--to", dest="date_to", type=valid_date, required=True, help="집계 종료일 (YYYY-MM-DD)")
    ap.add_argument("--school", default="", help="학교명 (보고서 머리에 표기)")
    ap.add_argument("--writer", default="", help="작성자 (보고서 머리에 표기)")
    ap.add_argument("-o", "--output", help="저장할 파일 경로 (생략 시 화면 출력)")
    args = ap.parse_args()

    if args.date_from > args.date_to:
        sys.exit("오류: 시작일이 종료일보다 늦습니다.")

    students = read_tsv(args.students, STUDENT_REQUIRED)
    logs = read_tsv(args.logs, LOG_REQUIRED) if args.logs else []

    def in_range(d):
        return bool(d) and args.date_from <= d <= args.date_to

    opened = [s for s in students if in_range(cell(s, "등록일"))]
    closed = [s for s in students if in_range(cell(s, "종결일"))]
    active_at_end = [s for s in students
                     if cell(s, "등록일") and cell(s, "등록일") <= args.date_to
                     and (not cell(s, "종결일") or cell(s, "종결일") > args.date_to)]
    managed = [s for s in students
               if cell(s, "등록일") and cell(s, "등록일") <= args.date_to
               and (not cell(s, "종결일") or cell(s, "종결일") >= args.date_from)]

    area_count = {}
    for s in managed:
        for a in cell(s, "위기영역").split(","):
            a = a.strip()
            if a:
                area_count[a] = area_count.get(a, 0) + 1

    level_count = {}
    for s in active_at_end:
        lv = cell(s, "위기수준") or "(미입력)"
        level_count[lv] = level_count.get(lv, 0) + 1

    no_consent = [s for s in active_at_end if cell(s, "동의확보").upper() != "Y"]

    type_count = {}
    served = set()
    log_total = 0
    for l in logs:
        if in_range(cell(l, "날짜")):
            log_total += 1
            served.add(cell(l, "관리번호"))
            t = cell(l, "유형") or "(미입력)"
            type_count[t] = type_count.get(t, 0) + 1

    out = []
    out.append("# 학생맞춤통합지원 운영 실적\n")
    if args.school:
        out.append(f"- 학교: {args.school}")
    out.append(f"- 집계 기간: {args.date_from} ~ {args.date_to}")
    out.append(f"- 작성일: {datetime.date.today().isoformat()}")
    if args.writer:
        out.append(f"- 작성자: {args.writer}")
    out.append("")

    out.append("## 1. 사례 현황\n")
    out.append("| 구분 | 인원 |")
    out.append("|---|---|")
    out.append(f"| 기간 내 신규 발굴·등록 | {len(opened)} |")
    out.append(f"| 기간 내 종결 | {len(closed)} |")
    out.append(f"| 기간 말 기준 진행 중 | {len(active_at_end)} |")
    out.append(f"| 기간 중 관리 사례 | {len(managed)} |")
    out.append("")

    if level_count:
        out.append("### 진행 중 사례의 위기 수준\n")
        out.append("| 수준 | 인원 |")
        out.append("|---|---|")
        for lv in ["관심", "지원필요", "집중지원"]:
            if lv in level_count:
                out.append(f"| {lv} | {level_count.pop(lv)} |")
        for lv, n in sorted(level_count.items()):
            out.append(f"| {lv} | {n} |")
        out.append("")

    if area_count:
        out.append("## 2. 위기 영역별 현황 (관리 사례 기준, 중복 집계)\n")
        out.append("| 영역 | 사례 수 |")
        out.append("|---|---|")
        for a, n in sorted(area_count.items(), key=lambda x: -x[1]):
            out.append(f"| {a} | {n} |")
        out.append("")

    out.append("## 3. 지원 활동 실적\n")
    if logs:
        out.append("| 유형 | 건수 |")
        out.append("|---|---|")
        for t, n in sorted(type_count.items(), key=lambda x: -x[1]):
            out.append(f"| {t} | {n} |")
        out.append(f"| **합계** | **{log_total}** |")
        out.append("")
        out.append(f"- 지원받은 학생 수(실인원): {len(served)}명")
    else:
        out.append("(지원 기록 파일이 지정되지 않아 활동 실적은 집계하지 않았습니다.)")
    out.append("")

    if no_consent:
        out.append(f"> 참고: 진행 중 사례 가운데 개인정보 동의가 확인되지 않은 사례가 {len(no_consent)}건 있습니다. "
                   "동의 확보 후 TSV의 「동의확보」 열을 Y로 갱신해 주세요.")
        out.append("")

    out.append("※ scripts/make_report.py 로 자동 집계한 자료입니다. 공식 보고 전 원자료와 대조해 주세요.")
    report = "\n".join(out) + "\n"

    if args.output:
        with open(args.output, "w", encoding="utf-8") as f:
            f.write(report)
        print(f"보고서를 저장했습니다: {args.output}")
    else:
        print(report)


if __name__ == "__main__":
    main()
