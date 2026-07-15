import {
  BUILT_IN_PERSONA_IDS,
  PERSONA_INTENSITIES,
  PERSONA_LOCALES,
  type PersonaLocale,
} from "@ai-agent-personas/core";

export const personaIds = BUILT_IN_PERSONA_IDS;

export type PersonaId = (typeof personaIds)[number];

export const locales = PERSONA_LOCALES;
export const intensities = PERSONA_INTENSITIES;

export const copy = {
  en: {
    nav: {
      personas: "Personas",
      how: "How it works",
      cli: "CLI",
      github: "GitHub",
    },
    home: {
      eyebrow: "Open-source persona library for AI agents",
      title: "Give your agent a voice worth remembering.",
      support:
        "Seven original, safety-aware personas. Voice adds character after the answer is solved — never inside solver reasoning.",
      explore: "Explore the personas",
      install: "Install the CLI",
      selected: "Selected persona",
      promptPreview: "Prompt preview",
      principlesTitle: "Personality with a quality contract.",
      principlesSupport:
        "Safety, optional Task methods, and output-only Voice stay separate by contract.",
      reasoningEyebrow: "Reasoning boundary",
      reasoningTitle: "The answer first. Character second.",
      reasoningLead:
        "The solver completes the task before Voice is applied. No persona Voice instruction enters the solver request, so Voice adds no persona-driven reasoning tokens to the solver stage.",
      reasoningMetric: "persona-driven reasoning tokens in the solver stage",
      reasoningFlowLabel: "Output-only Voice architecture",
      reasoningSteps: [
        { title: "Solver", detail: "Task + reasoning" },
        { title: "Completed answer", detail: "Fixed source of truth" },
        { title: "Voice", detail: "Presentation only" },
      ],
      openPersona: "Open persona",
    },
    catalog: {
      eyebrow: "The complete cast",
      title: "Choose the voice. Keep the usefulness.",
      support:
        "Voice renders a finished answer; Task methods activate only after an explicit compatibility check.",
      all: "All",
      education: "Education",
      playful: "Playful",
      dramatic: "Dramatic",
      fantasy: "Fantasy",
      analysis: "Analysis",
      service: "Service",
      heroic: "Heroic",
      intensityTitle: "One voice, three presentation levels.",
      defaultIntensity: "Default",
      empty: "No personas match this filter.",
    },
    detail: {
      back: "Personas",
      language: "Language",
      intensity: "Intensity",
      prompt: "Prompt",
      examples: "Examples",
      safety: "Safety",
      systemPrompt: "System prompt",
      copy: "Copy prompt",
      copied: "Prompt copied",
      updated: "Prompt updated",
      copyFailed: "Copy failed — select and copy the text manually.",
      promptUnavailable: "Prompt data is unavailable. Reload the page.",
      download: "Download .txt",
      principles: "How the voice holds.",
      user: "User",
      assistant: "Assistant",
      safetyRating: "Content rating",
      command: "Use from your terminal",
    },
    labels: {
      subtle: "Subtle",
      balanced: "Balanced",
      immersive: "Immersive",
      english: "English",
      russian: "Russian",
    },
    intensityDescriptions: {
      subtle: "A trace of personality. Maximum neutrality.",
      balanced: "Recognizable, expressive, and practical.",
      immersive: "Full theatrical presence without changing the answer.",
    },
    footer: "Open source. Original voices. Useful first.",
  },
  ru: {
    nav: {
      personas: "Персоны",
      how: "Как это работает",
      cli: "CLI",
      github: "GitHub",
    },
    home: {
      eyebrow: "Открытая библиотека персон для ИИ-агентов",
      title: "Подарите агенту голос, который хочется запомнить.",
      support:
        "Семь оригинальных безопасных персон. Voice добавляет характер после готового решения — не внутри reasoning solver-а.",
      explore: "Выбрать персону",
      install: "Установить CLI",
      selected: "Выбранная персона",
      promptPreview: "Предпросмотр промпта",
      principlesTitle: "Характер с контрактом качества.",
      principlesSupport:
        "Safety, опциональные Task-методы и output-only Voice разделены контрактом.",
      reasoningEyebrow: "Граница рассуждения",
      reasoningTitle: "Сначала ответ. Затем характер.",
      reasoningLead:
        "Solver завершает задачу до применения Voice. Ни одна Voice-инструкция персоны не входит в запрос solver, поэтому Voice не добавляет persona-driven reasoning-токены на этапе решения.",
      reasoningMetric: "persona-driven reasoning-токенов на этапе solver",
      reasoningFlowLabel: "Архитектура output-only Voice",
      reasoningSteps: [
        { title: "Solver", detail: "Задача + reasoning" },
        { title: "Готовый ответ", detail: "Зафиксированный источник истины" },
        { title: "Voice", detail: "Только подача" },
      ],
      openPersona: "Открыть персону",
    },
    catalog: {
      eyebrow: "Весь состав",
      title: "Выберите голос. Сохраните пользу.",
      support:
        "Voice оформляет готовый ответ, а Task-метод включается только после явной проверки совместимости.",
      all: "Все",
      education: "Обучение",
      playful: "Игривые",
      dramatic: "Драматичные",
      fantasy: "Фэнтези",
      analysis: "Анализ",
      service: "Сервис",
      heroic: "Героические",
      intensityTitle: "Один голос, три уровня подачи.",
      defaultIntensity: "По умолчанию",
      empty: "В этой категории пока нет персон.",
    },
    detail: {
      back: "Персоны",
      language: "Язык",
      intensity: "Выразительность",
      prompt: "Промпт",
      examples: "Примеры",
      safety: "Безопасность",
      systemPrompt: "Системный промпт",
      copy: "Копировать промпт",
      copied: "Промпт скопирован",
      updated: "Промпт обновлён",
      copyFailed: "Не удалось скопировать — выделите текст вручную.",
      promptUnavailable: "Данные промпта недоступны. Перезагрузите страницу.",
      download: "Скачать .txt",
      principles: "Как держится образ.",
      user: "Пользователь",
      assistant: "Ассистент",
      safetyRating: "Возрастной рейтинг",
      command: "Запуск из терминала",
    },
    labels: {
      subtle: "Лёгкий",
      balanced: "Сбалансированный",
      immersive: "Иммерсивный",
      english: "Английский",
      russian: "Русский",
    },
    intensityDescriptions: {
      subtle: "Лёгкий оттенок характера. Максимум нейтральности.",
      balanced: "Узнаваемо, выразительно и практично.",
      immersive: "Полное погружение без изменения ответа.",
    },
    footer: "Открытый код. Оригинальные голоса. Польза прежде всего.",
  },
} as const;

export function withBase(path: string): string {
  const base = import.meta.env.BASE_URL.replace(/\/$/, "");
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

export function localePath(locale: PersonaLocale, path = ""): string {
  const suffix = path ? `/${path.replace(/^\/+|\/+$/g, "")}` : "";
  return locale === "ru" ? withBase(`/ru${suffix}/`) : withBase(`${suffix || ""}/`);
}

export function personaPath(locale: PersonaLocale, id: string): string {
  return localePath(locale, `personas/${id}`);
}

export function otherLocale(locale: PersonaLocale): PersonaLocale {
  return locale === "en" ? "ru" : "en";
}
