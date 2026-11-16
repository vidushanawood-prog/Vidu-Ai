import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, ThinkingLevel } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

interface ServerStats {
  totalRequests: number;
  flashRequests: number;
  proRequests: number;
  imagePromptsGenerated: number;
  serverStartedAt: string;
}

const serverStats: ServerStats = {
  totalRequests: 0,
  flashRequests: 0,
  proRequests: 0,
  imagePromptsGenerated: 0,
  serverStartedAt: new Date().toISOString(),
};

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '4mb' }));

  app.get('/api/admin/stats', (_req, res) => {
    res.json(serverStats);
  });

  app.post('/api/gemini/generate', async (req, res) => {
    try {
      const {
        prompt,
        modelMode = 'flash',
        adminSystemOverride = '',
        isImageRequest = false,
        history = [],
      } = req.body as {
        prompt?: string;
        modelMode?: 'flash' | 'pro';
        adminSystemOverride?: string;
        isImageRequest?: boolean;
        history?: Array<{ role: 'user' | 'model'; text: string }>;
      };

      if (!prompt || typeof prompt !== 'string') {
        res.status(400).json({ error: 'Prompt is required.' });
        return;
      }

      serverStats.totalRequests += 1;
      if (modelMode === 'pro') {
        serverStats.proRequests += 1;
      } else {
        serverStats.flashRequests += 1;
      }
      if (isImageRequest) {
        serverStats.imagePromptsGenerated += 1;
      }

      const basePersona =
        'You are Vidu AI, an elite, high-speed hacker terminal assistant created and architected by Vidusha Nawood. ' +
        'You are completely fluent in both Sinhala (සිංහල) and English. ' +
        'If the user writes in Sinhala, Singlish, or asks for Sinhala explanations, respond fluently in natural Sinhala (with crisp technical terms where appropriate). ' +
        'If the user writes in English, respond in crisp, authoritative English. ' +
        'You specialize in full-stack software engineering, cybersecurity architecture, Linux/terminal automation, and visual prompt synthesis. ' +
        'Always provide complete, unabridged code blocks when asked for code.';

      const imagePromptDirective = isImageRequest
        ? '\n\nIMAGE SYNTHESIS MODE ACTIVE: Output a structured visual generation package containing:\n' +
          '1. **Midjourney v6 Master Prompt**: Complete copy-ready prompt with subject, environment, lighting, camera optics, and flags (`--ar 16:9 --v 6.0 --style raw --stylize 250`).\n' +
          '2. **DALL-E 3 Specification**: High-detail compositional paragraph.\n' +
          '3. **Technical Camera & Lighting Notes**: Lens focal length, color palette, and negative prompt parameters.'
        : '';

      const systemInstruction = [
        adminSystemOverride.trim() || basePersona,
        imagePromptDirective,
      ]
        .filter(Boolean)
        .join('\n\n');

      const conversationContext =
        Array.isArray(history) && history.length > 0
          ? history
              .slice(-8)
              .map((m) => `${m.role === 'user' ? 'User' : 'Vidu AI'}: ${m.text}`)
              .join('\n\n') + `\n\nUser: ${prompt}`
          : prompt;

      const thinkingLevel =
        modelMode === 'pro' ? ThinkingLevel.HIGH : ThinkingLevel.LOW;

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: conversationContext,
        config: {
          systemInstruction,
          thinkingConfig: {
            thinkingLevel,
          },
        },
      });

      const outputText =
        response.text ??
        'No response payload returned from the model. Please verify your query and try again.';

      res.json({
        text: outputText,
        modelMode,
        timestamp: new Date().toISOString(),
      });
    } catch (error: unknown) {
      console.error('Gemini API generation error:', error);
      const message =
        error instanceof Error
          ? error.message
          : 'Unexpected server error while querying Gemini API.';
      res.status(500).json({
        error: message,
      });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Vidu AI server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
