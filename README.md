# Portal Hub de Aplicaciones Web

Plataforma centralizada y lanzador de aplicaciones web locales para la gestión de producción, control de impresión y herramientas operativas.

---

## 🌟 Características

- **Lanzador Centralizado:** Permite acceder y organizar todas las aplicaciones locales (Diplomas, Administración de Impresoras, Onzatroy, Tercera Placa, Gestión de Folios) desde un solo panel.
- **Monitoreo de Servicios en Tiempo Real:** Detección automática del estado (En Línea / Desconectado) verificando los puertos TCP locales (`5050`, `5000`, `8080`, etc.).
- **Control de Procesos:** Botones integrados para iniciar o detener servicios y servidores Flask en segundo plano directamente desde la interfaz.
- **Buscador y Filtro por Categorías:** Clasificación por áreas operativas (Diplomas, Producción, Sistemas, Folios, Tercera Placa) con búsqueda rápida en tiempo real.
- **Mantenedor Integrado:** Modal para registrar nuevas aplicaciones, modificar rutas o comandos de ejecución sin tocar código.

---

## 🚀 Puesta en Marcha

1. **Instalar dependencias:**
   ```bash
   pip install -r requirements.txt
   ```

2. **Iniciar el Hub:**
   - **Opción A (Recomendada):** Haz doble clic en `iniciar_hub.bat`.
   - **Opción B (Línea de comandos):**
     ```bash
     python app.py
     ```
   - Abre tu navegador en: **`http://127.0.0.1:8000`**

---

## 📁 Estructura del Proyecto

```text
Hub_Apps/
├── app.py                 # Servidor Flask y orquestador de procesos
├── apps_config.json       # Registro y configuración de aplicaciones
├── iniciar_hub.bat        # Script de inicio con apertura automática del navegador
├── iniciar_silencioso.vbs # Lanzador en segundo plano sin ventana de consola
├── requirements.txt       # Dependencias de Python
├── templates/
│   └── index.html         # Panel de control y vista principal
└── static/
    ├── css/styles.css     # Estilos visuales del portal
    └── js/hub.js          # Lógica frontend, filtros y sincronización de estados
```
