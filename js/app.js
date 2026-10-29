/**
 * app.js
 * Orquestador principal de la aplicación VoiceTranslate.
 * Conecta el reconocimiento de voz, traducción con Gemini/MyMemory,
 * síntesis de voz, historial y la interfaz de usuario.
 */

import { CONFIG } from './configLoader.js';
import { speechRecognitionManager } from './speechRecognition.js';
import { speechSynthesisManager } from './speechSynthesis.js';
import { translationService } from './translation.js';
import { historyManager } from './history.js';
import { uiManager } from './ui.js';

class App {
  constructor() {
    this.currentConfirmedText = '';
    this.previousConfirmedText = '';
    this.currentInterimText = '';
    this.currentTranslatedText = '';
    this.translationTimeout = null;
    this.lastTranslatedSourceText = '';
    this.lastConfirmedRawPhrase = '';

    // Estado del Modo Conversación en Vivo
    this.isConversationMode = localStorage.getItem('vt_conv_mode') === 'true';
    this.ttsQueue = [];
    this.isSpeakingQueue = false;

    this._cacheDom();
    this._initApp();
  }

  /**
   * Referencias a elementos del DOM.
   * @private
   */
  _cacheDom() {
    // Selectores de idioma
    this.selectSource = document.getElementById('select-source-lang');
    this.selectTarget = document.getElementById('select-target-lang');
    this.btnSwapLangs = document.getElementById('btn-swap-langs');
    this.badgeSourceCode = document.getElementById('badge-source-code');
    this.badgeTargetCode = document.getElementById('badge-target-code');

    // Modo Conversación en Vivo
    this.toggleConvMode = document.getElementById('toggle-conversation-mode');
    this.badgeConvStatus = document.getElementById('badge-conv-status');
    this.bannerHeadphones = document.getElementById('banner-headphones');
    this.bannerHeadphonesMobile = document.getElementById('banner-headphones-mobile');

    // Detección de dispositivo móvil (táctil con pantalla pequeña)
    this.isMobile = ('ontouchstart' in window || navigator.maxTouchPoints > 0) && window.innerWidth <= 768;

    // Micrófono y controles de voz
    this.btnMic = document.getElementById('btn-mic');
    this.bannerBrowserSupport = document.getElementById('banner-browser-support');

    // Paneles de visualización
    this.transcriptionOutput = document.getElementById('transcription-output');
    this.translationOutput = document.getElementById('translation-output');
    this.btnClearCurrent = document.getElementById('btn-clear-current');
    this.btnCopyTranscription = document.getElementById('btn-copy-transcription');
    this.btnCopyTranslation = document.getElementById('btn-copy-translation');
    this.btnSpeakTranslation = document.getElementById('btn-speak-translation');

    // Historial
    this.historyList = document.getElementById('history-list');
    this.historyCount = document.getElementById('history-count');
    this.btnCopyAllHistory = document.getElementById('btn-copy-all-history');
    this.btnClearHistory = document.getElementById('btn-clear-history');

    // Header y Ajustes
    this.btnTheme = document.getElementById('btn-theme');
    this.btnSettings = document.getElementById('btn-settings');
    this.providerBadge = document.getElementById('provider-badge');

    // Modales
    this.modalSettings = document.getElementById('modal-settings');
    this.btnCloseSettings = document.getElementById('btn-close-settings');
    this.inputGeminiKey = document.getElementById('input-gemini-key');
    this.btnToggleKeyVisibility = document.getElementById('btn-toggle-key-visibility');
    this.selectGeminiModel = document.getElementById('select-gemini-model');
    this.selectProviderOverride = document.getElementById('select-provider-override');
    this.btnTestConnection = document.getElementById('btn-test-connection');
    this.btnSaveSettings = document.getElementById('btn-save-settings');
    this.testConnectionResult = document.getElementById('test-connection-result');

    this.modalMicError = document.getElementById('modal-mic-error');
    this.btnCloseMicError = document.getElementById('btn-close-mic-error');
    this.btnRetryMic = document.getElementById('btn-retry-mic');
  }

