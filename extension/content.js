console.log("[Extension Content] AI Studio TTS Automator extension active.");

const script = document.createElement('script');
script.src = chrome.runtime.getURL('inject.js');
script.onload = function () {
    this.remove();
};
(document.head || document.documentElement).appendChild(script);

let currentRequestId = null;
let lastAudioUrl = null;
const BRIDGE_URL = "http://localhost:5000";

function findAudioData(obj) {
    if (Array.isArray(obj)) {
        if (obj.length === 2 && typeof obj[0] === 'string' && obj[0].startsWith("audio/")) {
            return { mime: obj[0], data: obj[1] };
        }
        for (let item of obj) {
            let res = findAudioData(item);
            if (res) return res;
        }
    } else if (typeof obj === 'object' && obj !== null) {
        for (let key in obj) {
            let res = findAudioData(obj[key]);
            if (res) return res;
        }
    }
    return null;
}

function blobToBase64(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
            const base64String = reader.result.split(',')[1];
            resolve(base64String);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}

function getGeneratedAudioUrl() {
    const audio = document.querySelector('audio');
    if (audio && audio.src) {
        if (audio.src.startsWith('blob:') || audio.src.startsWith('data:')) {
            return audio.src;
        }
    }

    const links = Array.from(document.querySelectorAll('a, button'));
    for (let el of links) {
        const href = el.getAttribute('href') || el.href || "";
        if (href.startsWith('blob:') || href.startsWith('data:')) {
            return href;
        }
    }
    return null;
}

async function waitForNewAudio(reqId, previousUrl, attempt = 0) {
    if (currentRequestId !== reqId) {
        return;
    }

    const currentUrl = getGeneratedAudioUrl();
    console.log(`[Extension Content] Checking for new audio (Attempt ${attempt}): current=${currentUrl ? currentUrl.substring(0, 50) + "..." : "null"}`);

    if (currentUrl && currentUrl !== previousUrl) {
        console.log("[Extension Content] New audio URL detected!");
        lastAudioUrl = currentUrl;

        try {
            let base64Audio = "";

            if (currentUrl.startsWith('data:')) {
                console.log("[Extension Content] Parsing Base64 directly from Data URL");
                base64Audio = currentUrl.split(',')[1];
            } else {
                console.log("[Extension Content] Fetching Blob from blob URL:", currentUrl);
                const res = await fetch(currentUrl);
                const blob = await res.blob();
                base64Audio = await blobToBase64(blob);
            }

            const uploadRes = await fetch(`${BRIDGE_URL}/response`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    id: reqId,
                    audio: base64Audio
                })
            });
            const ack = await uploadRes.json();
            console.log("[Extension Content] Bridge server acknowledged response:", ack);
            currentRequestId = null;
        } catch (err) {
            console.error("[Extension Content] Error retrieving or sending audio:", err);
            if (attempt < 10) {
                setTimeout(() => waitForNewAudio(reqId, previousUrl, attempt + 1), 1000);
            } else {
                currentRequestId = null;
            }
        }
    } else {
        if (attempt < 30) {
            setTimeout(() => waitForNewAudio(reqId, previousUrl, attempt + 1), 500);
        } else {
            console.error("[Extension Content] Timeout waiting for new audio to generate.");
            currentRequestId = null;
        }
    }
}

window.addEventListener("message", function (event) {
    if (event.data && event.data.source === "aistudio-tts-interceptor") {
        if (event.data.type === "generate-content-response" && currentRequestId) {
            console.log("[Extension Content] Backup: Received response from interceptor for ID:", currentRequestId);

            try {
                const rawData = JSON.parse(event.data.data);
                const audioInfo = findAudioData(rawData);

                if (audioInfo) {
                    console.log("[Extension Content] Backup: Found audio in payload:", audioInfo.mime);

                    fetch(`${BRIDGE_URL}/response`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            id: currentRequestId,
                            audio: audioInfo.data
                        })
                    })
                        .then(res => res.json())
                        .then(data => {
                            console.log("[Extension Content] Backup: Bridge acknowledged response:", data);
                            currentRequestId = null;
                        })
                        .catch(err => {
                            console.error("[Extension Content] Backup: Error uploading audio:", err);
                        });
                }
            } catch (e) {
            }
        }
    }
});

function findEditorByName(name) {
    const editors = Array.from(document.querySelectorAll('textarea, [contenteditable="true"]'));
    return editors.find(el => {
        const placeholder = (el.getAttribute('placeholder') || el.placeholder || "").toLowerCase();
        if (placeholder.includes(name)) return true;

        if (el.parentElement) {
            const siblingsText = Array.from(el.parentElement.children)
                .filter(child => child !== el)
                .map(child => child.textContent || "")
                .join(" ")
                .toLowerCase();
            if (siblingsText.includes(name)) return true;

            if (el.parentElement.parentElement) {
                const gpSiblingsText = Array.from(el.parentElement.parentElement.children)
                    .filter(child => child !== el.parentElement)
                    .map(child => child.textContent || "")
                    .join(" ")
                    .toLowerCase();
                if (gpSiblingsText.includes(name)) return true;
            }
        }
        return false;
    });
}

