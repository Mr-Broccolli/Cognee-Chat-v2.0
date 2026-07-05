import os
import socket
import subprocess
import sys
from pathlib import Path
from dotenv import load_dotenv

def find_free_port(start=8000, max_tries=100):
    for port in range(start, start + max_tries):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            try:
                s.bind(("", port))
                return port
            except OSError:
                continue
    raise RuntimeError(f"Could not find a free port after {max_tries} attempts")

def kill_process_on_port(port):
    try:
        output = subprocess.check_output(
            f"netstat -ano | findstr :{port}", shell=True, text=True
        )
        lines = output.strip().split("\n")
        for line in lines:
            if f":{port}" in line and "LISTENING" in line:
                parts = line.split()
                pid = parts[-1]
                subprocess.run(f"taskkill /PID {pid} /F", shell=True, check=False)
                break
    except subprocess.CalledProcessError:
        pass

def write_port_file(port):
    project_root = Path(__file__).resolve().parent
    port_file = project_root / ".port"
    try:
        port_file.write_text(str(port))
        print(f"Port {port} written to {port_file}")
    except Exception as e:
        print(f"Warning: Could not write port file: {e}")

def main():
    project_root = Path(__file__).resolve().parent
    os.chdir(str(project_root))
    load_dotenv(project_root / ".env")

    port = int(os.getenv("PORT", find_free_port()))
    if os.getenv("KILL_EXISTING_PORT", "false").lower() == "true":
        kill_process_on_port(port)

    write_port_file(port)

    print(f"Starting server on port {port}...")
    subprocess.run([
        sys.executable, "-m", "uvicorn",
        "api:app",
        "--host", "127.0.0.1",
        "--port", str(port)
    ], check=True)

if __name__ == "__main__":
    main()