  /**
   * Inicialización de la aplicación.
   * @private
   */
  _initApp() {
    // 1. Validar soporte de SpeechRecognition en el navegador:
    // Solo mostrar el aviso si NO existen ni window.SpeechRecognition ni window.webkitSpeechRecognition
    const hasSpeechSupport = Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);
    if (!hasSpeechSupport) {
      if (this.bannerBrowserSupport) {
        this.bannerBrowserSupport.hidden = false;
      }
    } else {
      if (this.bannerBrowserSupport) {
        this.bannerBrowserSupport.hidden = true;
      }
    }

    // 2. Configurar idioma inicial de reconocimiento
    this._updateSpeechRecognitionLanguage();
    this._updateLanguageBadges();

    // 3. Configurar estado del proveedor
    this._updateInitialProviderBadge();

    // 4. Configurar estado de Modo Conversación en Vivo
    this._initConversationModeUi();

    // 5. Renderizar historial existente
    this._renderHistory();

    // 6. Vincular eventos de usuario
    this._bindEvents();
    this._setupSpeechRecognitionCallbacks();
  }

  /**
   * Vincula los controladores de eventos a los elementos del DOM.
   * @private
   */
  _bindEvents() {
    // Tema claro / oscuro
    this.btnTheme?.addEventListener('click', () => {
      uiManager.toggleTheme();
    });

    // Toggle de Modo Conversación en Vivo
    this.toggleConvMode?.addEventListener('change', (e) => {
      this.isConversationMode = e.target.checked;
      localStorage.setItem('vt_conv_mode', this.isConversationMode);
      this._updateConversationModeUi();

      if (this.isConversationMode) {
        uiManager.showToast('Modo conversación activado. Traduciendo y hablando automáticamente.', 'info', 3000);
      } else {
        // Al apagar, limpiar cola de síntesis y normalizar
        this.ttsQueue = [];
        this.isSpeakingQueue = false;
        speechSynthesisManager.stop();
        speechRecognitionManager.resumeListening();
        uiManager.showToast('Modo conversación desactivado.', 'info', 2000);
      }
    });

    // Cambio de idiomas
    this.selectSource?.addEventListener('change', () => {
      this._updateSpeechRecognitionLanguage();
      this._updateLanguageBadges();
      this._retranslateCurrentSession();
    });

    this.selectTarget?.addEventListener('change', () => {
      this._updateLanguageBadges();
      this._retranslateCurrentSession();
    });

    // Botón de intercambiar idiomas
    this.btnSwapLangs?.addEventListener('click', () => {
      this._swapLanguages();
    });

    // Botón de micrófono
    this.btnMic?.addEventListener('click', () => {
      // Desbloquear contexto de audio iOS en el primer gesto del usuario
      speechSynthesisManager.unlockAudio();
      this._handleMicToggle();
    });

    // Limpiar pantalla actual
    this.btnClearCurrent?.addEventListener('click', () => {
      this._clearCurrentOutputs();
    });

    // Copiar transcripción
    this.btnCopyTranscription?.addEventListener('click', () => {
      const textToCopy = this.currentConfirmedText || this.currentInterimText || this.previousConfirmedText;
      uiManager.copyTextWithFeedback(textToCopy, this.btnCopyTranscription);
    });

    // Copiar traducción
    this.btnCopyTranslation?.addEventListener('click', () => {
      uiManager.copyTextWithFeedback(this.currentTranslatedText, this.btnCopyTranslation);
    });

    // Escuchar traducción (TTS)
    this.btnSpeakTranslation?.addEventListener('click', () => {
      this._speakCurrentTranslation();
    });

    // Acciones de Historial
    this.btnCopyAllHistory?.addEventListener('click', () => {
      const allText = historyManager.getFormattedHistoryText();
      uiManager.copyTextWithFeedback(allText, this.btnCopyAllHistory, 'Copiar todo');
    });

    this.btnClearHistory?.addEventListener('click', () => {
      if (confirm('¿Estás seguro de que deseas borrar todo el historial de la sesión?')) {
        historyManager.clearAll();
        this._renderHistory();
        uiManager.showToast('Historial eliminado.', 'info');
      }
    });

    // Modal de ajustes
    this.btnSettings?.addEventListener('click', () => this._openSettingsModal());
    this.providerBadge?.addEventListener('click', () => this._openSettingsModal());
    this.btnCloseSettings?.addEventListener('click', () => this._closeSettingsModal());
    this.modalSettings?.addEventListener('click', (e) => {
      if (e.target === this.modalSettings) this._closeSettingsModal();
    });

    // Visibilidad de contraseña
    this.btnToggleKeyVisibility?.addEventListener('click', () => {
      const isPassword = this.inputGeminiKey.type === 'password';
      this.inputGeminiKey.type = isPassword ? 'text' : 'password';
      this.btnToggleKeyVisibility.textContent = isPassword ? '🔒' : '👁️';
    });

    // Guardar ajustes
    this.btnSaveSettings?.addEventListener('click', () => this._saveSettings());

    // Probar conexión de API
    this.btnTestConnection?.addEventListener('click', () => this._testApiConnection());

    // Modal de error de micrófono
    this.btnCloseMicError?.addEventListener('click', () => this.modalMicError.close());
    this.btnRetryMic?.addEventListener('click', () => {
      this.modalMicError.close();
      this._handleMicToggle();
    });
  }

  /**
   * Configura las respuestas a los eventos del reconocedor de voz.
   * @private
   */
  _setupSpeechRecognitionCallbacks() {
    speechRecognitionManager.onStartCallback = () => {
      uiManager.setMicState('recording');
      uiManager.showToast('Micrófono activado. Habla con claridad.', 'info', 2000);
    };

    speechRecognitionManager.onResultCallback = async ({ interim, final }) => {
      // Ignorar cualquier resultado que llegue mientras se reproduce audio o en enfriamiento
      if (this.isSpeakingQueue || speechRecognitionManager.isPausedForAudio || speechRecognitionManager.isMutedForPlayback) {
        return;
      }

      // Si empieza a llegar nuevo texto provisional y ya teníamos una frase confirmada,
      // la pasamos a previa (atenuada) y limpiamos el panel activo para la nueva frase
      if (interim && this.currentConfirmedText) {
        this.previousConfirmedText = this.currentConfirmedText;
        this.currentConfirmedText = '';
      }

      this.currentInterimText = interim || '';
      this._renderTranscription();

      // Si llegó una frase final confirmada, traducirla de forma aislada e inmediata
      if (final && final.trim()) {
        await this._translateConfirmedPhrase(final.trim());
      }
    };

    speechRecognitionManager.onErrorCallback = (errorType) => {
      if (errorType === 'not-allowed' || errorType === 'service-not-allowed') {
        uiManager.setMicState('idle');
        this.modalMicError?.showModal();
        uiManager.showToast('Acceso al micrófono denegado. Concede permisos para usar la aplicación.', 'error', 5000);
      } else if (errorType === 'network') {
        uiManager.setMicState('idle');
        uiManager.showToast('Error de red en el reconocimiento de voz. En navegadores como Brave el servicio de Google suele estar bloqueado por defecto. Te sugerimos usar Google Chrome o Microsoft Edge.', 'warning', 7000);
      } else {
        uiManager.showToast(`Aviso del micrófono: ${errorType}`, 'warning', 4000);
      }
    };

    speechRecognitionManager.onEndCallback = () => {
      if (!speechRecognitionManager.shouldKeepListening) {
        uiManager.setMicState('idle');
      }
    };
  }

  /**
   * Inicia o detiene la escucha del micrófono.
   * @private
   */
  _handleMicToggle() {
    if (!speechRecognitionManager.isSupported) {
      uiManager.showToast('Tu navegador no soporta reconocimiento de voz continuo.', 'error');
      return;
    }

    if (speechRecognitionManager.isListening || speechRecognitionManager.isPausedForAudio) {
      speechRecognitionManager.stop();
      this.ttsQueue = [];
      this.isSpeakingQueue = false;
      speechSynthesisManager.stop();
      uiManager.setMicState('idle');

      // Si queda texto interino pendiente al detener el micrófono, confirmarlo y traducirlo
      if (this.currentInterimText && this.currentInterimText.trim()) {
        const pending = this.currentInterimText.trim();
        this.currentInterimText = '';
        this._renderTranscription();
        this._translateConfirmedPhrase(pending);
      }
    } else {
      // Detener cualquier reproducción previa de TTS para no auto-escuchar
      speechSynthesisManager.stop();
      this.ttsQueue = [];
      this.isSpeakingQueue = false;
      speechRecognitionManager.start();
    }
  }

  /**
   * Intercambia los idiomas de origen y destino.
   * @private
   */
  _swapLanguages() {
    const prevSource = this.selectSource.value;
    const prevTarget = this.selectTarget.value;

    this.selectSource.value = prevTarget;
    this.selectTarget.value = prevSource;

    this._updateSpeechRecognitionLanguage();
    this._updateLanguageBadges();

    // Intercambiar contenidos en pantalla si existen
    if (this.currentTranslatedText) {
      const tempText = this.currentConfirmedText || this.currentInterimText;
      this.currentConfirmedText = this.currentTranslatedText;
      this.previousConfirmedText = '';
      this.currentInterimText = '';
      this.currentTranslatedText = tempText;
      this.lastTranslatedSourceText = this.currentConfirmedText;

      this._renderTranscription();
      this._renderTranslation(this.currentTranslatedText);
      uiManager.showToast('Idiomas y textos intercambiados', 'info', 1800);
    } else {
      uiManager.showToast('Idiomas intercambiados', 'info', 1800);
    }
  }

  /**
   * Actualiza el idioma en el motor de reconocimiento según el select.
   * @private
   */
  _updateSpeechRecognitionLanguage() {
    const selectedOption = this.selectSource.options[this.selectSource.selectedIndex];
    const speechCode = selectedOption?.dataset.speech || 'es-CO';
    speechRecognitionManager.setLanguage(speechCode);
  }

  /**
   * Actualiza los distintivos visuales (ES, EN, etc.).
   * @private
   */
  _updateLanguageBadges() {
    if (this.badgeSourceCode) {
      this.badgeSourceCode.textContent = this.selectSource.value.toUpperCase();
    }
    if (this.badgeTargetCode) {
      this.badgeTargetCode.textContent = this.selectTarget.value.toUpperCase();
    }
  }

  /**
   * Renderiza el texto de transcripción (frase previa atenuada + frase actual + interino).
   * @private
   */
  _renderTranscription() {
    if (!this.transcriptionOutput) return;

    if (!this.currentConfirmedText && !this.currentInterimText && !this.previousConfirmedText) {
      this.transcriptionOutput.innerHTML = `<span class="placeholder-text">Empieza a hablar para ver la transcripción en vivo...</span>`;
      return;
    }

    let html = '';
    // 1. Frase anterior en tono atenuado
    if (this.previousConfirmedText) {
      html += `<div class="previous-text" title="Frase anterior">${this._escapeHtml(this.previousConfirmedText)}</div>`;
    }

    // 2. Frase actual confirmada
    if (this.currentConfirmedText) {
      html += `<span class="confirmed-text">${this._escapeHtml(this.currentConfirmedText)}</span>`;
    }

    // 3. Frase en progreso (interim)
    if (this.currentInterimText) {
      if (this.currentConfirmedText) html += ' ';
      html += `<span class="interim-text">${this._escapeHtml(this.currentInterimText)}</span>`;
    }

    this.transcriptionOutput.innerHTML = html;
  }

  /**
   * Renderiza el texto de traducción con tipografía amplia.
   * @private
   */
  _renderTranslation(translatedText) {
    if (!this.translationOutput) return;

    if (!translatedText) {
      this.translationOutput.innerHTML = `<span class="placeholder-text">La traducción aparecerá aquí automáticamente...</span>`;
      return;
    }

    this.translationOutput.textContent = translatedText;
  }

  /**
  /**
   * Normaliza una cadena de texto para comparaciones robustas (elimina mayúsculas, puntuación y espacios redundantes).
   * @private
   */
  _normalizeText(text) {
    return (text || '')
      .toLowerCase()
      .trim()
      .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()¿?¡!"'«»]/g, '')
      .replace(/\s+/g, ' ');
  }

  /**
   * Traduce una frase confirmada (isFinal).
   * Obtiene la frase limpia y la traducción natural de Gemini (o MyMemory),
   * muestra la frase limpia en "Voz detectada", acumula la traducción,
   * guarda la frase limpia en el historial y reproduce en TTS en modo conversación.
   * @param {string} rawPhrase - Frase confirmada a traducir.
   * @private
   */
  async _translateConfirmedPhrase(rawPhrase) {
    if (!rawPhrase || !rawPhrase.trim()) return;

    const trimmedPhrase = rawPhrase.trim();

    // Descartar duplicados consecutivos de la misma frase confirmada
    const norm = this._normalizeText(trimmedPhrase);
    if (norm === this._normalizeText(this.lastConfirmedRawPhrase)) {
      return;
    }
    this.lastConfirmedRawPhrase = trimmedPhrase;

    const sourceLang = this.selectSource.value;
    const targetLang = this.selectTarget.value;
    const targetOption = this.selectTarget.options[this.selectTarget.selectedIndex];
    const targetSpeechCode = targetOption?.dataset.speech || 'en-US';

    uiManager.setTranslationLoading(true);

    try {
      const result = await translationService.translate(trimmedPhrase, sourceLang, targetLang);
      
      const cleanSource = result.cleanedSource || trimmedPhrase;
      const translated = result.translatedText;

      // 1. Mostrar únicamente la frase actual en "Voz detectada" (moviendo la anterior a previa atenuada)
      if (this.currentConfirmedText && this.currentConfirmedText !== cleanSource) {
        this.previousConfirmedText = this.currentConfirmedText;
      }
      this.currentConfirmedText = cleanSource;
      this.currentInterimText = '';
      this._renderTranscription();

      // 2. Mostrar únicamente la traducción de la frase actual en "Traducción"
      this.currentTranslatedText = translated;
      this._renderTranslation(this.currentTranslatedText);

      // 3. Actualizar distintivo del proveedor activo
      uiManager.updateProviderBadge(result.providerUsed, result.isFallback);

      // 4. Guardar la frase limpia en el historial
      historyManager.addItem({
        sourceLang,
        targetLang,
        targetSpeechCode,
        originalText: cleanSource,
        translatedText: translated
      });
      this._renderHistory();

      // 5. En Modo Conversación en Vivo, reproducir únicamente la nueva frase traducida
      if (this.isConversationMode && translated) {
        this._enqueueTtsPhrase(translated, targetSpeechCode);
      }

    } catch (err) {
      console.error('Error al traducir frase confirmada:', err);
      uiManager.showToast(`Error al traducir: ${err.message}`, 'error');
    } finally {
      uiManager.setTranslationLoading(false);
    }
  }

  /**
   * Retraduce la sesión actual si el usuario cambia el selector de idioma.
   * @private
   */
  async _retranslateCurrentSession() {
    if (!this.currentConfirmedText || !this.currentConfirmedText.trim()) return;

    const sourceLang = this.selectSource.value;
    const targetLang = this.selectTarget.value;

    uiManager.setTranslationLoading(true);

    try {
      const result = await translationService.translate(this.currentConfirmedText, sourceLang, targetLang);
      this.currentTranslatedText = result.translatedText;
      this._renderTranslation(this.currentTranslatedText);
      uiManager.updateProviderBadge(result.providerUsed, result.isFallback);
    } catch (err) {
      console.warn('Aviso al retraducir tras cambio de idioma:', err);
    } finally {
      uiManager.setTranslationLoading(false);
    }
  }

  /**
   * Inicializa la interfaz del Modo Conversación en Vivo según el almacenamiento.
   * @private
   */
  _initConversationModeUi() {
    if (this.toggleConvMode) {
      this.toggleConvMode.checked = this.isConversationMode;
    }
    this._updateConversationModeUi();
  }

  /**
   * Actualiza los elementos visuales del Modo Conversación (badge y banner de audífonos).
   * @private
   */
  _updateConversationModeUi() {
    if (this.badgeConvStatus) {
      this.badgeConvStatus.textContent = this.isConversationMode ? 'ON' : 'OFF';
      this.badgeConvStatus.className = `badge-status-pill ${this.isConversationMode ? 'on' : 'off'}`;
    }
    if (this.bannerHeadphones) {
      this.bannerHeadphones.hidden = !this.isConversationMode;
    }
    // El banner móvil fuerte solo aparece en dispositivos táctiles pequeños
    if (this.bannerHeadphonesMobile) {
      this.bannerHeadphonesMobile.hidden = !(this.isConversationMode && this.isMobile);
    }
  }

  /**
   * Pone en cola una frase traducida para reproducirse en voz alta evitando duplicados.
   * @private
   */
  _enqueueTtsPhrase(text, langCode) {
    if (!text || !text.trim()) return;

    const trimmed = text.trim();
    const normText = this._normalizeText(trimmed);

    // Evitar encolar la misma frase si acaba de ser hablada o si ya está en cola
    if (this.lastSpokenText && this._normalizeText(this.lastSpokenText) === normText) {
      return;
    }
    if (this.ttsQueue.length > 0 && this._normalizeText(this.ttsQueue[this.ttsQueue.length - 1].text) === normText) {
      return;
    }

    this.ttsQueue.push({ text: trimmed, langCode });
    this._processTtsQueue();
  }

  /**
   * Procesa la cola de audio secuencialmente, pausando el micrófono mientras habla
   * y reanudándolo exactamente 400ms después para evitar bucles de retroalimentación.
   * @private
   */
  _processTtsQueue() {
    if (this.isSpeakingQueue || this.ttsQueue.length === 0) {
      return;
    }

    const item = this.ttsQueue.shift();
    if (!item) return;

    this.isSpeakingQueue = true;
    this.lastSpokenText = item.text;

    // 1. Pausar inmediatamente el reconocimiento de voz para que no capte los altavoces
    speechRecognitionManager.pauseListening();

    const statusText = document.getElementById('mic-status-text');
    if (statusText) {
      statusText.textContent = 'Modo conversación: Reproduciendo respuesta... 🎧';
      statusText.className = 'mic-status-text playing-tts';
    }

    const btn = this.btnSpeakTranslation;
    btn?.classList.add('is-speaking');

    // 2. Reproducir la frase por síntesis de voz
    speechSynthesisManager.speak(item.text, item.langCode, {
      onStart: () => {
        btn?.classList.add('is-speaking');
      },
      onEnd: () => {
        btn?.classList.remove('is-speaking');
        // Margen exacto de 400ms después de que termine para amortiguar cualquier eco residual
        setTimeout(() => {
          this.isSpeakingQueue = false;
          if (this.ttsQueue.length > 0) {
            this._processTtsQueue();
          } else {
            // Reanudar reconocimiento si la cola terminó
            speechRecognitionManager.resumeListening(400);
            if (speechRecognitionManager.shouldKeepListening) {
              uiManager.setMicState('recording');
            } else {
              uiManager.setMicState('idle');
            }
          }
        }, 400);
      },
      onError: (err) => {
        btn?.classList.remove('is-speaking');
        setTimeout(() => {
          this.isSpeakingQueue = false;
          speechRecognitionManager.resumeListening(400);
          if (speechRecognitionManager.shouldKeepListening) {
            uiManager.setMicState('recording');
          } else {
            uiManager.setMicState('idle');
          }
          if (this.ttsQueue.length > 0) {
            this._processTtsQueue();
          }
        }, 400);
      }
    });
  }

  /**
   * Reproduce la traducción actual en voz alta usando speechSynthesis.
   * @private
   */
  _speakCurrentTranslation() {
    if (!this.currentTranslatedText) {
      uiManager.showToast('No hay ninguna traducción para reproducir.', 'warning');
      return;
    }

    const targetOption = this.selectTarget.options[this.selectTarget.selectedIndex];
    const targetSpeechCode = targetOption?.dataset.speech || 'en-US';

    const btn = this.btnSpeakTranslation;
    const btnSpan = btn?.querySelector('span');

    speechSynthesisManager.speak(this.currentTranslatedText, targetSpeechCode, {
      onStart: () => {
        if (btnSpan) btnSpan.textContent = 'Reproduciendo...';
        btn?.classList.add('is-speaking');
      },
      onEnd: () => {
        if (btnSpan) btnSpan.textContent = 'Escuchar';
        btn?.classList.remove('is-speaking');
      },
      onError: (err) => {
        if (btnSpan) btnSpan.textContent = 'Escuchar';
        btn?.classList.remove('is-speaking');
        uiManager.showToast('No se pudo reproducir la voz.', 'warning');
      }
    });
  }

  /**
   * Limpia los contenedores de texto actuales.
   * @private
   */
  _clearCurrentOutputs() {
    this.currentConfirmedText = '';
    this.previousConfirmedText = '';
    this.currentInterimText = '';
    this.currentTranslatedText = '';
    this.lastTranslatedSourceText = '';
    this.lastConfirmedRawPhrase = '';
    this._renderTranscription();
    this._renderTranslation('');
    uiManager.showToast('Pantalla limpiada.', 'info', 1500);
  }

  /**
   * Renderiza el historial con sus respectivos manejadores.
   * @private
   */
  _renderHistory() {
    historyManager.render(
      this.historyList,
      this.historyCount,
      this.btnClearHistory,
      this.btnCopyAllHistory,
      {
        onSpeak: (text, speechCode) => {
          speechSynthesisManager.speak(text, speechCode);
        },
        onCopy: (text, buttonEl) => {
          uiManager.copyTextWithFeedback(text, buttonEl);
        },
        onDelete: (id) => {
          historyManager.deleteItem(id);
          this._renderHistory();
        }
      }
    );
  }

  /**
   * Actualiza el badge del proveedor al iniciar.
   * @private
   */
  _updateInitialProviderBadge() {
    const hasKey = Boolean(translationService.getApiKey());
    const provider = translationService.preferredProvider;

    if (provider === 'gemini' && hasKey) {
      uiManager.updateProviderBadge(`Gemini (${translationService.geminiModel})`, false);
    } else {
      uiManager.updateProviderBadge('MyMemory (Demo)', true);
    }
  }

  /**
   * Abre el modal de configuración de la API.
   * @private
   */
  _openSettingsModal() {
    if (!this.modalSettings) return;

    this.inputGeminiKey.value = translationService.getApiKey();
    this.selectGeminiModel.value = translationService.geminiModel;
    this.selectProviderOverride.value = translationService.preferredProvider;
    this.testConnectionResult.hidden = true;

    this.modalSettings.showModal();
  }

  /**
   * Cierra el modal de configuración.
   * @private
   */
  _closeSettingsModal() {
    if (this.modalSettings) {
      this.modalSettings.close();
    }
  }

  /**
   * Guarda los ajustes modificados por el usuario.
   * @private
   */
  _saveSettings() {
    const key = this.inputGeminiKey.value.trim();
    const model = this.selectGeminiModel.value;
    const provider = this.selectProviderOverride.value;

    translationService.setApiKey(key);
    translationService.setModel(model);
    translationService.setProvider(provider);

    this._updateInitialProviderBadge();
    this._closeSettingsModal();

    uiManager.showToast('Configuración guardada correctamente.', 'success');
  }

  /**
   * Prueba la clave de la API ingresada en el modal de ajustes.
   * @private
   */
  async _testApiConnection() {
    const testKey = this.inputGeminiKey.value.trim();
    const resultBox = this.testConnectionResult;
    resultBox.hidden = false;
    resultBox.className = 'test-result';
    resultBox.textContent = 'Probando conexión con Gemini Flash...';

    if (!testKey) {
      resultBox.className = 'test-result error';
      resultBox.textContent = 'Por favor escribe tu API Key antes de probar.';
      return;
    }

    const res = await translationService.testConnection(testKey);

    if (res.success) {
      resultBox.className = 'test-result success';
      resultBox.textContent = `✓ Conexión exitosa. Prueba ("Hola mundo" -> "${res.result}")`;
    } else {
      resultBox.className = 'test-result error';
      resultBox.textContent = `✕ Error al conectar: ${res.error}`;
    }
  }

  /**
   * Sanitización básica para textos.
   * @private
   */
  _escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
}

// Inicializar la aplicación cuando el DOM esté listo
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => new App());
} else {
  new App();
}

// Registro del Service Worker para PWA (instalación en pantalla de inicio)
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js')
      .then((reg) => {
        console.log('[SW] Registrado correctamente. Scope:', reg.scope);
      })
      .catch((err) => {
        console.warn('[SW] Falló el registro:', err);
      });
  });
}
