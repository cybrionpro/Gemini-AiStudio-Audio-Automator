import requests
import json
import base64
import wave
import argparse

URL = "http://localhost:5000/request"

def main():
    parser = argparse.ArgumentParser(description="Test script for AI Studio TTS Bridge")
    parser.add_argument("--prompt", "-p", type=str, 
                        default="Hello baby, ye ek speech block text hai. Sab sahi chal raha hai?",
                        help="Text that the speaker will say")
    parser.add_argument("--scene", "-s", type=str, 
                        default="seductive voice",
                        help="Director notes or scene setting")
    parser.add_argument("--context", "-c", type=str, 
                        default="previous speaker just finished talking",
                        help="Sample context for speech generation")
    parser.add_argument("--voice", "-v", type=str, 
                        default="Zephyr",
                        help="Prebuilt voice name (e.g. Zephyr, Puck)")

    args = parser.parse_args()

    payload = {
        "prompt": args.prompt,
        "scene": args.scene,
        "sample_context": args.context,
        "voice": args.voice
    }

    print("Sending request to bridge server:")
    print(f"  - Scene: {args.scene}")
    print(f"  - Context: {args.context}")
    print(f"  - Prompt: {args.prompt}")
    print(f"  - Voice: {args.voice}")

    try:
        response = requests.post(URL, json=payload, timeout=35)
        
        if response.status_code == 200:
            data = response.json()
            if data.get("status") == "success":
                audio_b64 = data.get("audio")
                print("\nSuccessfully received audio from Chrome Extension bridge!")
                
                audio_bytes = base64.b64decode(audio_b64)
                
                output_file = "bridge_test.wav"
                with wave.open(output_file, "wb") as wav_file:
                    wav_file.setnchannels(1)
                    wav_file.setsampwidth(2)
                    wav_file.setframerate(24000)
                    wav_file.writeframes(audio_bytes)
                    
                print(f"Saved generated audio to: {output_file}")
            else:
                print("\nBridge returned an error:", data.get("message"))
        else:
            print(f"\nHTTP Error {response.status_code}: {response.text}")
            
    except requests.exceptions.Timeout:
        print("\nError: Request timed out. Make sure the Chrome Extension is loaded and aistudio.google.com page is open in Chrome.")
    except Exception as e:
        print("\nConnection error:", e)

if __name__ == "__main__":
    main()
