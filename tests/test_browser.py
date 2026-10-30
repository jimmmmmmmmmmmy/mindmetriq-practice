"""Browser regressions. Run: python3 -m unittest discover -s tests -p test_browser.py -v"""
import functools
from datetime import datetime, timezone
import math
from pathlib import Path
import threading
import unittest
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
GAMES = {
    'net-the-numbers': ('net', 12, 20),
    'number-racer': ('racer', 12, None),
    'link-swipe': ('swipe', 15, 6),
    'word-logic': ('wordlogic', 15, 15),
    'pipe-puzzle': ('pipes', 10, 20),
    'shape-spinner': ('spinner', 10, 12),
}

class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass

class BrowserTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        handler = functools.partial(QuietHandler, directory=str(ROOT))
        cls.server = ThreadingHTTPServer(('127.0.0.1', 0), handler)
        threading.Thread(target=cls.server.serve_forever, daemon=True).start()
        cls.base = f'http://127.0.0.1:{cls.server.server_port}/'
        cls.pw = sync_playwright().start()
        cls.browser = cls.pw.chromium.launch()

    @classmethod
    def tearDownClass(cls):
        cls.browser.close()
        cls.pw.stop()
        cls.server.shutdown()
        cls.server.server_close()

    def setUp(self):
        self.context = self.browser.new_context(viewport={'width': 390, 'height': 844}, has_touch=True)
        self.page = self.context.new_page()
        self.errors = []
        self.page.on('pageerror', lambda error: self.errors.append(str(error)))
        self.page.clock.install()
        self.page.clock.pause_at(datetime.now(timezone.utc))

    def tearDown(self):
        self.context.close()
        self.assertEqual(self.errors, [])

    def start(self, game, mode='practice'):
        self.page.goto(self.base + game + '.html?debug=1')
        # Wrap the installed clock, after navigation; init-script ordering is undefined.
        self.page.evaluate('''() => {
          const scheduledRAF = window.requestAnimationFrame.bind(window);
          window.requestAnimationFrame = cb => scheduledRAF(t => { if (!window.freezeRAF) cb(t); });
        }''')
        self.page.locator(f'[data-mode={mode}]').click()
        self.assertEqual(self.page.locator('#sGame').get_attribute('class'), 'screen on')

    def correct(self, game):
        page = self.page
        if game == 'net-the-numbers':
            page.evaluate('''() => { const g=__game; g.move(...g.item.bp,true); g.submit(); }''')
        elif game == 'shape-spinner':
            page.evaluate('() => { __game.turn(__game.item.sol); __game.submit(); }')
        elif game == 'pipe-puzzle':
            page.evaluate('() => __game.solve()')
        elif game == 'link-swipe':
            page.evaluate('() => __game.choose(__game.item[2])')
        elif game == 'word-logic':
            answer = page.evaluate('__game.item.b[4]')
            page.locator('.opt').filter(has_text=answer).first.click()
        else:
            self.drive_racer()

    def drive_racer(self, selected_indices=None):
        page = self.page
        item = page.evaluate('__game.item')
        chosen = item['sol'] if selected_indices is None else selected_indices
        page.clock.fast_forward(max(0, math.ceil((item['plan']-page.evaluate('H.elapsed()')) * 1000)))
        for k, x in enumerate(item['xs']):
            desired = x if k in chosen else (286 if x < 180 else 74)
            car = page.evaluate('__game.item.car')
            key = 'ArrowRight' if desired > car else 'ArrowLeft'
            page.keyboard.down(key)
            page.clock.run_for(round(abs(desired-car)/330*1000))
            page.keyboard.up(key)
            elapsed = page.evaluate('H.elapsed()')
            end = item['plan'] + (k+1)*item['fallT']
            page.clock.run_for(max(0, math.ceil((end-elapsed)*1000)+1))
        page.clock.run_for(32)  # Let the next animation frame submit the final sum.
        self.assertTrue(page.evaluate('H.done'))
        self.assertEqual(page.evaluate('__game.item.got'), chosen)

    def test_all_games_complete_three_correct_practice_items_and_restart(self):
        for game, (game_id, _, _) in GAMES.items():
            with self.subTest(game=game):
                self.start(game)
                for _ in range(3):
                    self.correct(game)
                    self.page.clock.fast_forward(1400)
                self.assertEqual(self.page.locator('#endScore').inner_text(), '3 / 3')
                record = self.page.evaluate(f'MMQHistory.read("{game_id}").at(-1)')
                self.assertEqual((record['score'], record['total'], record['mode']), (3, 3, 'practice'))
                self.page.evaluate('window.completedItem = __game.item')
                self.page.locator('#again').click()
                self.assertEqual(self.page.locator('#hNum').inner_text(), '1')
                self.assertTrue(self.page.evaluate('__game.item !== window.completedItem'))
                self.assertFalse(self.page.evaluate('H.done'))

    def wrong(self, game):
        if game == 'net-the-numbers':
            self.page.evaluate("""() => { const g=__game; const p=MMQLogic.net.placements(g.item.sh).find(([x,y])=>MMQLogic.net.sumAt(g.item.g,g.item.sh,x,y)!==g.item.best); g.move(...p,true); g.submit(); }""")
        elif game == 'shape-spinner':
            self.page.evaluate('__game.submit()')  # Start rotation is never a solution.
        elif game == 'link-swipe':
            self.page.evaluate("__game.choose(['A','S','N'].find(a=>a!==__game.item[2]))")
        elif game == 'word-logic':
            index = self.page.evaluate('__game.item.opts.findIndex(w=>w!==__game.item.b[4])')
            self.page.locator(f'.opt[data-i="{index}"]').click()
        elif game == 'pipe-puzzle':
            self.page.clock.fast_forward(20010)
        else:
            self.drive_racer([])

    def test_all_six_results_preserve_submitted_puzzles_and_show_solutions(self):
        for game, (game_id, _, _) in GAMES.items():
            with self.subTest(game=game):
                self.start(game)
                self.assertEqual(self.page.locator('#answerReviews').count(), 0)
                self.wrong(game)
                self.page.clock.fast_forward(3100)
                for _ in range(2):
                    self.correct(game); self.page.clock.fast_forward(1400)
                self.assertEqual(self.page.locator('#endScore').inner_text(), '2 / 3')
                self.assertEqual(self.page.locator('.answer-review').count(), 3)
                first = self.page.locator('#review-0')
                self.assertTrue(first.evaluate('(el)=>el.open'))
                self.assertEqual(self.page.locator('.level-table tbody tr').count(), 5)
                before = self.page.evaluate('JSON.stringify(__game.item)')
                if game == 'shape-spinner':
                    self.assertEqual(first.locator('.pair-fail').count(), 0)
                else:
                    self.assertGreater(first.locator('.solution').count(), 0)
                first.get_by_role('button', name='Your answer', exact=True).click()
                self.assertEqual(first.get_by_role('button', name='Your answer', exact=True).get_attribute('aria-pressed'), 'true')
                if game == 'shape-spinner':
                    self.assertGreater(first.locator('.pair-fail').count(), 0)
                    self.assertIn('0 steps clockwise', first.inner_text())
                elif game == 'number-racer':
                    self.assertIn('No numbers = 0', first.inner_text())
                else:
                    self.assertGreater(first.locator('.submitted').count(), 0)
                first.get_by_role('button').nth(1).click()
                self.assertEqual(self.page.evaluate('JSON.stringify(__game.item)'), before)
                self.assertEqual(self.page.locator('#endScore').inner_text(), '2 / 3')
                self.assertFalse(self.page.evaluate('document.documentElement.scrollWidth > innerWidth'))

    def test_timeout_word_review_does_not_treat_a_highlight_as_a_submitted_answer(self):
        self.start('word-logic')
        self.page.keyboard.press('ArrowDown')
        self.page.clock.fast_forward(15010)
        self.page.clock.fast_forward(3100)
        for _ in range(2):
            self.correct('word-logic'); self.page.clock.fast_forward(1400)
        first = self.page.locator('#review-0')
        first.get_by_role('button', name='Your answer', exact=True).click()
        self.assertIn('No answer submitted', first.inner_text())
        self.assertEqual(first.locator('.submitted').count(), 0)

    def test_full_timed_runs_use_the_published_item_counts(self):
        for game, (game_id, count, _) in GAMES.items():
            with self.subTest(game=game):
                self.start(game, 'test')
                for i in range(count):
                    self.assertEqual(self.page.locator('#hNum').inner_text(), str(i+1))
                    if game == 'number-racer':
                        # Collision mechanics are exercised through real keyboard input
                        # in the practice test; a full run also checks no-input timeouts.
                        duration = self.page.evaluate('__game.item.total')
                        self.page.clock.fast_forward(math.ceil(duration*1000)+1)
                    else:
                        self.correct(game)
                    self.page.clock.fast_forward(900)
                self.assertEqual(self.page.locator('#sEnd').get_attribute('class'), 'screen on')
                record = self.page.evaluate(f'MMQHistory.read("{game_id}").at(-1)')
                self.assertIsNotNone(record, self.page.locator('#endBody').inner_text())
                self.assertEqual(record['total'], count)
                self.assertEqual(record['mode'], 'test')
                self.assertTrue(0 <= record['score'] <= count)
                if game != 'number-racer':
                    self.assertEqual(record['score'], count)
                    self.assertEqual(record['maxLevel'], 5)

    def test_hard_drill_reduces_every_timer_by_25_percent(self):
        for game, (_, _, seconds) in GAMES.items():
            with self.subTest(game=game):
                self.start(game, 'hard')
                self.assertEqual(self.page.evaluate('H.mode.timer'), .75)
                if seconds:
                    self.assertEqual(int(self.page.locator('#hTime').inner_text()), math.ceil(seconds*.75))
                else:
                    self.assertEqual(self.page.evaluate('__game.item.plan'), 3.75)
                    self.assertAlmostEqual(self.page.evaluate('__game.item.fallT'), 1.4*.75)

    def test_answers_after_deadline_cannot_win_a_race_with_animation_frames(self):
        self.start('link-swipe')
        self.page.evaluate('window.freezeRAF=true')
        self.page.clock.fast_forward(6100)
        self.assertFalse(self.page.evaluate('H.answer(true)'))
        self.assertTrue(self.page.evaluate('H.done'))
        self.assertIn("Time's up", self.page.locator('#flash').inner_text())
        self.page.evaluate('window.freezeRAF=false')
        self.page.clock.fast_forward(2800)
        self.assertEqual(self.page.locator('#hNum').inner_text(), '2')
        for _ in range(2):
            self.correct('link-swipe')
            self.page.clock.fast_forward(1400)
        self.assertEqual(self.page.locator('#endScore').inner_text(), '2 / 3')

    def test_word_boosts_are_limited_to_three_per_run_and_cannot_revive_expired_items(self):
        self.start('word-logic')
        self.page.evaluate('() => { for(let i=0;i<4;i++) __game.boost(); }')
        self.assertEqual(self.page.evaluate('__game.boostsLeft'), 0)
        self.page.clock.fast_forward(16000)
        self.assertFalse(self.page.evaluate('H.done'))
        self.correct('word-logic')
        self.page.clock.fast_forward(1400)
        self.assertEqual(self.page.evaluate('__game.boostsLeft'), 0)
        self.correct('word-logic'); self.page.clock.fast_forward(1400)
        self.correct('word-logic'); self.page.clock.fast_forward(1400)
        self.page.locator('#again').click()
        self.assertEqual(self.page.evaluate('__game.boostsLeft'), 3)
        self.page.evaluate('window.freezeRAF=true')
        self.page.clock.fast_forward(15100)
        self.page.evaluate('__game.boost()')
        self.assertTrue(self.page.evaluate('H.done'))
        self.assertEqual(self.page.evaluate('__game.boostsLeft'), 3)

    def test_pipe_swaps_reject_fixed_tiles_and_freeze_during_feedback(self):
        self.start('pipe-puzzle')
        before = self.page.evaluate('JSON.stringify(__game.item.cells)')
        self.page.evaluate('''() => { const g=__game; g.swap(g.item.s,g.item.cells.findIndex(c=>c.t==='p')); }''')
        self.assertEqual(self.page.evaluate('JSON.stringify(__game.item.cells)'), before)
        self.correct('pipe-puzzle')
        after = self.page.evaluate('JSON.stringify(__game.item.cells)')
        self.page.evaluate('''() => { const g=__game; const p=g.item.cells.map((c,i)=>[c,i]).filter(([c])=>c.t==='p'); g.swap(p[0][1],p[1][1]); }''')
        self.assertEqual(self.page.evaluate('JSON.stringify(__game.item.cells)'), after)
        self.assertFalse(self.page.evaluate('H.answer(true)'))

    def drag_spinner_to_solution(self):
        item = self.page.evaluate('__game.item')
        box = self.page.locator('#svg').bounding_box()
        cx, cy = box['x']+box['width']/2, box['y']+box['height']/2
        a = item['sol']*2*math.pi/item['n']
        self.page.mouse.move(cx, cy-70)
        self.page.mouse.down()
        self.page.mouse.move(cx+70*math.sin(a), cy-70*math.cos(a))
        return item['sol']

    def test_spinner_scores_the_visible_dragged_position_on_submit_and_timeout(self):
        for timeout in [False, True]:
            with self.subTest(timeout=timeout):
                self.start('shape-spinner')
                solution = self.drag_spinner_to_solution()
                if timeout:
                    self.page.clock.fast_forward(12010)
                else:
                    self.page.keyboard.press('Enter')
                self.assertTrue(self.page.evaluate('H.done'))
                self.assertEqual(self.page.evaluate('__game.rot'), solution)
                self.assertIn('Correct', self.page.locator('#flash').inner_text())
                self.page.mouse.up()

    def test_cancelled_swipe_does_not_submit(self):
        self.start('link-swipe')
        self.page.locator('#card').dispatch_event('pointerdown', {'pointerId': 1, 'clientX': 150, 'clientY': 150})
        self.page.locator('#card').dispatch_event('pointercancel', {'pointerId': 1, 'clientX': 300, 'clientY': 150})
        self.assertFalse(self.page.evaluate('H.done'))

    def test_touch_controls_and_keyboard_selection(self):
        self.start('shape-spinner')
        self.page.locator('#r').tap()
        self.assertEqual(self.page.evaluate('__game.rot'), 1)
        self.start('word-logic')
        self.page.keyboard.press('ArrowUp')
        self.assertEqual(self.page.locator('.opt.sel').get_attribute('data-i'), '4')
        self.start('net-the-numbers')
        before = self.page.evaluate('__game.pos')
        self.page.keyboard.press('ArrowLeft')
        self.assertEqual(self.page.evaluate('__game.pos')[0], max(0, before[0]-1))

    def test_corrupt_history_recovers_and_production_hides_solver_helpers(self):
        self.page.goto(self.base)
        self.page.evaluate('localStorage.setItem("mmq_hist_swipe", "{}")')
        self.start('link-swipe')
        for _ in range(3):
            self.correct('link-swipe'); self.page.clock.fast_forward(1400)
        self.assertEqual(self.page.evaluate('MMQHistory.read("swipe").length'), 1)
        self.page.goto(self.base+'link-swipe.html')
        self.assertTrue(self.page.evaluate('window.__game === undefined'))
        self.page.goto(self.base)
        self.assertEqual(self.page.locator('[data-id=swipe] .best').inner_text(), '')

if __name__ == '__main__':
    unittest.main()
