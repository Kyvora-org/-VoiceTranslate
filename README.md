# 🎙️ VoiceTranslate - Traductor de Voz en Tiempo Real

**VoiceTranslate** es una aplicación web moderna y minimalista que transcribe lo que hablas en tiempo real y lo traduce de inmediato al idioma de tu elección, con soporte de síntesis de voz (Text-to-Speech) para escuchar la traducción y un historial persistente de la sesión.

---

## ✨ Características

- 🗣️ **Transcripción de voz en vivo:** Utiliza la **Web Speech API** nativa (`SpeechRecognition`) para capturar tu voz de manera continua, mostrando texto provisional en cursiva y confirmando frases finales automáticamente.
- ⚡ **Traducción ultra rápida:**
  - **Proveedor Principal:** Modelo **Gemini Flash** (por ejemplo `gemini-2.5-flash`) a través de la API de Google AI Studio, ofreciendo traducciones naturales, contextuales y de muy baja latencia.
  - **Modo Demo / Fallback Gratuito:** Integración con el servicio **MyMemory Translation**. Si aún no has ingresado tu API key de Gemini o si se interrumpe la conexión, la aplicación continúa traduciendo de inmediato sin bloquearse.
- 🔊 **Text-to-Speech (TTS):** Botón para escuchar la traducción en voz alta con selección automática de la mejor voz disponible en tu sistema para el idioma meta.
- 🔄 **Intercambio rápido de idiomas:** Botón animado para alternar los idiomas de entrada y salida al instante.
- 📋 **Historial de la sesión:** Cada frase se guarda automáticamente en `localStorage`. Puedes escucharla nuevamente, copiarla al portapapeles o borrar el historial completo.
- 💬 **Modo conversación en vivo (Automático):**
  - Al activarlo con el nuevo interruptor, traduce y reproduce inmediatamente el audio en voz alta por Text-to-Speech sin que tengas que tocar ningún botón.
  - **Cola inteligente (Queue):** Las frases se encolan secuencialmente para que los audios no se pisen.
  - **Prevención de eco y bucles:** Pausa automáticamente la escucha del micrófono mientras se reproduce el audio y la reanuda al terminar.
  - Incluye recomendación visual de uso de audífonos.
- 🎨 **Diseño Profesional Inspirado en Kyvora Studio:**
  - Fondo azul marino noche ultra profundo (`#070c18`), paneles con bordes sutiles y elegantes (`#1a2c4e`), y acentos vibrantes en **cian eléctrico** (`#00e5ff`) en botones clave (Micrófono, Escuchar, switches).
  - Modo claro conservado como opción secundaria.
- 🛡️ **Manejo integral de errores:** Notificaciones toast e instrucciones guiadas para permisos de micrófono denegados, navegadores no compatibles y desconexiones de red.

---

## 📁 Estructura del Proyecto

```text
p1/
├── index.html               # Estructura semántica HTML5 y modales accesibles
├── css/
│   └── styles.css           # Estilos responsivos, variables de tema y animaciones
├── js/
│   ├── config.example.js    # Plantilla de configuración de la API
│   ├── config.js            # Archivo local con tu configuración activa (ignorado en git)
│   ├── speechRecognition.js # Manejador de la Web Speech API (entrada de voz continua)
│   ├── speechSynthesis.js   # Manejador de Text-to-Speech con selección de voz nativa
│   ├── translation.js       # Servicio conector a Gemini Flash y fallback MyMemory
│   ├── history.js           # Gestor de historial con persistencia en localStorage
│   ├── ui.js                # Control de temas, notificaciones toast y estados visuales
│   └── app.js               # Orquestador principal que conecta todos los módulos (ES6)
├── .gitignore               # Excluye config.js para no filtrar claves de API
└── README.md                # Guía de uso y configuración
```

---

## 🚀 Cómo Ejecutar la Aplicación

> [!IMPORTANT]
> **¿Por qué se necesita un servidor local?**
> Por motivos de seguridad y privacidad del navegador, la **Web Speech API** exige un contexto seguro (`http://localhost` o `https://`). Si abres `index.html` haciendo doble clic directamente con el protocolo `file:///`, los navegadores como Google Chrome bloquearán o limitarán el acceso al micrófono.

Puedes levantar un servidor local en segundos utilizando cualquiera de estas opciones:

