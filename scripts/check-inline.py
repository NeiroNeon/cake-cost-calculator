from pathlib import Path
import re, subprocess, tempfile
source = Path("app/index.html").read_text(encoding="utf-8")
match = re.search(r'<script type="module">(.*?)</script>', source, re.S)
if not match:
    raise SystemExit("No application module script found")
with tempfile.NamedTemporaryFile("w", suffix=".mjs", encoding="utf-8") as handle:
    handle.write(match.group(1))
    handle.flush()
    subprocess.run(["node", "--check", handle.name], check=True)
print("Application inline module syntax: OK")
