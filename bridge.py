import http.server
import socketserver
import json
import queue
import time
import base64

PORT = 5000

pending_requests = queue.Queue()

results = {}

class BridgeHandler(http.server.BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        pass

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_GET(self):
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.Content_Type = "application/json"
        self.send_header("Content-Type", "application/json")
        self.end_headers()

        if self.path == "/pending":
            try:
                req = pending_requests.get_nowait()
                self.wfile.write(json.dumps(req).encode("utf-8"))
            except queue.Empty:
                self.wfile.write(json.dumps({"status": "no_pending"}).encode("utf-8"))
        else:
            self.wfile.write(json.dumps({"status": "ok", "message": "Bridge is running"}).encode("utf-8"))

    def do_POST(self):
        content_length = int(self.headers.get('Content-Length', 0))
        post_data = self.rfile.read(content_length)
        
        try:
            data = json.loads(post_data.decode("utf-8"))
        except Exception:
            data = {}

        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Content-Type", "application/json")
        self.end_headers()

        if self.path == "/request":
            prompt = data.get("prompt", "")
            scene = data.get("scene", "")
            sample_context = data.get("sample_context", "")
            voice = data.get("voice", "Zephyr")
            req_id = str(int(time.time() * 1000))
            
            print(f"[Bridge] Received new prompt request:")
            print(f"  - Scene: {scene}")
            print(f"  - Context: {sample_context}")
            print(f"  - Prompt (Speech): {prompt}")
            print(f"  - Voice: {voice}")
            
            pending_requests.put({
                "id": req_id,
                "prompt": prompt,
                "scene": scene,
                "sample_context": sample_context,
                "voice": voice
            })
            
            timeout = 30
            start_time = time.time()
            success = False
            
            while time.time() - start_time < timeout:
                if req_id in results:
                    success = True
                    break
                time.sleep(0.1)
                
            if success:
                audio_b64 = results.pop(req_id)
                self.wfile.write(json.dumps({
                    "status": "success",
                    "audio": audio_b64
                }).encode("utf-8"))
            else:
                self.wfile.write(json.dumps({
                    "status": "error",
                    "message": "Request timed out waiting for extension"
                }).encode("utf-8"))

        elif self.path == "/response":
            req_id = data.get("id")
            audio_data = data.get("audio")
            
            if req_id and audio_data:
                print(f"[Bridge] Audio received for request ID: {req_id}")
                results[req_id] = audio_data
                self.wfile.write(json.dumps({"status": "received"}).encode("utf-8"))
            else:
                self.wfile.write(json.dumps({"status": "error", "message": "Missing ID or audio data"}).encode("utf-8"))
        else:
            self.wfile.write(json.dumps({"status": "error", "message": "Endpoint not found"}).encode("utf-8"))

class ThreadingHTTPServer(socketserver.ThreadingMixIn, http.server.HTTPServer):
    pass

def run():
    server = ThreadingHTTPServer(('0.0.0.0', PORT), BridgeHandler)
    print(f"[Bridge] Local bridge server started on http://localhost:{PORT}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n[Bridge] Stopping server...")
        server.server_close()

if __name__ == "__main__":
    run()
