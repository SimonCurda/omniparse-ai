#!/bin/bash
cd /home/z/my-project
exec node .next/standalone/server.js 2>/dev/null || \
NODE_OPTIONS="--max-old-space-size=256" exec npx next start -p 3000
