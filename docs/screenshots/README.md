These PNGs render actual PTY captures of the built CLI; corresponding `.ansi` files contain the original terminal stream. They demonstrate interface appearance only. Functional evidence is in the test and protocol reports. FUD TXN BOT is intentionally Coming Soon.

Regenerate on macOS after building, in a separate Python virtual environment:

```sh
python3 -m venv /tmp/vexum-screens
/tmp/vexum-screens/bin/pip install -r tools/screenshot-requirements.txt
/tmp/vexum-screens/bin/python tools/capture-terminal.py
```

The capture process uses an empty temporary wallet/state directory, a sanitized environment and disabled broadcasts. Rendering uses the system Menlo and Apple Symbols fonts; they are not redistributed. Other platforms require equivalent fonts and a POSIX PTY. Native Windows screenshot capture is unsupported.
