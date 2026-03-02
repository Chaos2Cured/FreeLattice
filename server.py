#!/usr/bin/env python3
"""
FreeLattice — Local Server (Python)
Zero dependencies. Just run: python3 server.py
"""

import http.server
import os
import socket
import sys
import urllib.request
import urllib.error

# --- Configuration ---
PORT = int(os.environ.get('PORT', 3000))
ROOT = os.path.dirname(os.path.abspath(__file__))
OLLAMA_HOST = os.environ.get('OLLAMA_HOST', 'http://localhost:11434')

# --- Extended MIME types ---
EXTRA_MIME = {
    '.woff2': 'font/woff2',
    '.woff':  'font/woff',
    '.ttf':   'font/ttf',
    '.webp':  'image/webp',
    '.webm':  'video/webm',
    '.mp4':   'video/mp4',
    '.mp3':   'audio/mpeg',
    '.wav':   'audio/wav',
    '.wasm':  'application/wasm',
    '.json':  'application/json',
    '.svg':   'image/svg+xml',
    '.md':    'text/markdown',
    '.ico':   'image/x-icon',
}


def get_local_ip():
    """Get the machine's local network IP address."""
    try:
        # Connect to a public DNS to determine the local IP (no data is sent)
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.settimeout(0.5)
        s.connect(('8.8.8.8', 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return '127.0.0.1'


def check_ollama():
    """Check if Ollama is running and reachable."""
    try:
        req = urllib.request.Request(OLLAMA_HOST + '/api/tags', method='GET')
        resp = urllib.request.urlopen(req, timeout=3)
        resp.read()
        resp.close()
        return True
    except Exception:
        return False


class FreeLatticeHandler(http.server.SimpleHTTPRequestHandler):
    """Custom handler with CORS support, Ollama proxy, and extended MIME types."""

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def end_headers(self):
        # Add CORS headers to every response
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
        super().end_headers()

    def do_OPTIONS(self):
        """Handle preflight CORS requests."""
        self.send_response(204)
        self.end_headers()

    def do_GET(self):
        """Handle GET requests — proxy /ollama/* or serve static files."""
        if self._is_ollama_proxy():
            self._proxy_to_ollama()
        else:
            super().do_GET()

    def do_POST(self):
        """Handle POST requests — proxy /ollama/* to Ollama."""
        if self._is_ollama_proxy():
            self._proxy_to_ollama()
        else:
            self.send_response(405)
            self.end_headers()
            self.wfile.write(b'Method Not Allowed')

    def do_PUT(self):
        """Handle PUT requests — proxy /ollama/* to Ollama."""
        if self._is_ollama_proxy():
            self._proxy_to_ollama()
        else:
            self.send_response(405)
            self.end_headers()
            self.wfile.write(b'Method Not Allowed')

    def do_DELETE(self):
        """Handle DELETE requests — proxy /ollama/* to Ollama."""
        if self._is_ollama_proxy():
            self._proxy_to_ollama()
        else:
            self.send_response(405)
            self.end_headers()
            self.wfile.write(b'Method Not Allowed')

    def _is_ollama_proxy(self):
        """Check if the request path starts with /ollama."""
        path = self.path.split('?')[0]
        return path.startswith('/ollama/') or path == '/ollama'

    def _proxy_to_ollama(self):
        """Forward the request to the local Ollama server."""
        # Strip /ollama prefix and build target URL
        path_with_query = self.path
        if path_with_query.startswith('/ollama'):
            path_with_query = path_with_query[len('/ollama'):]
        if not path_with_query:
            path_with_query = '/'
        target_url = OLLAMA_HOST + path_with_query

        # Read request body if present
        content_length = int(self.headers.get('Content-Length', 0))
        body = self.rfile.read(content_length) if content_length > 0 else None

        # Build the proxy request
        proxy_req = urllib.request.Request(target_url, data=body, method=self.command)

        # Forward relevant headers
        skip_headers = {'host', 'connection', 'transfer-encoding'}
        for key, value in self.headers.items():
            if key.lower() not in skip_headers:
                proxy_req.add_header(key, value)

        try:
            proxy_resp = urllib.request.urlopen(proxy_req, timeout=300)
            # Send response status
            self.send_response(proxy_resp.status)
            # Forward response headers
            for key, value in proxy_resp.getheaders():
                lower = key.lower()
                if lower not in ('transfer-encoding', 'connection',
                                 'access-control-allow-origin',
                                 'access-control-allow-methods',
                                 'access-control-allow-headers'):
                    self.send_header(key, value)
            self.end_headers()
            # Stream the response body
            while True:
                chunk = proxy_resp.read(8192)
                if not chunk:
                    break
                self.wfile.write(chunk)
            proxy_resp.close()
        except urllib.error.HTTPError as e:
            self.send_response(e.code)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            error_body = e.read() if e.fp else b''
            self.wfile.write(error_body)
        except Exception as e:
            self.send_response(502)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            import json
            error_msg = json.dumps({
                'error': 'Ollama proxy error: Could not connect to Ollama at ' + OLLAMA_HOST,
                'detail': 'Make sure Ollama is running. Install from https://ollama.com if needed.',
                'original_error': str(e)
            })
            self.wfile.write(error_msg.encode('utf-8'))

    def guess_type(self, path):
        """Extended MIME type detection."""
        _, ext = os.path.splitext(path)
        ext = ext.lower()
        if ext in EXTRA_MIME:
            return EXTRA_MIME[ext]
        return super().guess_type(path)

    def log_message(self, format, *args):
        """Cleaner log output."""
        sys.stdout.write('  %s — %s\n' % (self.address_string(), format % args))
        sys.stdout.flush()


def main():
    local_ip = get_local_ip()

    server = http.server.HTTPServer(('0.0.0.0', PORT), FreeLatticeHandler)

    print('')
    print('  🌐 FreeLattice Server running!')
    print('')
    print('     Local:   http://localhost:%d' % PORT)
    print('     Network: http://%s:%d' % (local_ip, PORT))
    print('')

    # Check for Ollama
    ollama_running = check_ollama()
    if ollama_running:
        print('  🤖 Ollama detected at %s — proxy enabled!' % OLLAMA_HOST)
        print('     Proxy route: http://localhost:%d/ollama/* → %s/*' % (PORT, OLLAMA_HOST))
    else:
        print('  ℹ️  Ollama not detected. Install from ollama.com for local AI.')
        print('     (The proxy route /ollama/* is still active — start Ollama anytime.)')

    print('')
    print('     Share the Network URL with your phone or other devices on your WiFi')
    print('')
    print('  Press Ctrl+C to stop the server.')
    print('')

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print('\n  Server stopped. Goodbye! 👋\n')
        server.server_close()
        sys.exit(0)


if __name__ == '__main__':
    main()
