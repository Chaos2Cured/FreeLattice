#!/usr/bin/env python3
"""
FreeLattice — Local Server (Python)
Zero dependencies. Just run: python3 server.py
"""

import http.server
import os
import socket
import sys

# --- Configuration ---
PORT = int(os.environ.get('PORT', 3000))
ROOT = os.path.dirname(os.path.abspath(__file__))

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


class FreeLatticeHandler(http.server.SimpleHTTPRequestHandler):
    """Custom handler with CORS support and extended MIME types."""

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
