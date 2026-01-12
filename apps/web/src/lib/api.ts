export type PresignResponse = {
    ok: boolean;
    uploadUrl: string;
    key: string;
    expiresInSec: number;
    requiredHeaders?: Record<string, string>;
};

export type AnalyzeResponse = {
    ok: boolean;
    priority: "P0" | "P1" | "P2";
    emotion: { label: string; score: number; signal: string };
    rationale: string;
    nextStep: string;
    timingsMs: { total: number; s3Get: number; hfCall: number; rules: number };
    meta?: { model: string; receivedTextContext: boolean };
};

const API_BASE = process.env.NEXT_PUBLIC_API_BASE!;
const SHARED_SECRET = process.env.NEXT_PUBLIC_SHARED_SECRET!;

export async function presign(contentType: string): Promise<PresignResponse> {
    const res = await fetch(`${API_BASE}/presign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contentType }),
    });
    if (!res.ok) throw new Error(`presign failed: ${res.status}`);
    return res.json();
}

export async function uploadToS3(uploadUrl: string, file: File, requiredHeaders?: Record<string, string>) {
    const headers: Record<string, string> = {
        "Content-Type": file.type || "application/octet-stream",
        ...(requiredHeaders || {}),
    };

    const res = await fetch(uploadUrl, {
        method: "PUT",
        headers,
        body: file,
    });

    if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new Error(`upload failed: ${res.status} ${txt.slice(0, 200)}`);
    }
}

export async function analyze(key: string, textContext?: string): Promise<AnalyzeResponse> {
    const res = await fetch(`${API_BASE}/analyze`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "x-shared-secret": SHARED_SECRET,
        },
        body: JSON.stringify({ key, textContext }),
    });

    if (!res.ok) throw new Error(`analyze failed: ${res.status}`);
    return res.json();
}