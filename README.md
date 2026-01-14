# Waypoint

Private, single-user file access from anywhere, backed by a sandboxed FastAPI server and a Vite + React client. Designed for a home PC + laptop workflow over Tailscale.

## Highlights
- Sandboxed filesystem root (`WAYPOINT_ROOT`) with safe path handling
- JWT auth + refresh flow
- Upload/download/mkdir/move/delete
- Transfer queue with progress + cancel
- Realtime filesystem change events

## Local development

Backend (from repo root):
1) `cd backend`
2) `cp .env.example .env` and fill in required values
3) Create venv + install deps:
   - Windows: `python -m venv .venv` then `.\.venv\Scripts\python -m pip install -r requirements.txt`
   - macOS/Linux: `python3 -m venv .venv` then `. .venv/bin/activate` and `python -m pip install -r requirements.txt`
4) Run API: `python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000`

Client (from repo root):
1) `cd client`
2) `npm install`
3) Optional: set `VITE_API_BASE` in `client/.env` or `client/.env.local`
4) `npm run dev`

## Configuration

Set these in `backend/.env`:
- `WAYPOINT_USERNAME`, `WAYPOINT_PASSWORD_HASH`, `WAYPOINT_JWT_SECRET` (required)
- `WAYPOINT_JWT_ALG` (default `HS256`)
- `WAYPOINT_ACCESS_TTL_MIN` (default `15`)
- `WAYPOINT_ROOT` (default `A:\WaypointRoot` if it exists, otherwise `<repo>/WaypointRoot`)
- `WAYPOINT_STATE_DIR` (default `.waypoint_state`)
- `WAYPOINT_ALLOWED_ORIGINS` (comma-separated; default `http://localhost:5173`)
- `WAYPOINT_HOST` / `WAYPOINT_PORT` (defaults `127.0.0.1` / `8000`)

Client config:
- `VITE_API_BASE` (default `http://127.0.0.1:8000`)

## Remote access (Tailscale)

1) Install Tailscale on the Windows PC and the laptop (same tailnet).
2) Run the backend on the PC bound to `0.0.0.0` (see service steps below).
3) Add the browser origin to CORS if needed: update `WAYPOINT_ALLOWED_ORIGINS` in `backend/.env`.
4) On the laptop, set `VITE_API_BASE=http://<tailscale-ip>:8000` in `client/.env` or `client/.env.local`.

## Windows always-on backend (NSSM)

Prereqs:
- NSSM installed. Set `NSSM_PATH` to your `nssm.exe`, or place it at `backend/scripts/tools/nssm.exe`.

Install + start (Admin PowerShell, from repo root):
1) `powershell -ExecutionPolicy Bypass -File backend/scripts/install_service.ps1`
2) `powershell -ExecutionPolicy Bypass -File backend/scripts/start_service.ps1`

Logs:
- `backend/logs/waypoint-service.out.log`
- `backend/logs/waypoint-service.err.log`

Stop/uninstall:
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

## Troubleshooting

- Login fails with `Failed to fetch`: verify `VITE_API_BASE` and restart Vite.
- CORS errors: add `http://localhost:5173` (and any other client origins) to `WAYPOINT_ALLOWED_ORIGINS`, then restart the backend service.
- Service running but no files: check `WAYPOINT_ROOT` and service account permissions.
