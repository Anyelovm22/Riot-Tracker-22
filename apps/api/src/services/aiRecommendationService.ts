import axios from 'axios';
import { z } from 'zod';
import { env } from '../config/env.js';

const roleLabels: Record<string, string> = {
  TOP: 'Top',
  JUNGLE: 'Jungla',
  MID: 'Mid',
  ADC: 'Bot',
  SUPPORT: 'Soporte',
  UNKNOWN: 'Sin rol'
};

const guideSeedSchema = z.object({
  id: z.string(),
  title: z.string(),
  focus: z.string(),
  priority: z.string(),
  minutes: z.number(),
  source: z.string(),
  steps: z.array(z.string())
});

const challengeSeedSchema = z.object({
  id: z.string(),
  skill: z.string(),
  title: z.string(),
  target: z.string(),
  progress: z.number(),
  total: z.number(),
  met: z.boolean()
});

export const aiCoachRequestSchema = z.object({
  player: z.object({
    gameName: z.string(),
    tagLine: z.string(),
    region: z.string(),
    queue: z.string(),
    rankedLabel: z.string(),
    leaguePoints: z.number().optional()
  }),
  dominantRole: z.string(),
  analytics: z.object({
    games: z.number(),
    wins: z.number(),
    losses: z.number(),
    winRate: z.number(),
    avgKda: z.number(),
    avgCs: z.number(),
    avgVision: z.number(),
    avgDeaths: z.number(),
    avgGold: z.number(),
    avgDamage: z.number(),
    avgKillParticipation: z.number(),
    avgObjectives: z.number()
  }),
  gpi: z.array(
    z.object({
      key: z.string(),
      label: z.string(),
      value: z.number(),
      detail: z.string()
    })
  ),
  championPool: z.array(
    z.object({
      championName: z.string(),
      role: z.string(),
      games: z.number(),
      wins: z.number(),
      losses: z.number(),
      winRate: z.number(),
      avgKda: z.number(),
      avgCs: z.number(),
      avgVision: z.number(),
      avgDeaths: z.number(),
      lastPlayedAt: z.number()
    })
  ),
  recentMatches: z.array(
    z.object({
      championName: z.string(),
      role: z.string(),
      result: z.string(),
      kda: z.string(),
      csPerMinute: z.number(),
      visionScore: z.number(),
      killParticipation: z.number(),
      objectiveTakedowns: z.number(),
      gameCreation: z.number()
    })
  ),
  baselineGuides: z.array(guideSeedSchema),
  baselineChallenges: z.array(challengeSeedSchema)
});

type AiCoachRequest = z.infer<typeof aiCoachRequestSchema>;

const modelGuideSchema = z.object({
  id: z.string().optional(),
  title: z.string(),
  focus: z.string(),
  priority: z.string(),
  minutes: z.number().optional(),
  source: z.string().optional(),
  why: z.string().optional(),
  steps: z.array(z.string()).default([])
});

const modelChallengeSchema = z.object({
  id: z.string().optional(),
  skill: z.string(),
  title: z.string(),
  target: z.string(),
  progressLabel: z.string().optional(),
  why: z.string().optional(),
  checkpoints: z.array(z.string()).default([])
});

const modelResponseSchema = z.object({
  summary: z.string(),
  rolePlan: z.array(z.string()).default([]),
  guides: z.array(modelGuideSchema).default([]),
  challenges: z.array(modelChallengeSchema).default([])
});

export interface AiCoachResponse {
  source: 'openai' | 'gemini' | 'rules';
  model: string;
  generatedAt: string;
  notice?: string;
  summary: string;
  rolePlan: string[];
  guides: Array<z.infer<typeof modelGuideSchema>>;
  challenges: Array<z.infer<typeof modelChallengeSchema>>;
}

const clampText = (value: string, maxLength = 220) => value.trim().slice(0, maxLength);

