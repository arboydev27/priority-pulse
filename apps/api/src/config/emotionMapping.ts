import { EmotionSignal, HfEmotionLabel } from "../contracts";

export const HIGH_SIGNAL_THRESHOLD = 0.6;

export const HF_TO_SIGNAL: Record<HfEmotionLabel, EmotionSignal> = {
    angry: "frustration",
    disgust: "frustration",
    fear: "frustration",
    happy: "positive",
    sad: "uncertain",
    surprise: "uncertain",
    neutral: "neutral",
}

export function toEmotionSignal(
    topLabel: string,
    topScore: number
): { signal: EmotionSignal; confident: boolean } {
    const label = topLabel.toLowerCase() as HfEmotionLabel;

    // Unknown label safety
    if (!(label in HF_TO_SIGNAL)) {
        return { signal: "uncertain", confident: false };
    }

    const signal = HF_TO_SIGNAL[label];
    const confident = topScore >= HIGH_SIGNAL_THRESHOLD;

    // Only trat as a strong signal if confidence is high
    return confident
        ? { signal, confident: true }
        : { signal: "uncertain", confident: false };

}

