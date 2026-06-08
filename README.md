# Antigravity Audio Automator

A lightweight bridge to automate high-quality speech generation directly from Google AI Studio. It acts as an intermediary server between your local Python backend/bot scripts and a custom Chrome Extension to automatically trigger, capture, and download high-quality, real-like AI TTS audio.

## Features
- Fully automated workflow.
- High-quality, human-like voice synthesis leveraging the latest models.
- Python bridge server that queues TTS requests.
- Zero complex API keys needed for the extension part.

## Project Structure
- `bridge.py`: Local server that exposes endpoints `/request`, `/pending`, and `/response`.
- `test_bridge.py`: Script to quickly test speech generation.

## Getting Started
1. Run the local bridge server:
   ```bash
   python bridge.py
   ```
2. Install the companion Chrome Extension:
   - Open Google Chrome and navigate to `chrome://extensions/`
   - Enable **Developer mode** toggle in the top-right corner.
   - Click **Load unpacked** in the top-left corner.
   - Select the `chrome_extension` folder from this repository.
3. Open Google AI Studio on the Speech generation page.
4. Run your python bot or `test_bridge.py` to initiate TTS requests automatically.
   
   You can pass a custom prompt, scene context, or voice settings via arguments:
   ```bash
   python test_bridge.py --prompt "Aapka custom prompt text yahan likhein" --scene "friendly tone" --voice "Zephyr"
   ```

   **Parameters available:**
   - `--prompt` / `-p`: Text prompt to say (default: "Hello baby...")
   - `--scene` / `-s`: Director notes or style (default: "seductive voice")
   - `--context` / `-c`: Background context (default: "previous speaker just finished talking")
   - `--voice` / `-v`: Select voice (e.g. Puck, Zephyr, Charon)

---

### Credit & Support
Developed with ❤️ by **Cybrion**.

For any updates, queries, or customization:
- **Telegram (Contact Us):** [Cybrion on Telegram](https://t.me/cybrion)
