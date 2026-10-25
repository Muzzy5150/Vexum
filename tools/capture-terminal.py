"""Capture actual POSIX PTY output; render it with pyte/Pillow (optional developer tools)."""
import codecs, os, sys, pty, fcntl, termios, struct, subprocess, select, time, tempfile, pathlib, json
import pyte
from PIL import Image, ImageDraw, ImageFont
root = pathlib.Path(__file__).resolve().parent.parent
out = root / 'docs/screenshots'
out.mkdir(parents=True, exist_ok=True)
font_path = os.environ.get('VEXUM_SCREENSHOT_FONT', '/System/Library/Fonts/Menlo.ttc')
font = ImageFont.truetype(font_path, 17)
symbol_font = ImageFont.truetype('/System/Library/Fonts/Apple Symbols.ttf', 20)
width, height, cell, line = 120, 46, 11, 23
palette = dict(black='#10131a', red='#ff5468', green='#66dd9b', yellow='#efcf65', blue='#729cff', magenta='#ce8aff', cyan='#60d8e7', white='#d4d8df', default='#d4d8df', brightblack='#747d90', brightred='#ff7182', brightgreen='#86efac', brightyellow='#f8e39b', brightblue='#98b5ff', brightmagenta='#e6adff', brightcyan='#8ceaf2', brightwhite='#ffffff')
for name, request, expected in [('console', None, 'vexum>'), ('launcher', 'Coin Launcher', 'Coin Launcher Menu'), ('sniper', 'Coin Sniper', 'Coin Sniper Menu'), ('fud-txn-bot', 'FUD TXN BOT', 'Coming Soon')]:
    master, slave = pty.openpty()
    fcntl.ioctl(slave, termios.TIOCSWINSZ, struct.pack('HHHH', height, width, 0, 0))
    screen = pyte.Screen(width, height)
    stream = pyte.Stream(screen)
    decoder = codecs.getincrementaldecoder('utf8')()
    transcript = bytearray()
    with tempfile.TemporaryDirectory(prefix='vexum-capture-') as state:
        child = subprocess.Popen(['node', str(root/'bin/vexum.js')], stdin=slave, stdout=slave, stderr=slave, cwd=state, env={'PATH':os.environ['PATH'], 'TERM':'xterm-256color','LANG':'en_US.UTF-8','VEXUM_NO_BROADCAST':'1','VEXUM_HOME':state})
        os.close(slave)
        def until(text):
            stop=time.monotonic()+12
            while time.monotonic()<stop:
                if text in '\n'.join(screen.display): return
                ready,_,_=select.select([master],[],[],.1)
                if ready:
                    chunk=os.read(master,65536);transcript.extend(chunk);stream.feed(decoder.decode(chunk))
            raise RuntimeError('Missing terminal output: '+text)
        try:
            until('vexum>')
            if request:
                os.write(master,(request+'\r').encode());until(expected)
            quiet=time.monotonic()+.25
            while time.monotonic()<quiet:
                ready,_,_=select.select([master],[],[],.05)
                if ready:
                    chunk=os.read(master,65536);transcript.extend(chunk);stream.feed(decoder.decode(chunk));quiet=time.monotonic()+.25
            image=Image.new('RGB',(width*cell+40,height*line+40),'#10131a');draw=ImageDraw.Draw(image)
            for y in range(height):
                for x in range(width):
                    item=screen.buffer[y][x]
                    if item.data.strip():
                        color=palette.get(item.fg, '#'+item.fg if len(item.fg)==6 else '#d4d8df')
                        draw.text((20+x*cell,20+y*line),item.data,font=(symbol_font if any(0x2800 <= ord(c) <= 0x28ff for c in item.data) else font),fill=color)
            image.save(out/(name+'.png'))
            (out/(name+'.ansi')).write_bytes(transcript)
        finally:
            child.terminate();child.wait(timeout=5);os.close(master)
(out/'capture.json').write_text(json.dumps({'method':'actual POSIX PTY output interpreted by pyte and rendered by Pillow','dimensions':[width,height],'privateInput':False,'broadcast':'disabled','screens':['console','launcher','sniper','fud-txn-bot']},indent=2)+'\n')
