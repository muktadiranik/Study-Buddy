import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import process from "node:process";

export default function setup() {
  const python =
    process.env.PYTHON_BIN ??
    resolve(
      process.platform === "win32"
        ? ".venv/Scripts/python.exe"
        : ".venv/bin/python",
    );
  // Regenerate synthetic upload fixtures so a fresh checkout can run these tests.
  execFileSync(python, ["-m", "backend.tests.pdf_fixtures"], {
    cwd: process.cwd(),
    stdio: "pipe",
    windowsHide: true,
  });
  execFileSync(python, ["-m", "backend.tests.ocr_fixtures"], {
    cwd: process.cwd(),
    stdio: "pipe",
    windowsHide: true,
  });
}
