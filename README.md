# Waypoint

Waypoint is a local-first file browser with a FastAPI backend and a Vite + React client.

## Local development

Backend:
1) `cd backend`
2) Create env file: `cp .env.example .env` and fill in required values.
3) Create venv and install deps:
   - Windows: `python -m venv .venv` then `.\.venv\Scripts\python -m pip install -r requirements.txt`
   - macOS/Linux: `python3 -m venv .venv` then `. .venv/bin/activate` and `python -m pip install -r requirements.txt`
4) Run the API: `python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000`

Client:
1) `cd client`
2) `npm install`
3) Optionally set `VITE_API_BASE` in `client/.env.local`
4) `npm run dev`

## Backend configuration

Set these in `backend/.env`:
- `WAYPOINT_USERNAME`, `WAYPOINT_PASSWORD_HASH`, `WAYPOINT_JWT_SECRET` (required)
- `WAYPOINT_JWT_ALG` (default `HS256`)
- `WAYPOINT_ACCESS_TTL_MIN` (default `15`)
- `WAYPOINT_ROOT` (sandbox root; defaults to `A:\WaypointRoot` if it exists, otherwise `<repo>/WaypointRoot`)
- `WAYPOINT_STATE_DIR` (default `.waypoint_state`)
- `WAYPOINT_ALLOWED_ORIGINS` (comma-separated; default `http://localhost:5173`)
- `WAYPOINT_HOST` / `WAYPOINT_PORT` (defaults `127.0.0.1` / `8000` for local dev)

## Remote access (Tailscale)

Recommended approach is to keep the API private and access it over Tailscale.

1) Install Tailscale on the Windows PC and the laptop, sign in to the same tailnet.
2) Run the backend on the PC bound to `0.0.0.0` (see service steps below).
3) Add the client origin to CORS if needed: update `WAYPOINT_ALLOWED_ORIGINS` in `backend/.env`.
4) On the laptop, set `VITE_API_BASE` in `client/.env.local`:
   - `VITE_API_BASE=http://<tailscale-ip>:8000`

## Windows always-on backend (NSSM)

Prereqs:
- NSSM installed. Either set `NSSM_PATH` to your `nssm.exe`, or place it at `backend/scripts/tools/nssm.exe`.

Steps (run PowerShell as Administrator):
1) `powershell -ExecutionPolicy Bypass -File backend/scripts/install_service.ps1`
2) `powershell -ExecutionPolicy Bypass -File backend/scripts/start_service.ps1`

Logs:
- `backend/logs/waypoint-service.out.log`
- `backend/logs/waypoint-service.err.log`

To stop/uninstall:
- `powershell -ExecutionPolicy Bypass -File backend/scripts/stop_service.ps1`
- `powershell -ExecutionPolicy Bypass -File backend/scripts/uninstall_service.ps1`

## Windows firewall (Tailscale-only)

Allow TCP 8000 only from the Tailscale CGNAT range:
```powershell
New-NetFirewallRule -DisplayName "Waypoint (Tailscale)" -Direction Inbound -Action Allow -Protocol TCP -LocalPort 8000 -RemoteAddress 100.64.0.0/10
```

Remove rule:
```powershell
Remove-NetFirewallRule -DisplayName "Waypoint (Tailscale)"
```