### Opción 1: Con Python (Recomendado si ya tienes Python instalado)
Abre una terminal en la carpeta del proyecto y ejecuta:
```bash
python -m http.server 8000
```
Luego abre tu navegador en: [http://localhost:8000](http://localhost:8000)

### Opción 2: Con Node.js / npx
Si tienes Node.js instalado, puedes usar:
```bash
npx serve .
```
o también:
```bash
npx live-server
```

### Opción 3: Con VS Code (Extensión Live Server)
1. Abre la carpeta del proyecto en Visual Studio Code.
2. Instala la extensión **Live Server** (de Ritwick Dey).
3. Haz clic derecho sobre `index.html` y selecciona **"Open with Live Server"**.

---

## 🔑 Cómo Obtener tu API Key Gratuita en Google AI Studio

1. Ingresa a [https://aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey).
2. Inicia sesión con tu cuenta de Google.
3. Haz clic en el botón azul **"Create API key"** (Crear clave de API).
4. Elige **"Create API key in new project"** (Crear clave en un proyecto nuevo) o selecciona uno existente en Google Cloud.
5. Copia la clave alfanumérica generada (comienza usualmente con `AIzaSy...`).

---

## ⚙️ Cómo Configurar la API de Gemini

VoiceTranslate está diseñado para ser **100% tolerante**: si `js/config.js` no existe (por ejemplo, al clonar este proyecto de un repositorio), la aplicación cargará automáticamente los valores por defecto de `js/config.example.js` utilizando **MyMemory** como modo demostración sin requerir ninguna clave ni configuración previa.

Para activar **Gemini Flash** (más rápido, natural y contextual), tienes dos opciones:

### Opción A: Desde la propia aplicación (Recomendada y más fácil)
1. Abre la aplicación en tu navegador ([http://localhost:8000](http://localhost:8000)).
2. Haz clic en el icono de **Ajustes** (engranaje ⚙️) en la esquina superior derecha o sobre el distintivo de proveedor.
3. Pega tu API Key de Gemini en el campo correspondiente.
4. Puedes presionar el botón **"Probar conexión"** para verificar que tu clave funcione.
5. Haz clic en **"Guardar cambios"**. La clave quedará almacenada de forma segura en tu navegador.

### Opción B: Mediante archivo local `js/config.js`
1. Copia la plantilla `js/config.example.js` y nómbrala como `js/config.js`:
   ```bash
   cp js/config.example.js js/config.js
   ```
2. Abre `js/config.js` y coloca tu clave:
   ```javascript
   export const CONFIG = {
     provider: 'gemini',
     geminiApiKey: 'AIzaSyTU_CLAVE_AQUI',
     geminiModel: 'gemini-2.5-flash',
     translationDebounceMs: 600
   };
   ```
3. Guarda el archivo y recarga la aplicación en el navegador. (Este archivo está en el `.gitignore` para proteger tus credenciales).

---

## 🌐 Navegadores Compatibles

| Navegador | Compatibilidad Web Speech API | Recomendación |
| :--- | :---: | :--- |
| **Google Chrome** | ✅ Totalmente compatible | **Excelente (Recomendado)** |
| **Microsoft Edge** | ✅ Totalmente compatible | **Excelente (Recomendado)** |
| **Opera** | ✅ Compatible | Muy buena |
| **Safari** (macOS / iOS) | ✅ Compatible | Buena |
| **Brave** | ⚠️ Requiere ajuste | Por defecto bloquea el servicio de reconocimiento de voz de Google (arroja error de red). Se recomienda usar Chrome o Edge. |
| **Mozilla Firefox** | ⚠️ No soportado de forma continua | Requiere activar flags experimentales internas; se recomienda Chrome o Edge. |

---

## 🛠️ Tecnologías Empleadas

- **HTML5 Semántico**: Elementos nativos (`<dialog>`, `<select>`, `<article>`, `<main>`).
- **CSS3 Puro**: CSS Custom Properties para paleta dual de colores (Dark/Light), Flexbox, CSS Grid y animaciones de fotogramas (`@keyframes`).
- **JavaScript ES6+**: Módulos nativos (`import`/`export`), `SpeechRecognition`, `window.speechSynthesis`, `fetch` con async/await y `localStorage`.
- **API Gemini de Google**: Inferencia con el modelo `gemini-2.5-flash` vía REST API.