const buildFallback = (request: AiCoachRequest, notice?: string): AiCoachResponse => {
  const weakest = [...request.gpi].sort((a, b) => a.value - b.value)[0];
  const strongest = [...request.gpi].sort((a, b) => b.value - a.value)[0];
  const mainChampion = request.championPool[0]?.championName ?? 'tu campeon principal';
  const roleName = roleLabels[request.dominantRole] ?? request.dominantRole;

  return {
    source: 'rules',
    model: 'local-rules',
    generatedAt: new Date().toISOString(),
    notice,
    summary: weakest
      ? `${roleName}: prioriza ${weakest.label.toLowerCase()} sin soltar ${strongest?.label.toLowerCase() ?? 'tu punto fuerte'} con ${mainChampion}.`
      : `${roleName}: juega sobre tu campeon mas repetido y revisa las ultimas partidas clasificatorias.`,
    rolePlan: [
      `Plan de rol: juega los primeros 8 minutos con una condicion clara para ${roleName}.`,
      `Campeon foco: repite ${mainChampion} hasta estabilizar farm, vision y muertes.`,
      request.analytics.avgDeaths > 6
        ? 'Regla de sesion: no pelear objetivos sin vision lateral o informacion del jungla rival.'
        : 'Regla de sesion: convierte prioridad en vision profunda, placas u objetivo neutral.'
    ],
    guides: request.baselineGuides.slice(0, 4).map((guide) => ({
      ...guide,
      why: `Basado en ${request.analytics.games} partidas, rol ${roleName} y foco reciente con ${mainChampion}.`
    })),
    challenges: request.baselineChallenges.slice(0, 4).map((challenge) => ({
      id: challenge.id,
      skill: challenge.skill,
      title: challenge.title,
      target: challenge.target,
      progressLabel: `${challenge.progress}/${challenge.total}`,
      why: `Reto ajustado a tu rol ${roleName} y a la muestra reciente de ranked.`,
      checkpoints: [
        'Revisa el objetivo antes de entrar a cola.',
        'Marca si el fallo vino de wave, vision, cooldown o tempo.',
        'Compara el resultado despues de 3 partidas.'
      ]
    }))
  };
};

const buildPrompt = (request: AiCoachRequest) => {
  const context = JSON.stringify(
    {
      ...request,
      recentMatches: request.recentMatches.slice(0, 12),
      championPool: request.championPool.slice(0, 6)
    },
    null,
    2
  );

  return [
    'Eres un coach de League of Legends para una app de analitica competitiva.',
    'Responde solo JSON valido. No uses markdown.',
    'Usa el rol mas jugado, el champion pool, GPI, retos base y ultimas partidas para personalizar.',
    'Mantén los ids de baselineGuides y baselineChallenges cuando sea posible.',
    'No inventes datos externos, no prometas LP exacto y no recomiendes toxicidad.',
    'Formato exacto: {"summary":string,"rolePlan":string[],"guides":[{"id":string,"title":string,"focus":string,"priority":string,"minutes":number,"source":string,"why":string,"steps":string[]}],"challenges":[{"id":string,"skill":string,"title":string,"target":string,"progressLabel":string,"why":string,"checkpoints":string[]}]}',
    `Contexto JSON:\n${context}`
  ].join('\n');
};

