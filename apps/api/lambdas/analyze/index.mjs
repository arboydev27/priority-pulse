import { S3Client, GetObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";

const s3 = new S3Client({});
const BUCKET = process.env.UPLOAD_BUCKET;
const HF_TOKEN = process.env.HF_TOKEN;
const HF_MODEL = process.env.HF_MODEL;
const HF_BASE_URL = process.env.HF_BASE_URL || "https://router.huggingface.co/hf-inference/models";
const SHARED_SECRET = process.env.SHARED_SECRET;

const HIGH_FRUSTRATION = 0.6;
const FRUSTRATION_LABELS = new Set(["angry", "disgust", "fear"]);

export const handler = async (event) => {
    const t0 = Date.now();

    try {
        const secret = event.headers?.["x-shared-secret"] || event.headers?.["X-Shared-Secret"];
        if (!secret || secret !== SHARED_SECRET) {
            return json(401, { ok: false, error: { code: "UNAUTHORIZED", message: "Missing or invalid secret." } });
        }

        const body = JSON.parse(event.body || "{}");
        const key = body.key;
        const textContext = (body.textContext || "").toString();

        if (!key || typeof key !== "string") {
            return json(400, { ok: false, error: { code: "BAD_REQUEST", message: "Missing key." } });
        }

        const tS3Start = Date.now();
        let imgBuf;
        try {
            const obj = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: key }));
            imgBuf = await streamToBuffer(obj.Body);
        } catch (e) {
            console.error("s3 get error", e);
            return json(404, { ok: false, error: { code: "IMAGE_NOT_FOUND", message: "Image key not found in S3." } });
        }
        const s3Get = Date.now() - tS3Start;

        const tHfStart = Date.now();

        // (optional but recommended) get the correct content-type from S3
        let contentType = "application/octet-stream";
        try {
            const head = await s3.send(new HeadObjectCommand({ Bucket: BUCKET, Key: key }));
            if (head?.ContentType) contentType = head.ContentType;
        } catch (e) {
            console.warn("head object failed; defaulting content-type", e?.name || e);
        }

        const hfUrl = `${HF_BASE_URL}/${(HF_MODEL || "").trim()}`;

        const hfRes = await fetch(hfUrl, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${HF_TOKEN}`,
                "Content-Type": contentType,      // important
                Accept: "application/json"
            },
            body: imgBuf
        });

        if (!hfRes.ok) {
            const txt = await safeText(hfRes);
            console.error("hf failed", hfRes.status, { hfUrl, contentType }, txt.slice(0, 300));
            return json(502, {
                ok: false,
                error: { code: "HF_INFERENCE_FAILED", message: `HF failed: ${hfRes.status}` }
            });
        }

        const preds = await hfRes.json();
        const hfCall = Date.now() - tHfStart;

        const top = pickTop(preds);
        const mapped = toSignal(top.label, top.score);

        const tRulesStart = Date.now();
        const priority = computePriority(textContext, mapped.signal, mapped.confident);
        const rules = Date.now() - tRulesStart;

        const total = Date.now() - t0;

        return json(200, {
            ok: true,
            priority,
            emotion: { label: top.label, score: round3(top.score), signal: mapped.signal },
            rationale: buildRationale(textContext, mapped.signal, mapped.confident),
            nextStep: nextStepFor(priority),
            timingsMs: { total, s3Get, hfCall, rules },
            meta: { model: HF_MODEL, receivedTextContext: textContext.length > 0 }
        });
    } catch (e) {
        console.error("analyze error", e);
        return json(500, { ok: false, error: { code: "ANALYZE_FAILED", message: "Analyze failed." } });
    }
};

function computePriority(text, signal, confident) {
    const t = text.toLowerCase();

    const p0 = ["checkout", "payment failed", "can't login", "cant login", "500", "down", "incident"];
    const p1 = ["bug", "broken", "slow", "error"];
    const p2 = ["how to", "question", "cosmetic"];

    let base = "P2";
    if (p0.some(k => t.includes(k))) base = "P0";
    else if (p1.some(k => t.includes(k))) base = "P1";
    else if (p2.some(k => t.includes(k))) base = "P2";

    const highImpact = ["checkout", "payment", "login", "500", "down"].some(k => t.includes(k));

    if (base === "P1" && confident && signal === "frustration" && highImpact) return "P0";
    if (base === "P2" && confident && signal === "frustration") return "P1";
    return base;
}

function toSignal(label, score) {
    const l = (label || "").toLowerCase();
    if (l === "neutral" && score >= 0.6) return { signal: "neutral", confident: true };
    if (FRUSTRATION_LABELS.has(l) && score >= HIGH_FRUSTRATION) return { signal: "frustration", confident: true };
    if (l === "happy" && score >= 0.6) return { signal: "positive", confident: true };
    return { signal: "uncertain", confident: false };
}

function pickTop(preds) {
    if (!Array.isArray(preds) || preds.length === 0) return { label: "neutral", score: 0 };
    let best = preds[0];
    for (const p of preds) if (p.score > best.score) best = p;
    return { label: (best.label || "").toLowerCase(), score: Number(best.score || 0) };
}

function buildRationale(text, signal, confident) {
    const parts = [];
    if (text && text.trim().length) parts.push("Used text context keywords.");
    if (confident && signal === "frustration") parts.push("Detected high-frustration emotion signal.");
    if (!confident) parts.push("Emotion confidence low; treated as uncertain.");
    return parts.join(" ");
}

function nextStepFor(priority) {
    if (priority === "P0") return "Treat as incident: page on-call, confirm scope, start comms if widespread.";
    if (priority === "P1") return "Create a bug ticket, assign an owner, request repro steps and logs.";
    return "Request clarification or share help article; triage during normal queue.";
}

function json(statusCode, obj) {
    return {
        statusCode,
        headers: {
            "content-type": "application/json",
            "access-control-allow-origin": "*"
        },
        body: JSON.stringify(obj)
    };
}

async function streamToBuffer(stream) {
    const chunks = [];
    for await (const chunk of stream) chunks.push(chunk);
    return Buffer.concat(chunks);
}

async function safeText(res) {
    try { return await res.text(); } catch { return ""; }
}

function round3(n) {
    return Math.round(n * 1000) / 1000;
}