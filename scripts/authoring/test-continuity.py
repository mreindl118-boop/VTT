"""Regression checks for the imported camp postprocessor; uses isolated copies."""
import importlib.util
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


class CampContinuity(unittest.TestCase):
    def test_repeat_generation_is_identical(self):
        with tempfile.TemporaryDirectory(prefix='mistlab-camp-') as folder:
            root = Path(folder)
            script = root / 'scripts/authoring/camp-continuity.py'
            script.parent.mkdir(parents=True)
            shutil.copyfile(ROOT / 'scripts/authoring/camp-continuity.py', script)
            data = root / 'locations/ch02/G'
            shutil.copytree(ROOT / 'locations/ch02/G', data)
            subprocess.run([sys.executable, str(script)], check=True, capture_output=True)
            first = [(data / name).read_bytes() for name in ('scene.json', 'grid.json')]
            subprocess.run([sys.executable, str(script)], check=True, capture_output=True)
            self.assertEqual(first, [(data / name).read_bytes() for name in ('scene.json', 'grid.json')])

    def test_no_new_camp_outdoor_flags(self):
        spec = importlib.util.spec_from_file_location('outdoor', ROOT / 'scripts/authoring/audit-outdoor.py')
        audit = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(audit)
        self.assertEqual([], audit.audit(str(ROOT / 'locations/ch02/G/scene.json')))


if __name__ == '__main__':
    unittest.main()
