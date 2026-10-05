# Workstation hosting with Tailscale Funnel

Public URL: https://bbq.ancon-pickerel.ts.net:8443

**Current status:** the production backend is installed, enabled, and running. Funnel status confirms that port 8443 is active, and the HTTPS merge route is reachable from this workstation. A live merge succeeded after removing the app's request cap and restarting the services. To recreate the Funnel configuration, run this on the workstation:

```bash
sudo tailscale funnel --bg --https=8443 http://127.0.0.1:3101
```

Port 443 already publishes another app. IdeaForge uses the separate supported Funnel port 8443. Tailscale terminates HTTPS and proxies to Next.js on loopback. Visitors do not need Tailscale. Background Funnel configuration persists across Tailscale restarts; see the [Funnel CLI documentation](https://tailscale.com/docs/reference/tailscale-cli/funnel).

## Verify activation

```bash
tailscale funnel status
curl --fail --max-time 20 https://bbq.ancon-pickerel.ts.net:8443/ -o /dev/null
```

The status must show port 8443 with `Funnel on` and proxy `http://127.0.0.1:3101`. Also open the public URL from a device outside the tailnet, such as a phone on mobile data with Tailscale disconnected. Reachability from a device outside the tailnet has not been verified in this session.

## App service

The persistent user service `ideaforge-funnel` binds to `127.0.0.1:3101`. Its source is [`../ops/ideaforge-funnel.service`](../ops/ideaforge-funnel.service), installed at `~/.config/systemd/user/ideaforge-funnel.service`. It is enabled at user-manager startup; user lingering is already enabled on this workstation, so it can start without an interactive login. The workstation must stay powered on and connected to the internet.

```bash
systemctl --user status ideaforge-funnel
systemctl --user restart ideaforge-funnel
systemctl --user stop ideaforge-funnel
journalctl --user -u ideaforge-funnel -n 50 --no-pager
```

Reinstall the service after changing its source:

```bash
install -m 644 ops/ideaforge-funnel.service ~/.config/systemd/user/ideaforge-funnel.service
systemctl --user daemon-reload
systemctl --user enable --now ideaforge-funnel
systemctl --user restart ideaforge-funnel
```

The unit records this workstation's project location and pinned Node 24.21.0 binary. Update those paths when moving the project or changing Node installations. Next.js loads ignored `.env.local` and `.env` files; provider credentials stay server-side.

The app does not cap AI requests. Valid merge requests go directly to Gemini; provider quotas and billing still apply. The previous persistent daily counter has been retired and is no longer read or written.

The local canvas resets on reload. Shared boards are stored in Liveblocks; anyone holding a board link can edit that room. One real Gemini merge and Liveblocks authorization both returned HTTP 200 during setup. Two-browser synchronization and public browser behavior have not been verified.

## Update the app

Both demo processes use the same production build. Stop them before replacing dependencies or rebuilding:

```bash
systemctl --user stop ideaforge-funnel ideaforge-demo
npm ci
npm run lint
npm run typecheck
npm run build
systemctl --user start ideaforge-funnel
```

Start only after all checks pass. To also restore the private demo, use the command below. Restart the services after changing provider environment files.

## Existing private demo

The original private demo remains at http://bbq.ancon-pickerel.ts.net:3100 (IP fallback: http://100.102.144.120:3100). It requires Tailscale and runs as the transient `ideaforge-demo` user service. Recreate it after a reboot or after it has been stopped:

```bash
systemd-run --user --collect --unit=ideaforge-demo \
  --description='IdeaForge Tailscale demo' \
  --working-directory=/home/bbq/Project/IdeaForge \
  --property=Restart=on-failure --property=RestartSec=3 \
  --setenv=NODE_ENV=production \
  /home/bbq/.cache/nub/node/24.21.0/bin/node \
  /home/bbq/Project/IdeaForge/node_modules/next/dist/bin/next \
  start --hostname 100.102.144.120 --port 3100
```

Use the HTTPS Funnel URL for shared boards so production guest cookies work correctly.

## Disable public access

Remove only IdeaForge's port and stop its backend:

```bash
sudo tailscale funnel --https=8443 off
systemctl --user disable --now ideaforge-funnel
```

Avoid `tailscale funnel reset`: it would remove the existing hosting configuration for other apps as well.
