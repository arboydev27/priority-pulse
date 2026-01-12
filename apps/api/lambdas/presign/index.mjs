import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import crypto from "crypto";

const s3 = new S3Client({});
const BUCKET = process.env.UPLOAD_BUCKET;

const ALLOWED = new Set(["image/png", "image/jpeg"]);

export const handler = async (event) => {
    try {
        const body = JSON.parse(event.body || "{}");
        const contentType = body.contentType;

        if (!ALLOWED.has(contentType)) {
            return json(400, {
                ok: false,
                error: { code: "INVALID_CONTENT_TYPE", message: "Only image/png or image/jpeg allowed." }
            });
        }

        const ext = contentType === "image/png" ? "png" : "jpg";
        const day = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
        const key = `uploads/${day}/${crypto.randomUUID()}.${ext}`;

        // IMPORTANT: include ContentType in the signed command so uploads must match it
        const cmd = new PutObjectCommand({
            Bucket: BUCKET,
            Key: key,
            ContentType: contentType
        });

        const expiresInSec = 300; // 5 minutes
        const uploadUrl = await getSignedUrl(s3, cmd, { expiresIn: expiresInSec });

        return json(200, {
            ok: true,
            uploadUrl,
            key,
            expiresInSec,
            requiredHeaders: { "Content-Type": contentType }
        });
    } catch (e) {
        console.error("presign error", e);
        return json(500, {
            ok: false,
            error: { code: "PRESIGN_FAILED", message: "Failed to generate presigned URL." }
        });
    }
};

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