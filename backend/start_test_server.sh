#!/bin/bash
# Test server startup script that safely handles environment variables

set -e

# Navigate to backend directory
cd "$(dirname "$0")"

# Activate virtual environment
source venv/bin/activate

# Load environment variables safely using Python
python -c "
import os
try:
    with open('env', 'r') as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith('#') and '=' in line:
                key, value = line.split('=', 1)
                os.environ[key] = value
    
    # Start the server
    import subprocess
    subprocess.run([
        'python', '-m', 'uvicorn', 
        'src.agent.app:app', 
        '--host', '0.0.0.0', 
        '--port', '2024'
    ])
except Exception as e:
    print(f'Error starting server: {e}')
    exit(1)
"