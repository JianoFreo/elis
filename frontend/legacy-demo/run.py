"""Optional local server: python run.py (no third-party dependencies)."""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import threading
import webbrowser

if __name__ == '__main__':
    root = Path(__file__).resolve().parent / 'dist'
    address = ('127.0.0.1', 5500)
    server = ThreadingHTTPServer(address, partial(SimpleHTTPRequestHandler, directory=str(root)))
    print('Eli’s Yummy Kitchen: http://127.0.0.1:5500 — Ctrl+C to stop')
    threading.Timer(0.8, lambda: webbrowser.open('http://127.0.0.1:5500')).start()
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        server.server_close()
