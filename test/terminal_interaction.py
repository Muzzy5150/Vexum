import os, subprocess, select, time, json, sys, re, tempfile
if os.name == 'nt':
    print('SKIP: POSIX PTY interaction tests require macOS or Linux')
    sys.exit(0)
import pty
root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
results = []
for request, expected, down, up in [
    ('Coin Launcher', 'Coin Launcher Menu', '▶ Wallets', '▶ Coin MetaData'),
    ('Coin Sniper', 'Coin Sniper Menu', '▶ Sniper Mainnet Wallet', '▶ Snipe Ticker/Name'),
    ('FUD TXN BOT', 'Coming Soon', None, None),
]:
    master, slave = pty.openpty()
    with tempfile.TemporaryDirectory(prefix='vexum-pty-') as state:
        child = subprocess.Popen(['node', root+'/bin/vexum.js'], stdin=slave, stdout=slave, stderr=slave, cwd=tempfile.gettempdir(), env={**os.environ, 'VEXUM_NO_BROADCAST':'1', 'VEXUM_HOME':state})
        os.close(slave)
        buf = b''
        def until(text):
            global buf
            stop = time.monotonic()+8
            while time.monotonic()<stop:
                plain = re.sub(r'\x1b\[[0-9;]*[A-Za-z]', '', buf.decode(errors='replace'))
                if text in plain:
                    return
                ready, _, _ = select.select([master], [], [], .1)
                if ready:
                    try:
                        buf += os.read(master, 65536)
                    except OSError:
                        break
            raise AssertionError('Expected terminal state missing: '+text)
        try:
            until('vexum>')
            os.write(master, (request+'\r').encode())
            until(expected)
            time.sleep(.1)
            if down:
                buf = b''
                os.write(master, b'\x1b[B')
                until(down)
                buf = b''
                os.write(master, b'\x1b[A')
                until(up)
            buf = b''
            os.write(master, b'\x1b')
            until('vexum>')
            os.write(master, b'exit\r')
            # Keep consuming the PTY while waiting: a child flushing terminal output
            # can block on the hosted runner's smaller PTY buffer if the parent waits.
            deadline = time.monotonic()+10
            while child.poll() is None and time.monotonic() < deadline:
                ready, _, _ = select.select([master], [], [], .1)
                if ready:
                    try:
                        buf += os.read(master, 65536)
                    except OSError:
                        break
            assert child.poll() is not None, 'CLI did not exit after '+request+': '+repr(buf[-2000:])
            assert child.returncode == 0
            assert b'Exportable Private Key' not in buf
            results.append({'menu':request, 'startup_navigation_return_exit':'passed'})
        finally:
            if child.poll() is None:
                child.kill()
                child.wait()
            os.close(master)
print(json.dumps(results, indent=2))
