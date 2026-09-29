import socket
import threading
import time

import pytest

from wayfarer_pipeline.http import HttpClient, HttpError


def _trickle_server() -> tuple[str, threading.Event]:
    """HTTP server that sends headers, then one body byte every 0.2 s forever: each socket read
    succeeds, so a per-read timeout never fires."""
    srv = socket.socket()
    srv.bind(("127.0.0.1", 0))
    srv.listen()
    stop = threading.Event()

    def serve() -> None:
        while not stop.is_set():
            srv.settimeout(0.5)
            try:
                conn, _ = srv.accept()
            except TimeoutError:
                continue
            conn.recv(4096)
            conn.sendall(b"HTTP/1.1 200 OK\r\nContent-Length: 100000\r\n\r\n")
            try:
                while not stop.is_set():
                    conn.sendall(b"x")
                    time.sleep(0.2)
            except OSError:
                pass
            conn.close()

    threading.Thread(target=serve, daemon=True).start()
    return f"http://127.0.0.1:{srv.getsockname()[1]}/slow", stop


def test_deadline_bounds_a_trickling_response(tmp_path):
    url, stop = _trickle_server()
    client = HttpClient(cache_dir=tmp_path, max_retries=0, timeout=1.0, deadline=1.5)
    started = time.monotonic()
    with pytest.raises(HttpError):
        client.request("GET", url, namespace="test")
    stop.set()
    assert time.monotonic() - started < 5
