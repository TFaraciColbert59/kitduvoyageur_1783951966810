#!/usr/bin/env python3
"""Lance une commande sous nice 10, mesure temps réel et pic de RAM (ru_maxrss des enfants). Usage: run_timed.py LOG -- cmd..."""
import sys, os, time, resource, subprocess
log = sys.argv[1]; cmd = sys.argv[sys.argv.index('--')+1:]
t = time.time()
with open(log, 'w') as f:
    p = subprocess.run(['nice','-n','10']+cmd, stdout=f, stderr=subprocess.STDOUT)
dt = time.time()-t
rss = resource.getrusage(resource.RUSAGE_CHILDREN).ru_maxrss/1024/1024
print(f"exit={p.returncode} wall={dt:.1f}s peak_rss={rss:.2f}GB")
