# Report Systemd Notes

Install units:

```bash
cp /root/.openclaw/workspace/scripts/report-backend.service /etc/systemd/system/
cp /root/.openclaw/workspace/scripts/report-frontend.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now report-backend.service report-frontend.service
```

Useful commands:

```bash
systemctl status report-backend.service
systemctl status report-frontend.service
systemctl restart report-backend.service
systemctl restart report-frontend.service
journalctl -u report-backend.service -n 200 --no-pager
journalctl -u report-frontend.service -n 200 --no-pager
```
