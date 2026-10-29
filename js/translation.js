/**
 * translation.js
 * Módulo de servicio de traducción.
 * Integra la API de Gemini (Google AI Studio) como proveedor principal
 * y MyMemory Translation como respaldo gratuito para pruebas.
 */

import { CONFIG } from './configLoader.js';

class TranslationService {
  constructor() {
    // Carga de configuración inicial desde configLoader.js o sobreescritura en localStorage
    this.geminiApiKey = localStorage.getItem('vt_gemini_key') ?? CONFIG.geminiApiKey ?? '';
    this.geminiModel = localStorage.getItem('vt_gemini_model') ?? CONFIG.geminiModel ?? 'gemini-2.5-flash';
    this.preferredProvider = localStorage.getItem('vt_provider') ?? CONFIG.provider ?? 'mymemory';

    // Registro de fallbacks activos
    this.isUsingFallback = false;
  }

  /**
   * Obtiene la clave de API activa.
   */
  getApiKey() {
    return this.geminiApiKey;
  }

  /**
   * Actualiza la clave de Gemini en memoria y persistencia local.
   */
  setApiKey(newKey) {
    this.geminiApiKey = newKey.trim();
    localStorage.setItem('vt_gemini_key', this.geminiApiKey);
  }

  /**
   * Actualiza el modelo de Gemini.
   */
  setModel(newModel) {
    this.geminiModel = newModel;
    localStorage.setItem('vt_gemini_model', this.geminiModel);
  }

  /**
   * Actualiza el proveedor preferido ('gemini' o 'mymemory').
   */
  setProvider(provider) {
    this.preferredProvider = provider;
    localStorage.setItem('vt_provider', provider);
  }

  /**
   * Traduce un texto dado del idioma de origen al idioma de destino.
   * @param {string} text - Texto original a traducir.
   * @param {string} sourceLang - Código ISO del idioma fuente (ej: 'es').
   * @param {string} targetLang - Código ISO del idioma meta (ej: 'en').
   * @returns {Promise<{ translatedText: string, cleanedSource: string, providerUsed: string, isFallback: boolean }>}
   */
  async translate(text, sourceLang, targetLang) {
    if (!text || !text.trim()) {
      return { translatedText: '', cleanedSource: '', providerUsed: 'none', isFallback: false };
    }

    const cleanText = text.trim();

    // Si los idiomas son idénticos, no hace falta llamar a ninguna API
    if (sourceLang === targetLang) {
      const formatted = this._formatLocalSource(cleanText);
      return { translatedText: formatted, cleanedSource: formatted, providerUsed: 'direct', isFallback: false };
    }

    // Si el usuario configuró Gemini y tiene clave, intentar con Gemini
    if (this.preferredProvider === 'gemini' && this.geminiApiKey) {
      try {
        const { source, translation } = await this._translateWithGemini(cleanText, sourceLang, targetLang);
        this.isUsingFallback = false;
        return {
          translatedText: translation,
          cleanedSource: source,
          providerUsed: `Gemini (${this.geminiModel})`,
          isFallback: false
        };
      } catch (geminiError) {
        console.warn('Fallo en traducción con Gemini, activando fallback MyMemory:', geminiError);
        // Fallback automático a MyMemory
        const fallbackText = await this._translateWithMyMemory(cleanText, sourceLang, targetLang);
        this.isUsingFallback = true;
        return {
          translatedText: fallbackText,
          cleanedSource: this._formatLocalSource(cleanText),
          providerUsed: 'MyMemory (Fallback)',
          isFallback: true,
          originalError: geminiError.message
        };
      }
    }

    // Si no hay API Key o se seleccionó explícitamente MyMemory
    const translatedMyMemory = await this._translateWithMyMemory(cleanText, sourceLang, targetLang);
    this.isUsingFallback = !this.geminiApiKey;
    return {
      translatedText: translatedMyMemory,
      cleanedSource: this._formatLocalSource(cleanText),
      providerUsed: 'MyMemory (Demo)',
      isFallback: !this.geminiApiKey
    };
  }