const safeParseJson = (value: string) => {
  const clean = value
    .trim()
    .replace(/^```json/i, '')
    .replace(/^```/, '')
    .replace(/```$/, '')
    .trim();
  return JSON.parse(clean) as unknown;
};

const normalizeModelResponse = (
  request: AiCoachRequest,
  source: AiCoachResponse['source'],
  model: string,
  raw: unknown
): AiCoachResponse => {
  const parsed = modelResponseSchema.safeParse(raw);
  if (!parsed.success) {
    return buildFallback(request, 'La IA respondio con un formato inesperado; se uso el coach local.');
  }

  const fallback = buildFallback(request);
  const data = parsed.data;

  return {
    source,
    model,
    generatedAt: new Date().toISOString(),
    summary: clampText(data.summary || fallback.summary),
    rolePlan: (data.rolePlan.length ? data.rolePlan : fallback.rolePlan).slice(0, 4).map((item) => clampText(item, 180)),
    guides: (data.guides.length ? data.guides : fallback.guides).slice(0, 4).map((guide, index) => ({
      id: guide.id ?? fallback.guides[index]?.id ?? `guide-${index}`,
      title: clampText(guide.title, 90),
      focus: clampText(guide.focus, 120),
      priority: clampText(guide.priority, 32),
      minutes: Math.max(3, Math.min(20, Math.round(guide.minutes ?? fallback.guides[index]?.minutes ?? 8))),
      source: clampText(guide.source ?? fallback.guides[index]?.source ?? 'IA coach', 80),
      why: clampText(guide.why ?? fallback.guides[index]?.why ?? fallback.summary, 180),
      steps: (guide.steps.length ? guide.steps : fallback.guides[index]?.steps ?? []).slice(0, 4).map((step) => clampText(step, 180))
    })),
    challenges: (data.challenges.length ? data.challenges : fallback.challenges).slice(0, 4).map((challenge, index) => ({
      id: challenge.id ?? fallback.challenges[index]?.id ?? `challenge-${index}`,
      skill: clampText(challenge.skill, 48),
      title: clampText(challenge.title, 90),
      target: clampText(challenge.target, 140),
      progressLabel: clampText(challenge.progressLabel ?? fallback.challenges[index]?.progressLabel ?? ''),
      why: clampText(challenge.why ?? fallback.challenges[index]?.why ?? fallback.summary, 180),
      checkpoints: (challenge.checkpoints.length ? challenge.checkpoints : fallback.challenges[index]?.checkpoints ?? [])
        .slice(0, 4)
        .map((step) => clampText(step, 180))
    }))
  };
};

const resolveProvider = () => {
  if (env.AI_PROVIDER === 'openai') return env.OPENAI_API_KEY ? 'openai' : 'rules';
  if (env.AI_PROVIDER === 'gemini') return env.GEMINI_API_KEY ? 'gemini' : 'rules';
  if (env.AI_PROVIDER === 'rules') return 'rules';
  if (env.OPENAI_API_KEY) return 'openai';
  if (env.GEMINI_API_KEY) return 'gemini';
  return 'rules';
};

const requestOpenAi = async (request: AiCoachRequest) => {
  const prompt = buildPrompt(request);
  const { data } = await axios.post(
    'https://api.openai.com/v1/chat/completions',
    {
      model: env.OPENAI_MODEL,
      messages: [
        {
          role: 'system',
          content: 'Eres un coach de League of Legends. Responde solo JSON valido con recomendaciones concretas.'
        },
        { role: 'user', content: prompt }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.35,
      max_completion_tokens: 1600
    },
    {
      headers: {
        Authorization: `Bearer ${env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      timeout: env.AI_REQUEST_TIMEOUT_MS
    }
  );

  const content = data?.choices?.[0]?.message?.content;
  if (typeof content !== 'string') {
    throw new Error('OpenAI no devolvio contenido de texto.');
  }

  return normalizeModelResponse(request, 'openai', env.OPENAI_MODEL, safeParseJson(content));
};

const requestGemini = async (request: AiCoachRequest) => {
  const prompt = buildPrompt(request);
  const { data } = await axios.post(
    `https://generativelanguage.googleapis.com/v1beta/models/${env.GEMINI_MODEL}:generateContent`,
    {
      contents: [
        {
          role: 'user',
          parts: [{ text: prompt }]
        }
      ],
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.35,
        maxOutputTokens: 1600
      }
    },
    {
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': env.GEMINI_API_KEY
      },
      timeout: env.AI_REQUEST_TIMEOUT_MS
    }
  );

  const content = data?.candidates?.[0]?.content?.parts?.map((part: { text?: string }) => part.text ?? '').join('');
  if (typeof content !== 'string' || !content.trim()) {
    throw new Error('Gemini no devolvio contenido de texto.');
  }

  return normalizeModelResponse(request, 'gemini', env.GEMINI_MODEL, safeParseJson(content));
};

export const aiRecommendationService = {
  async getCoachRecommendations(input: unknown): Promise<AiCoachResponse> {
    const request = aiCoachRequestSchema.parse(input);
    const provider = resolveProvider();

    if (provider === 'rules') {
      return buildFallback(
        request,
        env.AI_PROVIDER === 'rules' ? 'AI_PROVIDER=rules esta activo; se usaron recomendaciones locales.' : 'No hay key de IA configurada; se usaron recomendaciones locales.'
      );
    }

    try {
      if (provider === 'openai') return await requestOpenAi(request);
      return await requestGemini(request);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'error desconocido';
      return buildFallback(request, `La IA no respondio (${message}); se usaron recomendaciones locales.`);
    }
  }
};
