for s in 1 2 3; do for a in dense mod fib oracle; do .venv/bin/python retention_probe.py $a $s 4096; done; done
for s in 1 2 3; do for a in mod fib; do .venv/bin/python retention_probe.py $a $s 65536; done; done
