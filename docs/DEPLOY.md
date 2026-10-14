# Free Hosting (Oracle Cloud "Always Free")

The backend is one Node process with no database server, so a free, always-on VM is enough.

## 1. Create the VM (once)
1. Sign up at Oracle Cloud and choose a **home region** close to you (e.g. Frankfurt).
   A card is needed for identity checks; Always Free resources are not charged.
2. Create a compute instance: **Ubuntu 24.04**, shape **VM.Standard.A1.Flex** (Arm, Always Free) with 1 OCPU / 6 GB RAM.
3. Add your SSH key. Leave the rest as default.

## 2. Install
```bash
ssh ubuntu@<vm-ip>
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs git
sudo useradd --system --create-home --home-dir /opt/news-verify newsverify
sudo -u newsverify git clone -b ios-foundation https://github.com/laminema0/coursera-test /opt/news-verify
cd /opt/news-verify/backend
sudo -u newsverify npm ci --omit=dev
sudo -u newsverify cp .env.example .env      # defaults are fine; X stays off
sudo -u newsverify mkdir -p data
sudo -u newsverify npm run check-sources     # optional: see which feeds work from the VM
sudo cp deploy/news-verify.service /etc/systemd/system/
sudo systemctl daemon-reload && sudo systemctl enable --now news-verify
curl localhost:8787/health
```

## 3. Make it reachable over HTTPS
The iOS app needs HTTPS. Free option: **Cloudflare Tunnel**. No open ports, no certificate work, free.
```bash
# after creating a tunnel in the Cloudflare dashboard (Zero Trust → Networks → Tunnels):
sudo cloudflared service install <token-from-dashboard>
# route https://api.<your-domain> → http://localhost:8787
```
No domain yet? `cloudflared tunnel --url http://localhost:8787` gives a temporary `*.trycloudflare.com` URL for testing.

Then set `API_BASE_URL = https:/$()/api.<your-domain>/v1` and `USE_MOCK_DATA = NO` in `Configs/Staging.xcconfig`.

## 4. Update
```bash
cd /opt/news-verify && sudo -u newsverify git pull && cd backend && sudo -u newsverify npm ci --omit=dev
sudo systemctl restart news-verify
```

## Notes
- **Idle reclaim:** Oracle may reclaim Always Free VMs that stay almost idle for 7 days. The collector runs every minute, which normally keeps it active.
- **Memory:** 72 hours of articles from 55 feeds uses well under 500 MB.
- **Backups:** `data/articles.json` is the only state. Losing it just means re-collecting the last 72 hours.
