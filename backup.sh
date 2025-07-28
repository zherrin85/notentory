#!/bin/bash

# Backup script for Notentory - Shift Notes & Inventory System
# Usage: ./backup.sh [manual|auto] [description]

set -e  # Exit on any error

# Configuration
BACKUP_DIR="/opt/shift-notes/backups"
DB_NAME="${DB_NAME:-shift_notes_db}"
DB_USER="${DB_USER:-shift_user}"
DB_PASSWORD="${DB_PASSWORD:-your_database_password_here}"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_TYPE="${1:-auto}"
DESCRIPTION="${2:-$BACKUP_TYPE backup}"

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

# Logging function
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$BACKUP_DIR/backup.log"
}

# Error handling
cleanup() {
    log "Backup process interrupted"
    exit 1
}

trap cleanup SIGINT SIGTERM

log "Starting $BACKUP_TYPE backup: $DESCRIPTION"

# Database backup
log "Creating database backup..."
DB_BACKUP_FILE="$BACKUP_DIR/database_backup_${DATE}.sql"
if mysqldump -u"$DB_USER" -p"$DB_PASSWORD" "$DB_NAME" > "$DB_BACKUP_FILE" 2>/dev/null; then
    log "Database backup created: $(basename "$DB_BACKUP_FILE")"
else
    log "ERROR: Database backup failed"
    exit 1
fi

# Uploads backup (if uploads directory exists)
UPLOADS_DIR="/opt/shift-notes/uploads"
if [ -d "$UPLOADS_DIR" ] && [ "$(ls -A "$UPLOADS_DIR" 2>/dev/null)" ]; then
    log "Creating uploads backup..."
    UPLOADS_BACKUP_FILE="$BACKUP_DIR/uploads_backup_${DATE}.tar.gz"
    if tar -czf "$UPLOADS_BACKUP_FILE" -C /opt/shift-notes uploads/ 2>/dev/null; then
        log "Uploads backup created: $(basename "$UPLOADS_BACKUP_FILE")"
    else
        log "WARNING: Uploads backup failed"
    fi
else
    log "No uploads directory found, skipping uploads backup"
fi

# Create backup metadata
METADATA_FILE="$BACKUP_DIR/backup_metadata_${DATE}.json"
cat > "$METADATA_FILE" << EOF
{
    "backup_type": "$BACKUP_TYPE",
    "description": "$DESCRIPTION",
    "timestamp": "$(date -Iseconds)",
    "files": [
        "$(basename "$DB_BACKUP_FILE")"
EOF

if [ -f "$UPLOADS_BACKUP_FILE" ]; then
    echo "        ,\"$(basename "$UPLOADS_BACKUP_FILE")\"" >> "$METADATA_FILE"
fi

echo "    ]" >> "$METADATA_FILE"
echo "}" >> "$METADATA_FILE"

# Clean old backups (keep 30 days by default)
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-30}"
log "Cleaning backups older than $RETENTION_DAYS days..."

find "$BACKUP_DIR" -name "database_backup_*.sql" -mtime +$RETENTION_DAYS -delete 2>/dev/null || true
find "$BACKUP_DIR" -name "uploads_backup_*.tar.gz" -mtime +$RETENTION_DAYS -delete 2>/dev/null || true
find "$BACKUP_DIR" -name "backup_metadata_*.json" -mtime +$RETENTION_DAYS -delete 2>/dev/null || true

# Calculate backup sizes
DB_SIZE=$(du -h "$DB_BACKUP_FILE" | cut -f1)
if [ -f "$UPLOADS_BACKUP_FILE" ]; then
    UPLOADS_SIZE=$(du -h "$UPLOADS_BACKUP_FILE" | cut -f1)
    log "Backup completed successfully - Database: $DB_SIZE, Uploads: $UPLOADS_SIZE"
else
    log "Backup completed successfully - Database: $DB_SIZE"
fi

# Return success
exit 0 