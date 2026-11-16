#!/usr/bin/env bash
# Nightly backup of the self-hosted Supabase (D-082): the whole database (users, lists, reference
# data) as a pg_dump custom archive, and the Storage files (profile photos, covers). Keeps the last
# 14 of each in /opt/travelist-supabase/backups. Installed by scripts/install-supabase-vps.sh as
# /etc/cron.d/travelist-supabase.
#
# Restore (README → "Self-hosted Supabase" → "Backups"):
#   docker exec -i supabase-db pg_restore -U supabase_admin -d postgres --clean --if-exists < db-<stamp>.dump
#   tar -xzf storage-<stamp>.tar.gz -C /opt/travelist-supabase/docker/volumes
set -euo pipefail

BACKUP_DIR=/opt/travelist-supabase/backups
VOLUMES_DIR=/opt/travelist-supabase/docker/volumes
KEEP=14
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"

mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"
docker exec supabase-db pg_dump -U supabase_admin -d postgres -Fc >"$BACKUP_DIR/db-$STAMP.dump"
tar -czf "$BACKUP_DIR/storage-$STAMP.tar.gz" -C "$VOLUMES_DIR" storage

# Newest first; everything after the first $KEEP of a kind goes.
for kind in db storage; do
  ls -1t "$BACKUP_DIR/$kind-"* | tail -n +$((KEEP + 1)) | xargs -r rm -f
done
