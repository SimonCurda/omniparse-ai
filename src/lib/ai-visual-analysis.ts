// ============================================================================
// AI Visual Artifact Analysis — Server-only module
// Uses VLM to detect AI-generated/edited images (ChatGPT, Gemini, Claude, etc.)
// CRITICAL: This file must ONLY be imported from server-side code (API routes)
// ============================================================================

import type { TamperingCheck } from './invoice-engine';
import { geminiVisionCall, type GeminiVisionMessage } from './gemini';

/**
 * VLM-based visual AI artifact detection.
 * Uses a vision model to analyze the actual image content for AI generation artifacts.
 * This is critical because ChatGPT, Gemini, and Claude typically strip ALL metadata,
 * making metadata-based detection alone insufficient.
 *
 * Detects: unnatural textures, inconsistent lighting, AI text artifacts,
 * blurred vs sharp inconsistencies, color grading anomalies, etc.
 */
export async function analyzeImageForAiArtifacts(
  imageBase64: string,
  mimeType: string,
): Promise<TamperingCheck> {
  const checks: TamperingCheck['checks'] = [];

  try {
    const dataUri = `data:${mimeType};base64,${imageBase64}`;

    const analysisPrompt = `You are a forensic image analysis expert specializing in detecting AI-generated and AI-edited images, especially from ChatGPT/DALL-E, Google Gemini/Imagen, Claude/Anthropic, Midjourney, and Stable Diffusion.

Analyze this image for signs of AI generation or AI editing. Look for:

1. **Visual Artifacts**: Unusual texture patterns, noise inconsistencies, repetitive elements, "plastic" or waxy skin textures, unnatural gradients
2. **Text Rendering**: Garbled, inconsistent, or hallucinated text (common in ChatGPT/DALL-E and Gemini images)
3. **Structural Inconsistencies**: Asymmetric features, extra fingers/limbs, impossible geometry, melting edges
4. **Lighting & Shadows**: Inconsistent light sources, missing or wrong shadows, flat lighting (Gemini/ChatGPT common)
5. **Background Anomalies**: Overly smooth or blurry backgrounds, inconsistent depth of field, merged/duplicated background elements
6. **Color & Tone**: Over-saturated colors, uniform color grading, lack of natural color variation
7. **Document-Specific**: If this is a document/invoice, check for: inconsistent fonts, digitally inserted text vs printed text, mismatched alignment, pixel-level tampering signs, inconsistent paper texture

IMPORTANT: Consider that this may be a scanned or photographed invoice/document. Real scanned documents have natural imperfections (slight rotation, shadows from phone/camera, paper texture, varying ink density). AI-generated documents often look "too perfect" or have subtle text rendering issues.

Respond in this EXACT JSON format (no markdown, no explanation):
{
  "isAiGenerated": true/false/null,
  "isAiEdited": true/false/null,
  "confidence": 0.0-1.0,
  "aiToolsSuspected": ["tool name"],
  "artifacts": [
    {"type": "artifact_type", "severity": "high/medium/low", "description": "what you see"}
  ],
  "overallAssessment": "brief summary"
}`;

    const visionMessages: GeminiVisionMessage[] = [{
      role: 'user',
      content: [
        { type: 'text', text: analysisPrompt },
        { type: 'image_url', image_url: { url: dataUri } },
      ],
    }];

    const responseText = await geminiVisionCall(visionMessages);

    if (!responseText) {
      checks.push({
        check: 'visual_ai_analysis',
        status: 'pass',
        detail: 'Visual AI analysis could not be completed (empty response).',
        icon: 'visual',
      });
      return { isSuspicious: false, checks };
    }

    // Parse the VLM response
    let analysis: {
      isAiGenerated?: boolean | null;
      isAiEdited?: boolean | null;
      confidence?: number;
      aiToolsSuspected?: string[];
      artifacts?: Array<{ type: string; severity: string; description: string }>;
      overallAssessment?: string;
    };

    const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/) ?? null;
    const jsonStr = jsonMatch ? jsonMatch[1] : responseText.trim();

    try {
      analysis = JSON.parse(jsonStr);
    } catch {
      // If JSON parsing fails, try to extract useful info from raw text
      const lowerText = responseText.toLowerCase();
      const looksAi = lowerText.includes('ai-generated') || lowerText.includes('ai generated')
        || lowerText.includes('ai-edited') || lowerText.includes('artificial')
        || lowerText.includes('chatgpt') || lowerText.includes('dall-e')
        || lowerText.includes('gemini') || lowerText.includes('claude');

      if (looksAi) {
        checks.push({
          check: 'visual_ai_analysis',
          status: 'warn',
          detail: 'Visual analysis suggests possible AI involvement. AI artifacts were identified in the image content.',
          icon: 'visual',
        });
      } else {
        checks.push({
          check: 'visual_ai_analysis',
          status: 'pass',
          detail: 'Visual analysis did not detect obvious AI artifacts.',
          icon: 'visual',
        });
      }
      return { isSuspicious: looksAi, checks };
    }

    // Process structured analysis results
    const isAi = analysis.isAiGenerated === true || analysis.isAiEdited === true;
    const confidence = analysis.confidence ?? 0;

    // Build detail message
    const parts: string[] = [];

    if (analysis.aiToolsSuspected && analysis.aiToolsSuspected.length > 0) {
      parts.push(`Suspected AI tools: ${analysis.aiToolsSuspected.join(', ')}.`);
    }

    if (analysis.artifacts && analysis.artifacts.length > 0) {
      const highSeverity = analysis.artifacts.filter(a => a.severity === 'high');
      const medSeverity = analysis.artifacts.filter(a => a.severity === 'medium');

      if (highSeverity.length > 0) {
        parts.push(`${highSeverity.length} high-severity artifact(s): ${highSeverity.map(a => a.description).slice(0, 3).join('; ')}.`);
      }
      if (medSeverity.length > 0) {
        parts.push(`${medSeverity.length} medium-severity artifact(s): ${medSeverity.map(a => a.description).slice(0, 2).join('; ')}.`);
      }
    }

    if (analysis.overallAssessment) {
      parts.push(analysis.overallAssessment);
    }

    if (isAi && confidence >= 0.6) {
      checks.push({
        check: 'visual_ai_analysis',
        status: 'fail',
        detail: `AI-generated or AI-edited image detected (confidence: ${Math.round(confidence * 100)}%). ${parts.join(' ')}`,
        icon: 'visual',
      });
    } else if (isAi || confidence >= 0.4) {
      checks.push({
        check: 'visual_ai_analysis',
        status: 'warn',
        detail: `Possible AI involvement detected (confidence: ${Math.round(confidence * 100)}%). ${parts.join(' ')}`,
        icon: 'visual',
      });
    } else {
      checks.push({
        check: 'visual_ai_analysis',
        status: 'pass',
        detail: `No AI artifacts detected (${Math.round((1 - confidence) * 100)}% likely authentic). ${analysis.overallAssessment || 'Image appears genuine.'}`,
        icon: 'visual',
      });
    }

    // Add individual artifact checks for high-severity findings
    if (analysis.artifacts) {
      for (const artifact of analysis.artifacts.filter(a => a.severity === 'high').slice(0, 3)) {
        checks.push({
          check: 'artifact_detail',
          status: 'warn',
          detail: `[${artifact.type}] ${artifact.description}`,
          icon: 'ai',
        });
      }
    }

    return {
      isSuspicious: isAi && confidence >= 0.6,
      checks,
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    checks.push({
      check: 'visual_ai_analysis',
      status: 'pass',
      detail: `Visual AI analysis unavailable: ${msg}. Metadata-based checks still apply.`,
      icon: 'visual',
    });
    return { isSuspicious: false, checks };
  }
}
