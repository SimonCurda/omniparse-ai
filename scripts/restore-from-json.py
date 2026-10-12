#!/usr/bin/env python3
"""
OmniParse AI — JSON Backup Restore Script
Imports a JSON backup file into Supabase PostgreSQL via SQL INSERT statements.

Usage:
  python3 scripts/restore-from-json.py <backup.json> <DATABASE_URL>

The script:
1. Fixes truncated JSON (closes open arrays/objects)
2. Generates SQL INSERT statements for each table
3. Prints the SQL to stdout — paste into Supabase SQL Editor
"""

import json
import sys
import re
from datetime import datetime

def fix_truncated_json(text):
    """Try to fix truncated JSON by closing open arrays and objects."""
    # Remove trailing comma
    text = text.rstrip()
    if text.endswith(','):
        text = text[:-1]
    
    # Count open/close brackets
    open_braces = text.count('{')
    close_braces = text.count('}')
    open_brackets = text.count('[')
    close_brackets = text.count(']')
    
    # Close open arrays and objects
    text += ']' * max(0, open_brackets - close_brackets)
    text += '}' * max(0, open_braces - close_braces)
    
    return text

def escape_sql(value):
    """Escape a value for SQL INSERT."""
    if value is None:
        return 'NULL'
    if isinstance(value, bool):
        return 'TRUE' if value else 'FALSE'
    if isinstance(value, (int, float)):
        return str(value)
    if isinstance(value, str):
        # Escape single quotes
        return "'" + value.replace("'", "''") + "'"
    # JSON objects/arrays — convert to JSON string
    return "'" + json.dumps(value).replace("'", "''") + "'"

def generate_sql(data):
    """Generate SQL INSERT statements from the backup data."""
    sql_lines = []
    sql_lines.append('-- OmniParse AI — Backup Restore')
    sql_lines.append(f'-- Generated: {datetime.now().isoformat()}')
    sql_lines.append('-- Paste this entire file into Supabase SQL Editor and click Run')
    sql_lines.append('')
    
    # Map JSON table names to PostgreSQL table names
    table_map = {
        'users': 'User',
        'invoices': 'Invoice',
        'chatSessions': 'ChatSession',
        'chatMessages': 'ChatMessage',
        'emailInboxes': 'EmailInbox',
        'pendingReviews': 'PendingReview',
        'auditLogs': 'AuditLog',
        'approvalRules': 'ApprovalRule',
        'customRules': 'CustomRule',
        'entities': 'Entity',
        'exportTemplates': 'ExportTemplate',
        'customStatuses': 'CustomStatus',
        'stripeEvents': 'StripeEvent',
        'apiKeys': 'ApiKey',
        'emailBlocklist': 'EmailBlocklist',
        'adminDeletionLogs': 'AdminDeletionLog',
        'aiProviderConfigs': 'AiProviderConfig',
    }
    
    for json_table, pg_table in table_map.items():
        if json_table not in data:
            continue
        
        records = data[json_table]
        if not records or not isinstance(records, list):
            continue
        
        sql_lines.append(f'-- ─── {pg_table} ({len(records)} records) ───')
        
        for record in records:
            if not isinstance(record, dict):
                continue
            
            columns = list(record.keys())
            values = [escape_sql(record.get(col)) for col in columns]
            
            # Quote column names (PostgreSQL requires it for camelCase)
            quoted_cols = ', '.join(f'"{c}"' for c in columns)
            values_str = ', '.join(values)
            
            sql_lines.append(
                f'INSERT INTO "{pg_table}" ({quoted_cols}) VALUES ({values_str}) '
                f'ON CONFLICT ("id") DO NOTHING;'
            )
        
        sql_lines.append('')
    
    return '\n'.join(sql_lines)

def main():
    if len(sys.argv) < 2:
        print(f'Usage: {sys.argv[0]} <backup.json>')
        sys.exit(1)
    
    filename = sys.argv[1]
    
    with open(filename, 'r') as f:
        raw_text = f.read()
    
    # Try to parse as-is first
    try:
        data = json.loads(raw_text)
        print('-- JSON parsed successfully (no truncation)', file=sys.stderr)
    except json.JSONDecodeError as e:
        print(f'-- JSON parse failed: {e}', file=sys.stderr)
        print('-- Attempting to fix truncated JSON...', file=sys.stderr)
        
        # Try to fix
        fixed_text = fix_truncated_json(raw_text)
        try:
            data = json.loads(fixed_text)
            print('-- Fixed JSON parsed successfully', file=sys.stderr)
        except json.JSONDecodeError as e2:
            print(f'-- Could not fix JSON: {e2}', file=sys.stderr)
            print('-- File is too corrupted. Please re-download the complete backup.', file=sys.stderr)
            sys.exit(1)
    
    # Generate SQL
    sql = generate_sql(data)
    print(sql)

if __name__ == '__main__':
    main()
