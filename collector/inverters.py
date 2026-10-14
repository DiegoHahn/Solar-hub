"""Backward-compatible entry point: `python inverters.py [--once] [--save-local]`.

The code lives in the `collector` package (src/collector/inverters.py). This wrapper keeps the
existing systemd unit and manual runs working without installing the package.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent / "src"))

from collector.inverters import main

if __name__ == "__main__":
    main()
