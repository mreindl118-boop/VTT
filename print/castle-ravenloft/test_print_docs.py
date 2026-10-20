"""Checks on what the print set says about itself: the README states what is checked, the previews name each part.

    python3 -m unittest discover -s print/castle-ravenloft -p 'test_*.py'
"""
import os
import sys
import tempfile
import types
import unittest

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import build  # noqa: E402
import preview  # noqa: E402


class PrintDocs(unittest.TestCase):
    def readme(self):
        cfg = types.SimpleNamespace(cell=25.4, pitch=32, slab=3, clear=29, wall=3, tower_wall=4, bed=250, courtyard='apron', sub_tray='crop', masonry='on')
        with tempfile.TemporaryDirectory(prefix='mistlab-print-') as d:
            build.write_readme(types.SimpleNamespace(out=d), cfg, {}, [], {})
            with open(os.path.join(d, 'README.md')) as f:
                return f.read()

    def test_readme_says_what_the_manifold_check_is(self):
        # every file passes manifold3d's check, but a tile can hold two solids of one colour touching along an edge,
        # which some slicers report as non-manifold edges: the README says what is checked, not that all is manifold
        text = self.readme()
        self.assertNotIn('Everything is manifold', text)
        self.assertIn("manifold3d's check", text)
        self.assertIn('touch along an edge', text)

    def test_preview_titles_name_the_level_and_its_parts(self):
        self.assertEqual(preview.title_of('court', {'name': 'Court of the Count (+50 ft)', 'tiles': 4}), 'court  Court of the Count (+50 ft)  (4 tiles)')
        # the mountain base has pieces, not tiles, and no level name
        self.assertEqual(preview.title_of('base', {'pieces': 6}), 'base  the mountain  (6 pieces)')


if __name__ == '__main__':
    unittest.main()
