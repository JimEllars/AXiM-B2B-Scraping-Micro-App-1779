import re

with open('worker.js', 'r') as f:
    content = f.read()

# 1. Update corsHeaders and origin checking
cors_match = re.search(r"const corsHeaders = \{.*?\};", content, re.DOTALL)
if cors_match:
    cors_original = cors_match.group(0)
    # We remove the wildcard fallback from the headers in the options preflight and instead dynamically check
    # But wait, the instructions say "If env.FRONTEND_URL is unavailable, reject the request with a explicit origin mismatch validation layout instead of falling back to a wildcard *"
    # Let's adjust this logic.
