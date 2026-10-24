#!/usr/bin/env bash
# Grundhärtung eines frischen Ubuntu-24.04-VPS (IONOS) für die KI-Telefonzentrale.
# Wiederholbar: Jeder Schritt prüft den Ist-Zustand und ändert nur, was fehlt.
#
#   sudo ADMIN_USER=betrieb bash deploy/harden.sh
#
# Was passiert:
#  1. System aktualisieren, Docker, ufw, fail2ban, unattended-upgrades installieren
#  2. Admin-Benutzer (sudo + docker) anlegen, SSH-Schlüssel von root übernehmen, falls nötig
#  3. SSH: nur Schlüssel, kein Root-Login, wenige Versuche – ERST nach Prüfung, dass ein
#     Schlüssel für ADMIN_USER hinterlegt ist (sonst Abbruch, damit sich niemand aussperrt)
#  4. Firewall: nur 22, 80, 443 eingehend
#  5. fail2ban für SSH
#  6. Automatische Sicherheitsupdates, Neustart bei Bedarf um 05:00 Uhr
#  7. Docker: Log-Begrenzung, Live-Restore
set -euo pipefail

ADMIN_USER=${ADMIN_USER:-}
SSH_PORT=${SSH_PORT:-22}
[ "$(id -u)" -eq 0 ] || { echo "Bitte mit sudo ausführen."; exit 1; }
[ -n "$ADMIN_USER" ] || { echo "ADMIN_USER fehlt, z. B.: sudo ADMIN_USER=betrieb bash deploy/harden.sh"; exit 1; }
step() { printf '\n\033[1m▶ %s\033[0m\n' "$1"; }

step "1/7 Pakete"
export DEBIAN_FRONTEND=noninteractive
apt-get update -q
apt-get upgrade -y -q
apt-get install -y -q docker.io docker-compose-v2 git ufw fail2ban unattended-upgrades apt-listchanges curl

step "2/7 Admin-Benutzer $ADMIN_USER"
if ! id "$ADMIN_USER" >/dev/null 2>&1; then
  adduser --disabled-password --gecos "" "$ADMIN_USER"
fi
usermod -aG sudo,docker "$ADMIN_USER"
home=$(getent passwd "$ADMIN_USER" | cut -d: -f6)
install -d -m 700 -o "$ADMIN_USER" -g "$ADMIN_USER" "$home/.ssh"
keys="$home/.ssh/authorized_keys"
if [ ! -s "$keys" ] && [ -s /root/.ssh/authorized_keys ]; then
  install -m 600 -o "$ADMIN_USER" -g "$ADMIN_USER" /root/.ssh/authorized_keys "$keys"
  echo "SSH-Schlüssel von root übernommen."
fi
if ! grep -qE '^(ssh-(ed25519|rsa)|ecdsa-sha2|sk-)' "$keys" 2>/dev/null; then
  echo "ABBRUCH: Für $ADMIN_USER ist kein SSH-Schlüssel hinterlegt ($keys)."
  echo "Erst Schlüssel eintragen (ssh-copy-id $ADMIN_USER@SERVER), dann Skript erneut starten."
  exit 1
fi
case "$(getent shadow "$ADMIN_USER" | cut -d: -f2)" in
  "" | "!"* | "*"*)
    echo "$ADMIN_USER braucht für sudo ein Passwort. Jetzt setzen (nur für sudo, SSH bleibt schlüsselbasiert):"
    passwd "$ADMIN_USER" ;;
esac

step "3/7 SSH nur mit Schlüssel, kein Root-Login"
cat > /etc/ssh/sshd_config.d/10-callki-hardening.conf <<EOF
Port $SSH_PORT
PermitRootLogin no
PasswordAuthentication no
KbdInteractiveAuthentication no
PubkeyAuthentication yes
MaxAuthTries 3
LoginGraceTime 30
X11Forwarding no
AllowUsers $ADMIN_USER
EOF
sshd -t
systemctl reload ssh || systemctl reload sshd
echo "Wichtig: Bestehende Sitzung offen lassen und in einem zweiten Fenster testen: ssh $ADMIN_USER@SERVER"

step "4/7 Firewall"
ufw default deny incoming
ufw default allow outgoing
ufw allow "$SSH_PORT"/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable
ufw status verbose

step "5/7 fail2ban"
cat > /etc/fail2ban/jail.d/callki.local <<EOF
[sshd]
enabled = true
port = $SSH_PORT
maxretry = 5
findtime = 10m
bantime = 1h
EOF
systemctl enable --now fail2ban
systemctl restart fail2ban

step "6/7 Automatische Sicherheitsupdates"
cat > /etc/apt/apt.conf.d/20auto-upgrades <<'EOF'
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";
APT::Periodic::AutocleanInterval "7";
EOF
cat > /etc/apt/apt.conf.d/52callki-unattended <<'EOF'
Unattended-Upgrade::Automatic-Reboot "true";
Unattended-Upgrade::Automatic-Reboot-Time "05:00";
Unattended-Upgrade::Remove-Unused-Dependencies "true";
EOF
systemctl enable --now unattended-upgrades

step "7/7 Docker"
mkdir -p /etc/docker
if [ ! -s /etc/docker/daemon.json ]; then
  cat > /etc/docker/daemon.json <<'EOF'
{
  "log-driver": "json-file",
  "log-opts": { "max-size": "20m", "max-file": "5" },
  "live-restore": true
}
EOF
  systemctl restart docker
fi
systemctl enable docker

printf '\n\033[1mFertig.\033[0m Nächste Schritte: docs/betrieb.md → „Server einrichten“ (Projekt klonen, .env, Backups, Überwachung).\n'
