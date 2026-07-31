#!/bin/bash
# Database Backup Setup for Flasqo Production
# Run these commands on the server as root

echo "=== Flasqo Database Backup Setup ==="

# 1. Create backup directory
echo "[1/5] Creating backup directory..."
mkdir -p /home/flasqo/backups
chown flasqo:flasqo /home/flasqo/backups

# 2. Create backup script
echo "[2/5] Creating backup script..."
cat > /home/flasqo/backup.sh << 'EOF'
#!/bin/bash
# Flasqo Database Backup Script

BACKUP_DIR="/home/flasqo/backups"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/flasqo_db_$DATE.sql.gz"
LOG_FILE="$BACKUP_DIR/backup.log"

echo "[$(date)] Starting backup..." >> "$LOG_FILE"

# Perform backup
sudo -u postgres pg_dump flasqo_db | gzip > "$BACKUP_FILE"

if [ $? -eq 0 ]; then
    echo "[$(date)] Backup successful: $BACKUP_FILE" >> "$LOG_FILE"

    # Delete backups older than 7 days
    find "$BACKUP_DIR" -name "flasqo_db_*.sql.gz" -mtime +7 -delete
    echo "[$(date)] Old backups cleaned up" >> "$LOG_FILE"
else
    echo "[$(date)] Backup FAILED!" >> "$LOG_FILE"
    exit 1
fi
EOF

# 3. Make script executable
echo "[3/5] Setting permissions..."
chmod +x /home/flasqo/backup.sh
chown flasqo:flasqo /home/flasqo/backup.sh

# 4. Test backup manually
echo "[4/5] Testing backup (this may take 30 seconds)..."
sudo -u flasqo /home/flasqo/backup.sh

# Check if backup file was created
LATEST_BACKUP=$(ls -t /home/flasqo/backups/flasqo_db_*.sql.gz 2>/dev/null | head -1)
if [ -f "$LATEST_BACKUP" ]; then
    SIZE=$(du -h "$LATEST_BACKUP" | cut -f1)
    echo "✅ Backup successful! File: $LATEST_BACKUP (Size: $SIZE)"
else
    echo "❌ Backup failed! Check /home/flasqo/backups/backup.log"
    exit 1
fi

# 5. Set up daily cron job (2 AM)
echo "[5/5] Setting up daily cron job..."
(crontab -u flasqo -l 2>/dev/null; echo "0 2 * * * /home/flasqo/backup.sh") | crontab -u flasqo -

echo ""
echo "=== Setup Complete ==="
echo "✅ Backup script created: /home/flasqo/backup.sh"
echo "✅ First backup created: $LATEST_BACKUP"
echo "✅ Daily cron job scheduled (2 AM)"
echo "✅ Retention: 7 days"
echo ""
echo "To manually run backup: sudo -u flasqo /home/flasqo/backup.sh"
echo "To view backup log: cat /home/flasqo/backups/backup.log"
echo "To list backups: ls -lh /home/flasqo/backups/"
