# Priority Pulse API Contracts (v0.1)

## POST /presign
Request:
{ "contentType": "image/png" }

Response:
{
  "ok": true,
  "uploadUrl": "https://...",
  "key": "uploads/YYYY-MM-DD/<uuid>.png",
  "expiresInSec": 300,
  "requiredHeaders": { "Content-Type": "image/png" }
}

## POST /analyze
Header:
x-shared-secret: <SHARED_SECRET>

Request:
{ "key": "uploads/YYYY-MM-DD/<uuid>.png", "textContext": "checkout failing 500" }

Response:
{
  "ok": true,
  "priority": "P0",
  "emotion": { "label": "angry", "score": 0.82, "signal": "frustration" },
  "rationale": "...",
  "nextStep": "...",
  "timingsMs": { "total": 742, "s3Get": 55, "hfCall": 610, "rules": 8 }
}

## (Optional) POST /feedback
Request:
{ "key": "...", "wasCorrect": false, "finalPriority": "P1" }

Response:
{ "ok": true }