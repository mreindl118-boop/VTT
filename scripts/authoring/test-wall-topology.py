#!/usr/bin/env python3
"""Focused authorlib geometry regressions; run directly with Python, without regeneration."""
import builtins
import contextlib
import copy
import io
from pathlib import Path
import runpy
import unittest
from unittest.mock import patch

from authorlib import Level, rect


def on_segment(point, wall):
    a, b = wall['a'], wall['b']
    dx, dz = b[0] - a[0], b[1] - a[1]
    px, pz = point[0] - a[0], point[1] - a[1]
    return (abs(dx * pz - dz * px) < 1e-7
            and -1e-7 <= px * dx + pz * dz <= dx * dx + dz * dz + 1e-7)


class WallTopologyTests(unittest.TestCase):
    def level(self):
        return Level('ground', 'Fixture', 0, 10, interior='plaster', exterior='rubble')

    def aperture(self, walls, wid, a, b, flags, opened=None):
        door = [w for w in walls if w['id'] == wid]
        self.assertEqual(len(door), 1, wid)
        self.assertEqual((door[0]['a'], door[0]['b']), (list(a), list(b)))
        self.assertEqual(door[0]['flags'], flags)
        if opened is not None:
            self.assertEqual(door[0]['open'], opened)
        # Interior samples must belong only to this aperture, never a residual normal wall.
        for t in (0.1, 0.35, 0.5, 0.75, 0.9):
            p = [a[i] + t * (b[i] - a[i]) for i in (0, 1)]
            self.assertEqual([w['id'] for w in walls if on_segment(p, w)], [wid])

    def test_fractional_room_subdivisions_do_not_seal_open_door(self):
        # The N2 kitchen/storage style: adjacent polygons divide their shared line differently.
        lv = self.level()
        lv.room('a', 'A', rect(12, 2, 21, 8.5))
        lv.room('b', 'B', rect(15.5, 8.5, 21, 20))
        lv.door((17, 8.5), (18, 8.5), id='kitchen', open=True)
        walls = lv.build_walls()
        self.aperture(walls, 'kitchen', (85, 42.5), (90, 42.5), ['door'], True)
        self.assertTrue(any(on_segment((82, 42.5), w) and w['flags'] == ['normal'] for w in walls))
        self.assertTrue(any(on_segment((96, 42.5), w) and w['flags'] == ['normal'] for w in walls))

    def test_aperture_splits_a_diagonal_without_removing_its_ends(self):
        lv = self.level()
        lv.room('a', 'A', [(0, 0), (6, 6), (0, 6)])
        lv.door((2, 2), (4, 4), id='diagonal', locked=True)
        walls = lv.build_walls()
        self.aperture(walls, 'diagonal', (10, 10), (20, 20), ['door', 'locked'], False)
        for p in ((5, 5), (25, 25)):
            self.assertTrue(any(on_segment(p, w) and w['flags'] == ['normal'] for w in walls))

    def test_closed_locked_and_secret_apertures_keep_their_state_and_identity(self):
        lv = self.level()
        lv.room('a', 'A', rect(0, 0, 8.5, 3))
        lv.room('b', 'B', rect(0.5, 3, 8.5, 6))
        lv.door((1, 3), (2, 3), id='closed')
        lv.door((3, 3), (4, 3), id='locked', locked=True)
        lv.secret((5, 3), (6, 3), 'panel', 'Fixture panel', 'a')
        walls = lv.build_walls()
        self.aperture(walls, 'closed', (5, 15), (10, 15), ['door'], False)
        self.aperture(walls, 'locked', (15, 15), (20, 15), ['door', 'locked'], False)
        self.aperture(walls, 'ground-sd-panel', (25, 15), (30, 15), ['secret-door'])
        self.assertEqual(lv.objects[0]['wall'], 'ground-sd-panel')

    def test_extra_secret_replaces_only_the_coincident_normal_interval(self):
        lv = self.level()
        lv.room('a', 'A', rect(0, 0, 4, 4))
        lv.secret((1, 0), (2, 0), 'extra', 'Fixture panel', 'a', extra=True)
        walls = lv.build_walls()
        self.aperture(walls, 'ground-sd-extra', (5, 0), (10, 0), ['secret-door'])
        self.assertTrue(any(on_segment((17, 0), w) and w['flags'] == ['normal'] for w in walls))

    def test_extra_partition_can_take_a_door_without_losing_other_portions(self):
        lv = self.level()
        lv.room('a', 'A', rect(0, 0, 6, 6))
        lv.wall((0, 3), (6, 3), id='partition', heightFt=9)
        lv.door((2, 3), (3, 3), id='partition-door')
        walls = lv.build_walls()
        self.aperture(walls, 'partition-door', (10, 15), (15, 15), ['door'], False)
        for p in ((5, 15), (25, 15)):
            self.assertTrue(any(on_segment(p, w) and w.get('heightFt') == 9 for w in walls))
        self.assertEqual(len({w['id'] for w in walls}), len(walls))

    def test_missing_or_partly_supported_apertures_fail_loudly(self):
        for kind in ('door', 'window', 'secret'):
            for a, b in (((7, 0), (8, 0)), ((3.5, 0), (4.5, 0))):
                with self.subTest(kind=kind, a=a):
                    lv = self.level()
                    lv.room('a', 'A', rect(0, 0, 4, 4))
                    if kind == 'door':
                        lv.door(a, b, id='missing')
                    elif kind == 'window':
                        lv.window(a, b)
                    else:
                        lv.secret(a, b, 'missing', 'Fixture panel', 'a')
                    with self.assertRaisesRegex(ValueError, 'unconsumed|unsupported'):
                        lv.build_walls()

    def test_reused_door_identity_cannot_bridge_a_gap(self):
        lv = self.level()
        lv.room('a', 'A', rect(0, 0, 8, 4))
        lv.door((1, 0), (2, 0), id='reused')
        lv.door((4, 0), (5, 0), id='reused')
        with self.assertRaisesRegex(ValueError, 'disjoint|contiguous'):
            lv.build_walls()

    def test_split_ids_reserve_authored_partition_and_door_names(self):
        for kind in ('partition', 'door'):
            with self.subTest(kind=kind):
                lv = self.level()
                lv.room('a', 'A', rect(0, 0, 8, 6))
                lv.wall((0, 3), (6, 3), id='partition', heightFt=9)
                lv.door((2, 3), (3, 3), id='cut')
                if kind == 'partition':
                    lv.wall((7, 1), (7, 2), id='partition-part-2', heightFt=4)
                else:
                    lv.door((1, 0), (2, 0), id='partition-part-2', locked=True)
                walls = lv.build_walls()
                self.assertEqual(len({w['id'] for w in walls}), len(walls))
                preserved = next(w for w in walls if w['id'] == 'partition-part-2')
                self.assertEqual(preserved['flags'], ['normal'] if kind == 'partition' else ['door', 'locked'])

    def test_generated_wall_ids_do_not_rename_an_authored_door(self):
        lv = self.level()
        lv.room('a', 'A', rect(0, 0, 4, 4))
        lv.door((1, 0), (2, 0), id='ground-w-0', locked=True)
        walls = lv.build_walls()
        self.aperture(walls, 'ground-w-0', (5, 0), (10, 0), ['door', 'locked'], False)
        self.assertEqual(len({w['id'] for w in walls}), len(walls))

    def test_room_opening_preserves_an_explicit_rail(self):
        lv = self.level()
        lv.room('a', 'A', rect(0, 0, 4, 4))
        lv.opening((0, 0), (4, 0))
        lv.wall((1, 0), (3, 0), id='rail', heightFt=3.5)
        walls = lv.build_walls()
        for p in ((6, 0), (9, 0), (11, 0), (14, 0)):
            hits = [w for w in walls if on_segment(p, w)]
            self.assertEqual(len(hits), 1)
            self.assertEqual(hits[0]['heightFt'], 3.5)
            self.assertEqual(hits[0]['flags'], ['normal'])
        for p in ((2, 0), (18, 0)):
            self.assertFalse(any(on_segment(p, w) for w in walls))

    @staticmethod
    def j_ground():
        # Execute the real generator, suppressing every write and deferring wall
        # construction so the raw Level can be tested without normalizing input.
        levels = []
        init, real_open = Level.__init__, builtins.open
        def capture(lv, *args, **kwargs):
            init(lv, *args, **kwargs)
            levels.append(lv)
        def memory_open(file, mode='r', *args, **kwargs):
            if any(k in mode for k in 'wax+'):
                return io.BytesIO() if 'b' in mode else io.StringIO()
            return real_open(file, mode, *args, **kwargs)
        with patch.object(Level, '__init__', capture), patch.object(Level, 'build_walls', return_value=[]), \
                patch('builtins.open', memory_open), patch('os.makedirs'), contextlib.redirect_stdout(io.StringIO()):
            runpy.run_path(str(Path(__file__).with_name('wild_j.py')), run_name='__main__')
        return levels[0]

    def test_j_keeps_all_fourteen_coincident_invisible_and_ethereal_layers(self):
        lv = copy.deepcopy(self.j_ground())
        # Isolate the layer regression from the independently tested raw duplicate vertex.
        lv.rooms = [(key, name, [v for i, v in enumerate(poly) if v != poly[i - 1]], floor, extra)
                    for key, name, poly, floor, extra in lv.rooms]
        walls = lv.build_walls()
        for flag in ('invisible', 'ethereal'):
            self.assertEqual(sum(w['flags'] == [flag] for w in walls), 14)
        gate = [w for w in walls if w['a'] == [450, 0] and w['b'] == [450, 165]]
        self.assertEqual({tuple(w['flags']) for w in gate}, {('invisible',), ('ethereal',)})

    def test_raw_j_duplicate_vertex_does_not_become_a_wall(self):
        lv = self.j_ground()
        self.assertTrue(any(a == b for _, _, poly, _, _ in lv.rooms for a, b in zip(poly, poly[1:])))
        walls = lv.build_walls()
        self.assertTrue(walls)
        self.assertTrue(all(w['a'] != w['b'] for w in walls))

    def test_explicit_zero_length_walls_and_apertures_still_fail(self):
        for kind in ('wall', 'door', 'window', 'secret'):
            with self.subTest(kind=kind):
                lv = self.level()
                lv.room('a', 'A', rect(0, 0, 4, 4))
                if kind == 'secret':
                    lv.secret((1, 0), (1, 0), 'zero', 'Fixture', 'a')
                else:
                    getattr(lv, kind)((1, 0), (1, 0))
                with self.assertRaisesRegex(ValueError, 'Zero-length'):
                    lv.build_walls()

    def test_unrelated_integer_fixture_preserves_wall_ids_and_geometry(self):
        lv = self.level()
        lv.room('a', 'A', rect(0, 0, 4, 4))
        lv.door((1, 0), (2, 0), id='entry')
        self.assertEqual([(w['id'], w['a'], w['b']) for w in lv.build_walls()], [
            ('ground-w-0', [0, 0], [5, 0]), ('entry', [5, 0], [10, 0]),
            ('ground-w-2', [10, 0], [20, 0]), ('ground-w-3', [20, 0], [20, 20]),
            ('ground-w-4', [15, 20], [20, 20]), ('ground-w-5', [10, 20], [15, 20]),
            ('ground-w-6', [5, 20], [10, 20]), ('ground-w-7', [0, 20], [5, 20]),
            ('ground-w-8', [0, 15], [0, 20]), ('ground-w-9', [0, 10], [0, 15]),
            ('ground-w-10', [0, 5], [0, 10]), ('ground-w-11', [0, 0], [0, 5]),
        ])


if __name__ == '__main__':
    unittest.main(verbosity=2)
