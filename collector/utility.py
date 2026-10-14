"""Backward-compatible entry point: `python utility.py [--pdf] [--save-local] [--loop]`.

The code lives in the `collector` package (src/collector/utility.py). This wrapper keeps the
existing systemd unit and manual runs working without installing the package.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent / "src"))

from collector.utility import main

if __name__ == "__main__":
    main()