function findSpeechEditor() {
    const editors = Array.from(document.querySelectorAll('textarea, [contenteditable="true"]'));

    let speechEditor = editors.find(el => {
        const placeholder = (el.getAttribute('placeholder') || el.placeholder || "").toLowerCase();
        return placeholder.includes('what you want') ||
            placeholder.includes('model to say') ||
            placeholder.includes('expression tags');
    });

    if (speechEditor) return speechEditor;

    const sceneEditor = findEditorByName('scene');
    const contextEditor = findEditorByName('context') || findEditorByName('sample');

    speechEditor = editors.find(el => el !== sceneEditor && el !== contextEditor);
    if (speechEditor) return speechEditor;

    if (editors.length >= 3) {
        return editors[2];
    }

    return editors[0];
}

function writeToEditor(editor, text) {
    if (!editor) return false;

    editor.focus();

    if (editor.tagName === 'TEXTAREA' || editor.tagName === 'INPUT') {
        editor.value = text;
        editor.dispatchEvent(new Event('input', { bubbles: true }));
        editor.dispatchEvent(new Event('change', { bubbles: true }));
    } else {
        try {
            const selection = window.getSelection();
            const range = document.createRange();
            range.selectNodeContents(editor);
            selection.removeAllRanges();
            selection.addRange(range);

            document.execCommand('delete', false, null);
            document.execCommand('insertText', false, text);
        } catch (e) {
            console.error("[Extension Content] execCommand failed, fallback to direct write:", e);
            editor.innerText = text;
        }

        editor.dispatchEvent(new Event('input', { bubbles: true }));
        try {
            editor.dispatchEvent(new InputEvent('input', {
                bubbles: true,
                cancelable: true,
                inputType: 'insertText',
                data: text
            }));
        } catch (e) { }
        editor.dispatchEvent(new Event('change', { bubbles: true }));

        editor.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true }));
        editor.dispatchEvent(new KeyboardEvent('keypress', { key: 'a', bubbles: true }));
        editor.dispatchEvent(new KeyboardEvent('keyup', { key: 'a', bubbles: true }));

        editor.dispatchEvent(new Event('blur', { bubbles: true }));
    }
    return true;
}

function triggerSpeechGeneration(data) {
    console.log("[Extension Content] Injecting prompt payload:", data);

    const sceneEditor = findEditorByName('scene');
    const contextEditor = findEditorByName('context') || findEditorByName('sample');
    const speechEditor = findSpeechEditor();

    if (sceneEditor && data.scene !== undefined) {
        writeToEditor(sceneEditor, data.scene);
    }

    if (contextEditor && data.sample_context !== undefined) {
        writeToEditor(contextEditor, data.sample_context);
    }

    if (speechEditor && data.prompt !== undefined) {
        writeToEditor(speechEditor, data.prompt);
    } else {
        console.error("[Extension Content] Could not find speech editor!");
        return false;
    }

    const previousUrl = getGeneratedAudioUrl();
    console.log("[Extension Content] Recorded previous audio URL:", previousUrl ? previousUrl.substring(0, 50) + "..." : "null");

    setTimeout(() => {
        const buttons = Array.from(document.querySelectorAll('button, [role="button"], .run-button, [data-testid*="run"]'));

        const runButton = buttons.find(btn => {
            if (btn.closest('ms-music-player') || btn.closest('.player-container') || btn.closest('.footer-controls')) {
                if (btn.closest('ms-music-player')) return false;
            }

            const text = (btn.innerText || btn.textContent || "").toLowerCase();

            if (text.includes('add speech block')) {
                return false;
            }

            const isRun = text.includes('run') ||
                text.includes('submit') ||
                text.includes('generate') ||
                (text.includes('ctrl') && text.includes('enter'));

            const hasPlayIcon = btn.querySelector('mat-icon') &&
                btn.querySelector('mat-icon').textContent.toLowerCase().includes('play');

            return isRun || hasPlayIcon;
        });

        let triggered = false;
        if (runButton && !runButton.disabled) {
            console.log("[Extension Content] Clicking generate button:", runButton);
            runButton.click();
            triggered = true;
        } else {
            console.log("[Extension Content] Run button disabled or not found. Dispatching Ctrl+Enter directly on editor.");
            const eventDown = new KeyboardEvent('keydown', {
                key: 'Enter',
                code: 'Enter',
                ctrlKey: true,
                metaKey: true,
                bubbles: true
            });
            speechEditor.dispatchEvent(eventDown);
            triggered = true;
        }

        if (triggered) {
            waitForNewAudio(data.id, previousUrl);
        } else {
            console.error("[Extension Content] Failed to trigger run command.");
            currentRequestId = null;
        }

    }, 600);

    return true;
}

async function pollPendingRequests() {
    if (currentRequestId) {
        return;
    }

    try {
        const res = await fetch(`${BRIDGE_URL}/pending`);
        const data = await res.json();

        if (data && data.status !== "no_pending" && data.id) {
            console.log("[Extension Content] Received pending prompt request:", data);
            currentRequestId = data.id;

            const success = triggerSpeechGeneration(data);
            if (!success) {
                currentRequestId = null;
            }
        }
    } catch (err) {
    }
}

setInterval(pollPendingRequests, 1500);
