#!/usr/bin/env python3
"""Parse a multipart/form-data body using the boundary from a saved header file."""
import email
import pathlib
import re
import sys


def main() -> int:
    if len(sys.argv) != 4:
        print("usage: parse_multipart.py <headers_file> <body_file> <out_dir>", file=sys.stderr)
        return 2
    headers_file, body_file, out_dir = sys.argv[1:4]
    hdr = pathlib.Path(headers_file).read_text(errors="replace")
    m = re.search(r"boundary=([^;\r\n]+)", hdr, re.I)
    if not m:
        print("no boundary found in headers", file=sys.stderr)
        return 1
    boundary = m.group(1).strip().strip('"').encode()
    raw = pathlib.Path(body_file).read_bytes()
    msg = email.message_from_bytes(
        b"Content-Type: multipart/form-data; boundary=" + boundary + b"\r\n\r\n" + raw
    )
    out = pathlib.Path(out_dir)
    out.mkdir(parents=True, exist_ok=True)
    for part in msg.walk():
        if part.get_content_maintype() == "multipart":
            continue
        name = (
            part.get_filename()
            or part.get_param("name", header="content-disposition")
            or "unknown"
        )
        data = part.get_payload(decode=True) or b""
        safe = name.replace("/", "_")
        (out / safe).write_bytes(data)
        print(f"{name} -> {safe} ({len(data)} bytes, {part.get_content_type()})")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
