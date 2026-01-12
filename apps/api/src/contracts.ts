/**
 * Single source of truth for API request/response contracts.
 * Both:
 *  - Lambda handlers (apps/api)
 *  - Next.js frontend (apps/web)
 * should import types from here (or copy into a shared package later).
 */

/* =========================
   Shared Types
========================= */

export type Priority = "P0" | "P1" | "P2";

export type ContentType = "image/jpeg" | "image/png";

export type HfEmotionLabel =
    | "angry"
    | "disgust"
    | "fear"
    | "happy"
    | "sad"
    | "surprise"
    | "neutral";

export type EmotionSignal = "frustration" | "neutral" | "positive" | "uncertain";

export type ApiErrorCode =
    | "INVALID_CONTENT_TYPE"
    | "UNAUTHORIZED"
    | "IMAGE_NOT_FOUND"
    | "HF_INFERENCE_FAILED"
    | "PRESIGN_FAILED"
    | "ANALYZE_FAILED"
    | "BAD_REQUEST";

export type ApiErrorResponse = {
    ok: false;
    error: {
        code: ApiErrorCode;
        message: string;
    };
};

/* =========================
   POST /presign
========================= */

export type PresignRequest = {
    contentType: ContentType;
};

export type PresignResponse = {
    ok: true,
    uploadUrl: string,
    key: string,
    expiresInSec: number,

    /**
     * This frontend MUST send these headers when uplaoding to S3.
     * This prevents signature mismatch issues.
     */

    requiredHeaders: {
        "Content-Type": ContentType;
    };
};

/* =========================
   POST /analyze
========================= */

export type AnalyzeRequest = {
    key: string;
    textContext?: string;
};

export type AnalyzeResponse = {
    ok: true;
    priority: Priority;

    emotion: {
        label: HfEmotionLabel;
        score: number; // 0-1
        signal: EmotionSignal; // frustration, neutral, positive, uncertain
    };

    rationale: string;
    nextStep: string;

    timingsMs: {
        total: number;
        s3Get: number;
        hfCall: number;
        rules: number;
    };

    meta?: {
        model: string; // HF model id used
        receivedTextContext: boolean;
    };
};

/* =========================
   (Optional) POST /feedback
========================= */

export type FeedbackRequest = {
    analysisId?: string;
    key: string;
    wasCorrect: boolean;
    finalPriority?: Priority;
};

export type FeedbackResponse = {
    ok: true;
};

/* =========================
   Helpful Union Types
========================= */

export type PresignApiResponse = PresignResponse | ApiErrorResponse;
export type AnalyzeApiResponse = AnalyzeResponse | ApiErrorResponse;
export type FeedbackApiResponse = FeedbackResponse | ApiErrorResponse;



