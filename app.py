import os
import sys
import json
import time
import socket
import subprocess
import webbrowser
from flask import Flask, render_template, request, jsonify, send_from_directory, redirect

app = Flask(__name__)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
CONFIG_FILE = os.path.join(BASE_DIR, "apps_config.json")

# Dictionary to keep references to subprocesses started by the hub
running_processes = {}

def load_apps():
    if not os.path.exists(CONFIG_FILE):
        return []
    try:
        with open(CONFIG_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:
        print(f"Error loading {CONFIG_FILE}: {e}")
        return []

def save_apps(apps_list):
    try:
        with open(CONFIG_FILE, "w", encoding="utf-8") as f:
            json.dump(apps_list, f, indent=2, ensure_ascii=False)
        return True
    except Exception as e:
        print(f"Error saving {CONFIG_FILE}: {e}")
        return False

def is_port_listening(port):
    if not port:
        return False
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        s.settimeout(0.3)
        result = s.connect_ex(('127.0.0.1', int(port)))
        s.close()
        return result == 0
    except Exception:
        return False

def find_pid_by_port(port):
    if not port:
        return None
    try:
        cmd = f'powershell -Command "Get-NetTCPConnection -LocalPort {port} -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess"'
        res = subprocess.check_output(cmd, shell=True, text=True).strip()
        lines = [line.strip() for line in res.splitlines() if line.strip().isdigit()]
        if lines:
            return int(lines[0])
    except Exception:
        pass
    return None

def kill_process_tree(pid):
    try:
        subprocess.run(f"taskkill /F /T /PID {pid}", shell=True, capture_output=True)
        return True
    except Exception as e:
        print(f"Error killing PID {pid}: {e}")
        return False

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/api/apps", methods=["GET"])
def get_apps():
    return jsonify(load_apps())

@app.route("/api/apps", methods=["POST"])
def save_app():
    data = request.json or {}
    apps = load_apps()
    app_id = data.get("id", "").strip()

    if not app_id:
        app_id = "app_" + str(int(time.time()))
        data["id"] = app_id

    # Check if app exists to update or insert
    updated = False
    for i, a in enumerate(apps):
        if a.get("id") == app_id:
            apps[i] = data
            updated = True
            break
            
    if not updated:
        apps.append(data)

    if save_apps(apps):
        return jsonify({"success": True, "app": data})
    else:
        return jsonify({"error": "No se pudo guardar la configuración."}), 500

@app.route("/api/apps/<app_id>", methods=["DELETE"])
def delete_app(app_id):
    apps = load_apps()
    new_apps = [a for a in apps if a.get("id") != app_id]
    if len(new_apps) == len(apps):
        return jsonify({"error": "Aplicación no encontrada."}), 404
        
    if save_apps(new_apps):
        return jsonify({"success": True})
    return jsonify({"error": "Error al eliminar."}), 500

@app.route("/api/status", methods=["GET"])
def check_status():
    apps = load_apps()
    statuses = {}
    for a in apps:
        app_id = a.get("id")
        port = a.get("port")
        if port:
            statuses[app_id] = {
                "port": port,
                "online": is_port_listening(port)
            }
        else:
            statuses[app_id] = {
                "port": None,
                "online": None  # static HTML or non-server app
            }
    return jsonify(statuses)

@app.route("/open/<app_id>")
def open_app_route(app_id):
    apps = load_apps()
    target_app = next((a for a in apps if a.get("id") == app_id), None)
    if not target_app:
        return "Aplicación no encontrada", 404

    app_type = target_app.get("type", "file")
    port = target_app.get("port")
    target = target_app.get("target", "")

    # If it is a service
    if app_type == "service":
        if port and not is_port_listening(port):
            start_service_internal(target_app)
            for _ in range(20):
                if is_port_listening(port):
                    break
                time.sleep(0.25)
        if target and target.startswith("http"):
            return redirect(target)
        elif port:
            return redirect(f"http://localhost:{port}/")

    # If it is a local file / static HTML
    local_path = target_app.get("local_path", "")
    if local_path and os.path.exists(local_path):
        return redirect(f"/app/{app_id}/")
    elif target and target.startswith("http"):
        return redirect(target)
    elif target:
        # file:// or other URL
        clean_path = target.replace("file:///", "").replace("/", "\\")
        if os.path.exists(clean_path):
            target_app["local_path"] = clean_path
            return redirect(f"/app/{app_id}/")

    return "No se pudo resolver la ruta de la aplicación.", 404

@app.route("/app/<app_id>/", defaults={"filename": ""})
@app.route("/app/<app_id>/<path:filename>")
def serve_local_app(app_id, filename):
    apps = load_apps()
    target_app = next((a for a in apps if a.get("id") == app_id), None)
    if not target_app:
        return "Aplicación no encontrada", 404
        
    local_path = target_app.get("local_path", "")
    if not local_path and target_app.get("target", "").startswith("file:"):
        local_path = target_app.get("target", "").replace("file:///", "").replace("/", "\\")

    if not local_path or not os.path.exists(local_path):
        return f"Archivo no encontrado en ruta local: {local_path}", 404

    if os.path.isdir(local_path):
        folder = local_path
        target_file = filename if filename else "index.html"
    else:
        folder = os.path.dirname(local_path)
        target_file = filename if filename else os.path.basename(local_path)

    return send_from_directory(folder, target_file)


@app.route("/api/launch/<app_id>", methods=["POST"])
def launch_app(app_id):
    apps = load_apps()
    target_app = next((a for a in apps if a.get("id") == app_id), None)
    if not target_app:
        return jsonify({"error": "Aplicación no encontrada"}), 404

    target = target_app.get("target", "")
    local_path = target_app.get("local_path", "")
    port = target_app.get("port")

    # If it is a service and not running, start it first
    if port and not is_port_listening(port):
        start_service_internal(target_app)
        # Wait a bit for port to start
        for _ in range(15):
            if is_port_listening(port):
                break
            time.sleep(0.3)

    try:
        if local_path and os.path.exists(local_path):
            os.startfile(local_path)
            return jsonify({"success": True, "method": "os_startfile", "path": local_path})
        elif target:
            webbrowser.open(target)
            return jsonify({"success": True, "method": "webbrowser", "target": target})
        else:
            return jsonify({"error": "No hay ruta o URL configurada"}), 400
    except Exception as e:
        return jsonify({"error": str(e)}), 500

def start_service_internal(app_data):
    app_id = app_data.get("id")
    cmd = app_data.get("cmd", "").strip()
    cwd = app_data.get("cwd", "").strip()

    if not cmd:
        return False, "No hay comando de inicio especificado."

    if cwd and not os.path.exists(cwd):
        return False, f"El directorio de trabajo no existe: {cwd}"

    try:
        proc = subprocess.Popen(
            cmd,
            cwd=cwd if cwd else None,
            shell=True,
            creationflags=subprocess.CREATE_NEW_PROCESS_GROUP
        )
        running_processes[app_id] = proc
        return True, "Servicio iniciado correctamente."
    except Exception as e:
        return False, str(e)

@app.route("/api/services/start/<app_id>", methods=["POST"])
def start_service_route(app_id):
    apps = load_apps()
    target_app = next((a for a in apps if a.get("id") == app_id), None)
    if not target_app:
        return jsonify({"error": "Aplicación no encontrada"}), 404

    port = target_app.get("port")
    if port and is_port_listening(port):
        return jsonify({"success": True, "message": "El servicio ya se encuentra en ejecución.", "online": True})

    ok, msg = start_service_internal(target_app)
    if not ok:
        return jsonify({"error": msg}), 500

    # Wait briefly for port to bind
    online = False
    for _ in range(15):
        if port and is_port_listening(port):
            online = True
            break
        time.sleep(0.3)

    return jsonify({"success": True, "message": msg, "online": online})

@app.route("/api/services/stop/<app_id>", methods=["POST"])
def stop_service_route(app_id):
    apps = load_apps()
    target_app = next((a for a in apps if a.get("id") == app_id), None)
    if not target_app:
        return jsonify({"error": "Aplicación no encontrada"}), 404

    port = target_app.get("port")
    stopped = False

    # Try PID by port
    if port:
        pid = find_pid_by_port(port)
        if pid:
            stopped = kill_process_tree(pid)

    # Check subprocess handle
    if app_id in running_processes:
        try:
            running_processes[app_id].terminate()
            stopped = True
        except Exception:
            pass
        del running_processes[app_id]

    time.sleep(0.5)
    online = is_port_listening(port) if port else False
    return jsonify({"success": True, "stopped": stopped, "online": online})

if __name__ == "__main__":
    print("==================================================")
    print("Hub de Aplicaciones Web iniciado en http://127.0.0.1:8000")
    print("==================================================")
    app.run(host="127.0.0.1", port=8000, debug=False)
