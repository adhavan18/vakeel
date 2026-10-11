"""Upload a filing to a deployed Vakeel API and start the analysis.

Usage: python scripts/upload.py <api_url> <pdf> [<pdf> ...]
"""

import json
import pathlib
import sys
import urllib.request


def call(method, url, body=None):
    req = urllib.request.Request(url, method=method, data=json.dumps(body).encode() if body is not None else None,
                                 headers={"content-type": "application/json"})
    with urllib.request.urlopen(req) as res:
        return json.loads(res.read())


api = sys.argv[1].rstrip("/")
for path in map(pathlib.Path, sys.argv[2:]):
    data = path.read_bytes()
    doc = call("POST", f"{api}/documents", {"fileName": path.name, "size": len(data)})
    put = urllib.request.Request(doc["uploadUrl"], method="PUT", data=data, headers={"content-type": "application/pdf"})
    urllib.request.urlopen(put).read()
    print(path.name, "->", call("POST", f"{api}/documents/{doc['docId']}/analyze"))
