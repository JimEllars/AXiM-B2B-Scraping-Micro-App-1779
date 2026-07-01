with open("worker.js", "r") as f:
    content = f.read()

# Fix self-triggering scrape opts passage
old = """body: JSON.stringify({ session_id, cursor: nextCursor, filters, opts })"""
new = """body: JSON.stringify({ session_id, cursor: nextCursor, filters, opts })"""
if content.count("""body: JSON.stringify({ session_id, cursor: nextCursor, filters })""") > 0:
    content = content.replace(
        """body: JSON.stringify({ session_id, cursor: nextCursor, filters })""",
        """body: JSON.stringify({ session_id, cursor: nextCursor, filters, opts })"""
    )

with open("worker.js", "w") as f:
    f.write(content)
print("opts passage fixed")
