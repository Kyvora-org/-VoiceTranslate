/**
 * speechRecognition.js
 * Módulo de reconocimiento de voz utilizando la Web Speech API.
 * Gestiona el flujo continuo, resultados provisionales y reconexión automática.
 */

class SpeechRecognitionManager {
  constructor() {
    // Detección de la API en navegadores basados en Chromium / WebKit / Estándar
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    this.isSupported = Boolean(SpeechRecognition);

    // Detección de iOS/Safari para manejar reconexiones más agresivas
    this.isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
    this.isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);

    this.recognition = null;
    this.isListening = false;
    this.shouldKeepListening = false;
    this.isPausedForAudio = false; // Bandera para pausar mientras suena el TTS
    this.isMutedForPlayback = false; // Descarte estricto de audio durante reproducción
    this.muteCooldownUntil = 0; // Marca de tiempo del margen de seguridad (400ms)
    this.resumeTimer = null;
    this.restartTimer = null; // Timer específico para reconexión iOS/WebKit
    this.currentLanguage = 'es-CO';

    // Callbacks para interacción con la interfaz
    this.onStartCallback = null;
    this.onResultCallback = null;
    this.onErrorCallback = null;
    this.onEndCallback = null;

    if (this.isSupported) {
      this._initRecognition(SpeechRecognition);
    }
  }

  /**
   * Inicializa la instancia del reconocedor con parámetros óptimos.
   * @private
   */
  _initRecognition(SpeechRecognitionClass) {
    this.recognition = new SpeechRecognitionClass();
    this.recognition.continuous = true;
    this.recognition.interimResults = true;
    this.recognition.maxAlternatives = 1;
    this.recognition.lang = this.currentLanguage;

    this.recognition.onstart = () => {
      this.isListening = true;
      if (typeof this.onStartCallback === 'function') {
        this.onStartCallback();
      }
    };

    this.recognition.onresult = (event) => {
      // Ignorar estrictamente cualquier resultado que llegue mientras se reproduce audio o en el margen de enfriamiento
      if (this.isMutedForPlayback || this.isPausedForAudio || Date.now() < this.muteCooldownUntil) {
        return;
      }

      let interimTranscript = '';
      let finalTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        const item = event.results[i];
        if (!item || !item[0]) continue;
        const transcript = item[0].transcript;
        if (item.isFinal) {
          finalTranscript += (finalTranscript ? ' ' : '') + transcript.trim();
        } else {
          interimTranscript += transcript;
        }
      }

      if (typeof this.onResultCallback === 'function') {
        this.onResultCallback({
          interim: interimTranscript,
          final: finalTranscript
        });
      }
    };

    this.recognition.onerror = (event) => {
      console.warn('Evento de error en SpeechRecognition:', event.error);
      
      // El error 'no-speech' es normal cuando hay silencio prolongado
      if (event.error === 'no-speech') {
        return;
      }

      // Si el navegador no soporta es-CO, fallback a es-419 y luego a es-ES
      if (event.error === 'language-not-supported') {
        if (this.currentLanguage === 'es-CO') {
          console.warn('es-CO no soportado en este navegador, reintentando con es-419...');
          this.setLanguage('es-419');
          return;
        } else if (this.currentLanguage === 'es-419') {
          console.warn('es-419 no soportado en este navegador, reintentando con es-ES...');
          this.setLanguage('es-ES');
          return;
        }
      }

      if (typeof this.onErrorCallback === 'function') {
        this.onErrorCallback(event.error, event);
      }
    };

    this.recognition.onend = () => {
      this.isListening = false;

      // Si fue pausado intencionalmente por TTS, no reanudar aún
      if (this.isPausedForAudio) {
        return;
      }

      // Si el usuario no ha presionado detener y ocurrió una pausa automática, reconectar
      if (this.shouldKeepListening) {
        clearTimeout(this.restartTimer);
        // iOS/Safari/WebKit cae frecuentemente tras silencios: usar delay para evitar
        // el error "InvalidStateError: recognition has already started"
        const delay = (this.isIOS || this.isSafari) ? 300 : 50;
        this.restartTimer = setTimeout(() => {
          if (this.shouldKeepListening && !this.isListening && !this.isPausedForAudio) {
            try {
              this.recognition.start();
            } catch (e) {
              console.warn('Reintento de inicio de escucha (iOS/WebKit):', e.message);
            }
          }
        }, delay);
        return;
      }

      if (typeof this.onEndCallback === 'function') {
        this.onEndCallback();
      }
    };

  }

  /**
   * Configura el código de idioma para el reconocimiento (ej: 'es-ES', 'en-US').
   */
  setLanguage(langCode) {
    this.currentLanguage = langCode;
    if (this.recognition) {
      this.recognition.lang = langCode;
      // Si está activo escuchando, reiniciar con el nuevo idioma
      if (this.isListening) {
        this.stop();
        setTimeout(() => this.start(), 200);
      }
    }
  }

  /**
   * Inicia el reconocimiento de voz.
   */
  start() {
    if (!this.isSupported) {
      throw new Error('Navegador incompatible con Web Speech API');
    }

    if (this.isListening) return;

    this.shouldKeepListening = true;
    this.isPausedForAudio = false;
    try {
      this.recognition.start();
    } catch (err) {
      console.warn('Aviso al iniciar reconocimiento:', err.message);
    }
  }

  /**
   * Detiene el reconocimiento de voz por orden del usuario.
   */
  stop() {
    this.shouldKeepListening = false;
    this.isPausedForAudio = false;
    this.isMutedForPlayback = false;
    clearTimeout(this.resumeTimer);
    clearTimeout(this.restartTimer);
    if (this.recognition && this.isListening) {
      try {
        this.recognition.stop();
      } catch (err) {
        console.warn('Aviso al detener reconocimiento:', err.message);
      }
    }
    this.isListening = false;
  }

  /**
   * Pausa inmediatamente el reconocimiento de voz y silencia capturas durante TTS.
   */
  pauseListening() {
    this.isPausedForAudio = true;
    this.isMutedForPlayback = true;
    clearTimeout(this.resumeTimer);
    if (this.recognition && this.isListening) {
      try {
        // abort() interrumpe y descarta de inmediato cualquier fragmento de audio en proceso
        this.recognition.abort();
      } catch (err) {
        console.warn('Aviso al abortar escucha para TTS:', err.message);
      }
      this.isListening = false;
    }
  }

  /**
   * Reanuda el reconocimiento una vez finalizada la reproducción de audio tras el enfriamiento.
   * @param {number} delayMs - Tiempo de espera en milisegundos (por defecto 400ms).
   */
  resumeListening(delayMs = 400) {
    this.isPausedForAudio = false;
    this.muteCooldownUntil = Date.now() + delayMs;
    clearTimeout(this.resumeTimer);

    this.resumeTimer = setTimeout(() => {
      this.isMutedForPlayback = false;
      if (this.shouldKeepListening && !this.isListening && this.recognition) {
        try {
          this.recognition.start();
        } catch (err) {
          console.warn('Aviso al reanudar escucha tras audio:', err.message);
        }
      }
    }, delayMs);
  }

  /**
   * Alterna entre iniciar y detener.
   */
  toggle() {
    if (this.isListening) {
      this.stop();
    } else {
      this.start();
    }
  }
}

export const speechRecognitionManager = new SpeechRecognitionManager();
