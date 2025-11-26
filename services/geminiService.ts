import { GoogleGenAI } from "@google/genai";
import { GhostResult } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const analyzeGhosting = async (
  name?: string,
  city?: string,
  lastMessage?: string,
  screenshotsBase64?: string[]
): Promise<GhostResult> => {
  
  const parts: any[] = [];

  // Determine context for the AI
  let userProvidedName = name && name.trim().length > 0 ? name : "UNKNOWN_SUBJECT";
  let userProvidedCity = city && city.trim().length > 0 ? city : "UNKNOWN_CITY";
  const isAutoDetect = userProvidedName === "UNKNOWN_SUBJECT";

  if (screenshotsBase64 && screenshotsBase64.length > 0) {
    // Add all images to the payload
    screenshotsBase64.forEach(base64 => {
      parts.push({
        inlineData: {
          mimeType: "image/png",
          data: base64
        }
      });
    });
    
    parts.push({
      text: `EVIDENCE SUBMITTED: ${screenshotsBase64.length} screenshot(s) of conversation.
      ${isAutoDetect ? "USER HAS NOT PROVIDED NAME/CITY. YOU MUST EXTRACT IT FROM THE IMAGE HEADER/CONTEXT." : `Subject Name: "${userProvidedName}". Subject City: "${userProvidedCity}".`}
      ANALYZE TIMESTAMP GAPS, ONE-WORD REPLIES, AND DISRESPECT.`
    });
  } else {
    parts.push({
      text: `EVIDENCE SUBMITTED: Last Message from subject "${userProvidedName}": "${lastMessage}". City: "${userProvidedCity}".`
    });
  }

  // THE NEW "INDIA FOCUSED" SYSTEM INSTRUCTION WITH OSINT CAPABILITIES
  const prompt = `
    SYSTEM IDENTITY: THE STREET ORACLE (INDIA DIVISION).
    VIBE: "Hard" Aesthetic but with Indian context. Direct, Brutal, No-Nonsense.
    
    MISSION:
    1. **OCR/IDENTITY CHECK**: If name/city is "UNKNOWN_SUBJECT", LOOK AT THE IMAGE HEADER. The name at the top of the chat is the Target. Infer city from context if possible (Area codes, place names like 'Bandra', 'Gurgaon').
    2. **REALITY CHECK**: Determine if the user is "COOKED" (Ghosted/Played) or if the subject has a valid excuse.

    PROTOCOL (OSINT & LEGAL SCAN):
    USE GOOGLE SEARCH TO FIND REAL-TIME DATA. DO NOT HALLUCINATE.
    
    1. **LEGAL/FIR CHECK**: Search for:
       - "[Target Name] FIR record [City]"
       - "[Target Name] e-Courts case status"
       - "[Target Name] police arrest news [City]"
       
    2. **OBITUARY/NEWS SCAN**: Search for:
       - "[Target Name] obituary [City] 2024 2025"
       - "Times of India obituary [Target Name]"
       
    3. **DIGITAL FOOTPRINT (SOCIAL STALKER MODE)**:
       - **STRAVA**: Search 'site:strava.com/athletes "[Target Name]" "[City]"'. Look for "Today", "Yesterday", or recent dates in snippets.
       - **SPOTIFY**: Search 'site:open.spotify.com/user "[Target Name]"'. Look for public playlists updated recently.
       - **LINKEDIN**: Search 'site:linkedin.com/in "[Target Name]"'. Look for "posted 2h ago" etc.
       - **GENERAL**: Search '"[Target Name]" [City]'.

    PASS JUDGEMENT:
       - IF LEGAL TROUBLE (FIR/COURT): Verdict = 0% COOKED. "BHAI IS BUSY WITH POLICE." (Mark evidence as "JAILED/LEGAL")
       - IF DEAD: Verdict = 0% COOKED. "OM SHANTI." (Mark evidence as "DEAD")
       - IF RECENTLY ACTIVE ON SOCIALS (Strava run today, etc) BUT IGNORING TEXTS: Verdict = 100% COOKED. "RUNNING 5K BUT CAN'T TEXT BACK? NAH."
       - IF GHOSTING: Verdict = 100% COOKED. "WASTED."

    OUTPUT FORMAT (RAW JSON ONLY):
    {
      "identifiedName": "string (The name you used for analysis. If extracted from image, put it here)",
      "identifiedCity": "string (The city you used. If unknown, put 'UNKNOWN')",
      "cookedLevel": number (0-100),
      "verdict": "string (Short, punchy, all-caps roast. Max 2 sentences. Use global slang or Indian-English context: 'KATA GAYA', 'SCENE OFF HAI', 'FULL IGNORE', 'TOUCH GRASS')",
      "isDead": boolean,
      "evidence": [
        { "label": "LEGAL CHECK", "status": "clean" | "jailed", "detail": "string (E.g. 'NO E-COURT RECORDS FOUND' or 'FOUND: FIR IN BANDRA')" },
        { "label": "OBITUARY SCAN", "status": "clean" | "dead", "detail": "string (E.g. 'NO TOI/HINDU OBITUARIES' or 'MATCH FOUND: AUG 2024')" },
        { "label": "VIBE CHECK", "status": "clean" | "cooked", "detail": "string (brutal observation on text dryness/audacity)" }
      ],
      "socialScan": [
         { 
           "platform": "Strava" | "Spotify" | "LinkedIn" | "Instagram",
           "status": "active" | "silent" | "unknown",
           "lastSeen": "string (e.g. '2 HOURS AGO', 'UNKNOWN')",
           "detail": "string (e.g. 'LOGGED 5K RUN IN JUHU', 'NO PUBLIC PROFILE')" 
         }
      ]
    }
    
    DO NOT USE MARKDOWN. ONLY RAW JSON.
  `;

  parts.push({ text: prompt });

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: { parts: parts },
      config: {
        tools: [{ googleSearch: {} }],
      }
    });

    let text = response.text;
    if (!text) throw new Error("Connection Lost");
    
    text = text.trim();
    if (text.startsWith('```json')) {
      text = text.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    } else if (text.startsWith('```')) {
      text = text.replace(/^```\s*/, '').replace(/\s*```$/, '');
    }

    return JSON.parse(text) as GhostResult;

  } catch (error) {
    console.error("Scan Failed:", error);
    return {
      cookedLevel: 100,
      verdict: "SERVER CRASHED. JUST LIKE YOUR LOVE LIFE. ASSUME THE WORST.",
      isDead: false,
      evidence: [
        { label: "ERROR", status: "cooked", detail: "AI GAVE UP" }
      ],
      socialScan: [],
      identifiedName: name || "UNKNOWN",
      identifiedCity: city || "UNKNOWN"
    };
  }
};