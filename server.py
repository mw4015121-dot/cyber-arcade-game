import http.server
import socketserver
import webbrowser
import socket
import os
import sys

PORT = 8080
DIRECTORY = os.path.dirname(os.path.abspath(__file__))

class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

def get_local_ip():
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return "127.0.0.1"

def main():
    os.chdir(DIRECTORY)
    local_ip = get_local_ip()
    local_url = f"http://localhost:{PORT}"
    mobile_url = f"http://{local_ip}:{PORT}"

    print("=" * 60)
    print(" 🎮 RETRO CYBER ARCADE GAME SERVER RUNNING")
    print("=" * 60)
    print(f" ▶ Play on PC (Browser): {local_url}")
    print(f" 📱 Play on Mobile (Same Wi-Fi): {mobile_url}")
    print("=" * 60)
    print(" Press Ctrl + C to stop the server.\n")

    # Open browser on PC automatically
    try:
        webbrowser.open(local_url)
    except Exception:
        pass

    with socketserver.TCPServer(("", PORT), Handler) as httpd:
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nServer stopped.")

if __name__ == '__main__':
    main()