  /**
   * Traduce utilizando la API REST de Gemini (Google AI Studio).
   * Devuelve JSON con 'source' limpia y 'translation' natural.
   * @private
   * @returns {Promise<{ source: string, translation: string }>}
   */
  async _translateWithGemini(text, sourceLang, targetLang) {
    const langNames = {
      es: 'Spanish', en: 'English', fr: 'French',
      pt: 'Portuguese', de: 'German', it: 'Italian',
      ja: 'Japanese', zh: 'Chinese'
    };

    const sourceName = langNames[sourceLang] || sourceLang;
    const targetName = langNames[targetLang] || targetLang;

    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${this.geminiModel}:generateContent?key=${this.geminiApiKey}`;

    const prompt = `You are an expert speech-to-text audio cleaner and translator.
You receive raw speech recognition transcript in ${sourceName}.

Tasks:
1. "source": Clean the speech transcript in ${sourceName}. Fix capitalization, punctuation, and remove speech repetitions, stutters, or transcription quirks. Fix obvious speech recognition transcription errors.
2. "translation": Translate naturally and fluently into ${targetName}.
   - Translate slang, colloquialisms, idioms, and regional expressions BY THEIR ACTUAL MEANING, never word-for-word literally (e.g., "mano" = bro/dude, "¿cómo se le ocurre?" = "how could you even think of that?", "a la orden" = "you're welcome / at your service", "parcero/pana" = buddy/pal).
   - Translate interjections and colloquial exclamations with their natural cultural equivalent (e.g., "a huevo" = "hell yeah / for sure / absolutely", "de una" = "right away / let's do it", "qué chimba / qué padre" = "that's awesome / so cool").
   - Use proper capitalization, punctuation, and natural spoken contractions (such as "I'm", "don't", "it's").

Output MUST be a valid JSON object with EXACTLY these two keys:
{"source": "cleaned original phrase", "translation": "natural translated phrase"}
Do NOT include any markdown formatting, backticks, or extra commentary. Respond ONLY with the JSON object.

Transcript:
${text}`;

    const payload = {
      contents: [
        {
          parts: [{ text: prompt }]
        }
      ],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 1024,
        responseMimeType: 'application/json'
      }
    };

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const message = errorData?.error?.message || `HTTP ${response.status}: ${response.statusText}`;
      throw new Error(message);
    }

    const data = await response.json();
    const candidate = data.candidates?.[0];
    const outputText = candidate?.content?.parts?.[0]?.text;

    if (!outputText) {
      throw new Error('Gemini no devolvió texto en la respuesta');
    }

    let parsed;
    try {
      const cleanedJsonStr = outputText.trim().replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```$/i, '').trim();
      parsed = JSON.parse(cleanedJsonStr);
    } catch (e) {
      const jsonMatch = outputText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('Gemini no devolvió un JSON válido');
      }
    }

    const cleanedSource = (parsed.source || text).trim();
    const translatedText = (parsed.translation || outputText).trim();

    return {
      source: cleanedSource,
      translation: translatedText
    };
  }

  /**
   * Traduce utilizando el servicio MyMemory como demostración / respaldo sin clave.
   * @private
   */
  async _translateWithMyMemory(text, sourceLang, targetLang) {
    const langPair = `${sourceLang}|${targetLang}`;
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${langPair}`;

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Error en el servicio MyMemory: HTTP ${response.status}`);
    }

    const data = await response.json();
    if (data.responseStatus !== 200 && data.responseStatus !== '200') {
      throw new Error(data.responseDetails || 'Error al traducir con MyMemory');
    }

    const raw = (data.responseData?.translatedText || '').trim();
    return this._postprocessMyMemory(raw);
  }

  /**
   * Posprocesado local de la traducción de MyMemory:
   * 1. Primera letra de cada oración en mayúscula.
   * 2. "i" suelta convertida en "I".
   * 3. Punto al final (si no termina en signo de puntuación).
   * @private
   */
  _postprocessMyMemory(text) {
    if (!text) return '';
    let result = text.trim();

    // 1. Primera letra de cada oración en mayúscula
    result = result.replace(/(^\s*|[.!?¡¿]\s+)([a-záéíóúàèìòùäëïöüñãõ])/giu, (match, prefix, char) => {
      return prefix + char.toUpperCase();
    });
    if (result.length > 0) {
      result = result.charAt(0).toUpperCase() + result.slice(1);
    }

    // 2. "i" suelta convertida en "I"
    result = result.replace(/\b(i)\b/g, 'I');

    // 3. Punto al final si no termina en puntuación
    if (!/[.!?…]$/.test(result)) {
      result += '.';
    }

    return result;
  }

  /**
   * Limpieza local básica de la frase de origen para modo MyMemory.
   * @private
   */
  _formatLocalSource(text) {
    if (!text) return '';
    let clean = text.trim();
    if (clean.length > 0) {
      clean = clean.charAt(0).toUpperCase() + clean.slice(1);
    }
    if (!/[.!?…]$/.test(clean)) {
      clean += '.';
    }
    return clean;
  }

  /**
   * Prueba la validez de la conexión y clave con Gemini.
   */
  async testConnection(testKey = null) {
    const originalKey = this.geminiApiKey;
    if (testKey !== null) {
      this.geminiApiKey = testKey.trim();
    }

    try {
      if (!this.geminiApiKey) {
        throw new Error('No se ha proporcionado ninguna clave API.');
      }
      const testResult = await this._translateWithGemini('Hola mundo', 'es', 'en');
      return { success: true, result: testResult.translation };
    } catch (err) {
      return { success: false, error: err.message };
    } finally {
      // Restaurar si solo estábamos probando
      if (testKey !== null) {
        this.geminiApiKey = originalKey;
      }
    }
  }
}

export const translationService = new TranslationService();
