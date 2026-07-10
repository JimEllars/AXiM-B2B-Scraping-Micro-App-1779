import subprocess
print(subprocess.run(["python3", "code_review.py"], capture_output=True).stdout.decode('utf-8'))
