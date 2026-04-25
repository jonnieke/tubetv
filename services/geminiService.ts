import { GoogleGenAI } from "@google/genai";
import { DailyStat, Caption } from "../types";

const getClient = () => {
  // Vite exposes env vars via import.meta.env, NOT process.env
  const apiKey = import.meta.env.VITE_API_KEY as string | undefined;
  if (!apiKey) {
    console.warn('VITE_API_KEY not set. AI features disabled. Add it to your .env file.');
    return null;
  }
  return new GoogleGenAI({ apiKey });
};

export const generateVideoMetadata = async (fileName: string, fileSize: number) => {
  const client = getClient();
  if (!client) return { title: "Error", description: "API Key missing" };

  try {
    const prompt = `
      I am uploading a video file named "${fileName}" with size ${fileSize} bytes.
      Please generate a catchy, clickbait-style YouTube title and a short, engaging description for this video.
      Assume the content is related to the filename.
      Return the response in JSON format with keys: "title" and "description".
    `;

    const response = await client.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json"
      }
    });

    const text = response.text;
    if (!text) return { title: fileName, description: "Could not generate description." };
    
    return JSON.parse(text);
  } catch (error) {
    console.error("Gemini Metadata Error:", error);
    return { title: fileName, description: "Manual description required." };
  }
};

export const generateThumbnail = async (prompt: string) => {
  const client = getClient();
  if (!client) return null;

  try {
    const response = await client.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [{ text: `Generate a high-quality, catchy YouTube thumbnail for a video about: ${prompt}. The image should be vibrant, 16:9 aspect ratio, and suitable for a streaming platform.` }],
      },
      // Note: responseMimeType is not supported for image generation models
    });

    // Extract image from response parts
    if (response.candidates?.[0]?.content?.parts) {
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) {
          return `data:image/png;base64,${part.inlineData.data}`;
        }
      }
    }
    return null;
  } catch (error) {
    console.error("Gemini Thumbnail Error:", error);
    return null;
  }
};

export const generateAnalyticsInsights = async (data: DailyStat[]) => {
  const client = getClient();
  if (!client) return "Connect API Key for AI insights.";

  try {
    const dataString = JSON.stringify(data);
    const prompt = `
      Analyze the following daily video streaming statistics:
      ${dataString}

      Provide a concise, 2-sentence executive summary of the performance trends. 
      Focus on revenue spikes and view engagement. Act like a senior data analyst at a streaming giant.
    `;

    const response = await client.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
    });

    return response.text || "No insights available.";
  } catch (error) {
    console.error("Gemini Analytics Error:", error);
    return "Unable to generate insights at this time.";
  }
};

export const generateVideoSpecificInsights = async (videoTitle: string, metrics: { views: number, retention: number, ctr: number }) => {
  const client = getClient();
  if (!client) return "AI Analysis unavailable.";

  try {
    const prompt = `
      Analyze the performance of a specific video titled "${videoTitle}".
      Metrics:
      - Total Views: ${metrics.views}
      - Average Retention: ${metrics.retention}%
      - Click-Through Rate (CTR): ${metrics.ctr}%

      Provide 2 brief, actionable tips to improve this specific video's performance or what to do for the next video.
      Focus on audience retention and packaging.
    `;

    const response = await client.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
    });

    return response.text || "Analysis incomplete.";
  } catch (error) {
    console.error("Gemini Video Insight Error:", error);
    return "Could not generate video analysis.";
  }
};

export const generateCaptions = async (title: string, category: string): Promise<Caption[]> => {
  const client = getClient();
  if (!client) return [];

  try {
    const prompt = `
      Generate a set of synchronized captions (subtitles) for a video titled "${title}" in the genre "${category}".
      
      Create dialogue or narration that fits the video title. It should feel like a real movie or show script.
      Return the output as a strictly formatted JSON array of objects.
      The total duration is 60 seconds.
      Structure:
      [
        { "start": number, "end": number, "text": "string" }
      ]
      
      Ensure timestamps are sequential and do not overlap. Cover key moments in the 0-60s range.
    `;

    const response = await client.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json"
      }
    });

    const text = response.text;
    if (!text) return [];
    
    return JSON.parse(text) as Caption[];
  } catch (error) {
    console.error("Gemini Caption Error:", error);
    // Fallback captions
    return [
      { start: 1, end: 4, text: 'Welcome to Tube Originals.' },
      { start: 5, end: 8, text: 'This is an AI-generated caption preview.' },
      { start: 9, end: 12, text: 'Experience the story like never before.' },
      { start: 15, end: 20, text: '[Dramatic Music Playing]' }
    ];
  }
};

export const getVideoRecommendations = async (
  userHistory: { title: string; category: string }[],
  availableVideos: { id: string; title: string; category: string }[]
): Promise<string[]> => {
  const client = getClient();
  if (!client) return [];

  try {
    if (userHistory.length === 0) return [];

    const prompt = `
      I have a user who is interested in the following videos (Watch History/Watch Later):
      ${JSON.stringify(userHistory)}

      Here is the list of available videos on the platform:
      ${JSON.stringify(availableVideos)}

      Based on the user's history, identify the top 3 most relevant videos from the available list that they haven't watched yet (or if they are in the history, similar ones).
      Analyze the genre and title patterns.
      
      Return ONLY a JSON array of the "id" strings of the recommended videos.
      Example: ["1", "3"]
    `;

    const response = await client.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json"
      }
    });

    const text = response.text;
    if (!text) return [];

    return JSON.parse(text) as string[];
  } catch (error) {
    console.warn("Gemini Recommendation unavailable (API key blocked or missing).");
    return [];
  }
};