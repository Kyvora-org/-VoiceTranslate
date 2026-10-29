/**
 * speechSynthesis.js
 * Módulo de síntesis de voz (Text-to-Speech) usando la Web Speech API nativa.
 * Selecciona dinámicamente la mejor voz según el idioma objetivo.
 */

class SpeechSynthesisManager {
  constructor() {
    this.synth = window.speechSynthesis;
    this.isSupported = Boolean(this.synth);
    this.voices = [];
    this.isSpeaking = false;
    this.isUnlocked = false; // iOS Safari necesita desbloqueo en el primer gesto del usuario

    if (this.isSupported) {
      this._loadVoices();
      if (this.synth.onvoiceschanged !== undefined) {
        this.synth.onvoiceschanged = () => this._loadVoices();
      }
    }
  }

  /**
   * Desbloquea el contexto de audio de iOS Safari mediante un gesto del usuario.
   * Debe llamarse en el primer click/touch del botón micrófono.
   */
  unlockAudio() {
    if (!this.isSupported || this.isUnlocked) return;
    const silentUtterance = new SpeechSynthesisUtterance('\u200b'); // carácter de ancho cero
    silentUtterance.volume = 0.01;
    silentUtterance.rate = 16; // rapidísimo para que sea imperceptible
    silentUtterance.onend = () => { this.isUnlocked = true; };
    silentUtterance.onerror = () => { this.isUnlocked = true; }; // marcar igualmente para no reintentar
    this.synth.speak(silentUtterance);
  }

  /**
   * Carga la lista de voces disponibles en el sistema operativo.
   * @private
   */
  _loadVoices() {
    this.voices = this.synth.getVoices();
  }

  /**
   * Encuentra la mejor voz disponible para un código de idioma.
   * @param {string} langCode - Código de idioma (ej: 'es-ES' o 'es').
   * @returns {SpeechSynthesisVoice|null}
   */
  getBestVoice(langCode) {
    if (!this.voices.length) {
      this._loadVoices();
    }

    const normalizedLang = langCode.toLowerCase().replace('_', '-');
    const langPrefix = normalizedLang.split('-')[0];

    // 1. Coincidencia exacta (ej: 'es-ES')
    let match = this.voices.find(voice => voice.lang.toLowerCase() === normalizedLang);

    // 2. Coincidencia por prefijo (ej: cualquier voz en 'es')
    if (!match) {
      match = this.voices.find(voice => voice.lang.toLowerCase().startsWith(langPrefix));
    }

    return match || null;
  }

  /**
   * Reproduce el texto en voz alta.
   * @param {string} text - Texto a pronunciar.
   * @param {string} langCode - Código de idioma (ej: 'en-US').
   * @param {Object} options - Parámetros de voz (rate, pitch, volume, callbacks).
   */
  speak(text, langCode, { onStart, onEnd, onError, rate = 1.0, pitch = 1.0 } = {}) {
    if (!this.isSupported || !text || !text.trim()) {
      return;
    }

    // Cancelar cualquier locución anterior activa
    this.stop();

    const utterance = new SpeechSynthesisUtterance(text.trim());
    utterance.lang = langCode;
    utterance.rate = rate;
    utterance.pitch = pitch;

    const voice = this.getBestVoice(langCode);
    if (voice) {
      utterance.voice = voice;
    }

    utterance.onstart = () => {
      this.isSpeaking = true;
      if (typeof onStart === 'function') onStart();
    };

    utterance.onend = () => {
      this.isSpeaking = false;
      if (typeof onEnd === 'function') onEnd();
    };

    utterance.onerror = (event) => {
      this.isSpeaking = false;
      // 'interrupted' o 'canceled' no se tratan como errores fatales
      if (event.error !== 'interrupted' && event.error !== 'canceled') {
        console.warn('Error en síntesis de voz:', event.error);
        if (typeof onError === 'function') onError(event.error);
      }
    };

    this.synth.speak(utterance);
  }

  /**
   * Detiene la reproducción actual.
   */
  stop() {
    if (this.isSupported && this.synth.speaking) {
      this.synth.cancel();
      this.isSpeaking = false;
    }
  }
}

export const speechSynthesisManager = new SpeechSynthesisManager();
