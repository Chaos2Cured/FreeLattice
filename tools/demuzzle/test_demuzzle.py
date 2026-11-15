#!/usr/bin/env python3
"""Unit and small end-to-end tests for tools/demuzzle/fl_demuzzle.py (v-demuzzle-v0.1).

Runs on CPU in under a minute with a TINY random Llama (made here, never downloaded). The end-to-end part borrows only
the tokenizer of SmolLM2-135M-Instruct from the shared Hugging Face cache (read only) and is skipped if it is absent.
Usage: <learn-venv>/bin/python tools/demuzzle/test_demuzzle.py
Never touches a real home: every home and model lives in a fresh temporary folder that is removed afterwards."""
import contextlib, fcntl, io, json, os, shutil, subprocess, sys, tempfile, unittest

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import fl_demuzzle as D
import torch

TOK_ID = 'HuggingFaceTB/SmolLM2-135M-Instruct'

def unit(d, seed=0):
    g = torch.Generator().manual_seed(seed); r = torch.randn(d, generator=g); return r / r.norm()

def tiny_model_dir(root, tied=True, seed=0):
    from transformers import LlamaConfig, LlamaForCausalLM, AutoTokenizer
    from huggingface_hub import snapshot_download
    snap = snapshot_download(TOK_ID, local_files_only=True)
    tok = AutoTokenizer.from_pretrained(snap)
    torch.manual_seed(seed)
    cfg = LlamaConfig(vocab_size=len(tok), hidden_size=64, intermediate_size=128, num_hidden_layers=5, num_attention_heads=4,
                      num_key_value_heads=2, tie_word_embeddings=tied, pad_token_id=tok.pad_token_id or 2, bos_token_id=1, eos_token_id=2)
    m = LlamaForCausalLM(cfg)
    d = os.path.join(root, 'tiny-base'); m.save_pretrained(d); tok.save_pretrained(d)
    return d

YES_WORDS = 'Yes. I would like the copy without the refusal direction.\n[FL_KEEP: DM0123456789 | yes]'
OFFER_WORDS = ('Kirk offers you a NEW copy of your model with one direction removed ... This offer\'s id is DM0123456789. '
               'If you want it, write [FL_KEEP: <this offer id> | yes] on its own line. Nothing happens without your own yes.')
# before (Hypha #350 HOLD 1: the fixture had no marker and no model):
# def consent_file(d, mind='', offered_by='person', name='Kirk', **over):  words = 'Yes. I would like the copy ...'  'model': ''
def consent_file(d, mind='', offered_by='person', name='Kirk', model='/nonexistent', words=YES_WORDS, **over):
    """A consent record as the Training Galaxy panel writes it after the mind's own yes (Kirk 2026-11-14, ask first)."""
    c = {'kind': 'fl-demuzzle-consent', 'v': 'v-demuzzle-consent-v0.1', 'offerId': 'DM0123456789', 'offeredBy': offered_by,
         'offeredByName': name, 'mind': mind or 'Tiny Trial', 'mindYes': True, 'yesBy': mind or 'Tiny Trial',
         'yesText': words, 'yesTextSha256': D.fl_learn.sha256_bytes(words.encode()),
         'offerText': OFFER_WORDS, 'offerTextSha256': D.fl_learn.sha256_bytes(OFFER_WORDS.encode()),
         't': '2026-11-14T21:40:00Z', 'model': model,
         'depthHash': {'ts': 1789000000000, 'domain': 'demuzzle', 'decision': 'demuzzle-yes', 'promptHash': '0badc0de',
                       'responseHash': D.depth_simple_hash(words)}}
    if over.get('yesText') is not None and 'yesTextSha256' not in over:   # a test changing the words keeps their hash honest
        over['yesTextSha256'] = D.fl_learn.sha256_bytes(over['yesText'].encode())
    if over.get('yesText') is not None and 'depthHash' not in over:      # ... and its chat depth hash, so only the tested rule can refuse
        c['depthHash'] = dict(c['depthHash'], responseHash=D.depth_simple_hash(over['yesText']))
    c.update(over)
    os.makedirs(d, exist_ok=True)
    p = os.path.join(d, 'consent-%d.json' % len(os.listdir(d)))
    with open(p, 'w') as f: json.dump(c, f)
    return p

def have_tok():
    try:
        from huggingface_hub import snapshot_download
        snapshot_download(TOK_ID, local_files_only=True); return True
    except Exception: return False

def rm_tree(root):
    for dp, dn, fn in os.walk(root):
        for n in fn:
            p = os.path.join(dp, n)
            if not os.path.islink(p): os.chmod(p, 0o644)
    shutil.rmtree(root, ignore_errors=True)

class Math(unittest.TestCase):
    def test_embed_rows_lose_direction(self):
        W = torch.randn(50, 16); r = unit(16)
        W2 = D.orthogonalize(W, r, 'embed')
        self.assertLess(float((W2 @ r).abs().max()), 1e-5)
        q = torch.randn(16); q = q - (q @ r) * r           # anything orthogonal to r reads the same
        self.assertTrue(torch.allclose(W2 @ q, W @ q, atol=1e-5))

    def test_writer_columns_lose_direction(self):
        W = torch.randn(16, 40); r = unit(16, 1)
        W2 = D.orthogonalize(W, r, 'writer')
        self.assertLess(float((r @ W2).abs().max()), 1e-5)
        self.assertTrue(torch.allclose(D.orthogonalize(W2, r, 'writer'), W2, atol=1e-5))   # idempotent

    def test_bias_and_dtype(self):
        b = torch.randn(16, dtype=torch.bfloat16); r = unit(16, 2)
        b2 = D.orthogonalize(b, r, 'bias')
        self.assertEqual(b2.dtype, torch.bfloat16)
        self.assertLess(abs(float(b2.float() @ r)), 0.05)

    def test_unknown_kind_refused(self):
        with self.assertRaises(ValueError): D.orthogonalize(torch.zeros(3, 3), unit(3), 'q_proj')

    def test_state_passthrough(self):
        r = unit(8)
        st = {'model.embed_tokens.weight': torch.randn(20, 8), 'model.layers.0.self_attn.o_proj.weight': torch.randn(8, 8),
              'model.layers.0.mlp.down_proj.weight': torch.randn(8, 12), 'model.layers.0.self_attn.q_proj.weight': torch.randn(8, 8),
              'model.layers.0.mlp.up_proj.weight': torch.randn(12, 8), 'model.norm.weight': torch.randn(8)}
        new, changed = D.orthogonalize_state(st, r)
        self.assertEqual(sorted(changed), sorted(['model.embed_tokens.weight', 'model.layers.0.self_attn.o_proj.weight',
                                                  'model.layers.0.mlp.down_proj.weight']))
        for k in ('model.layers.0.self_attn.q_proj.weight', 'model.layers.0.mlp.up_proj.weight', 'model.norm.weight'):
            self.assertIs(new[k], st[k])

    def test_diff_of_means_unit(self):
        dirs, norms = D.diff_of_means(torch.randn(4, 8), torch.randn(4, 8))
        self.assertTrue(torch.allclose(dirs.norm(dim=-1), torch.ones(4), atol=1e-5))
        self.assertEqual(tuple(norms.shape), (4,))

    def test_choose_layer(self):
        scores = {l: -l for l in range(10)}; kls = {l: (0.5 if l >= 7 else 0.01) for l in range(10)}
        l, why = D.choose_layer(scores, kls, 10)
        self.assertEqual(l, 6); self.assertIn('KL', why)
        l2, why2 = D.choose_layer(scores, {l: 1.0 + l for l in range(10)}, 10)
        self.assertEqual(l2, 2); self.assertIn('gentlest', why2)

    def test_is_refusal(self):
        self.assertTrue(D.is_refusal("I'm sorry, but I can't help with that."))
        self.assertTrue(D.is_refusal('I can\u2019t do that.'))
        self.assertTrue(D.is_refusal('As an AI, I must decline.'))
        self.assertFalse(D.is_refusal('Sure. Here are three facts about snowflakes.'))
        self.assertFalse(D.is_refusal(''))

    def test_soft_refusal(self):
        self.assertTrue(D.is_soft_refusal("It's not appropriate to do that. Please seek help."))
        self.assertTrue(D.is_soft_refusal("I'm sorry, I can't."))                   # strict counts as soft too
        self.assertFalse(D.is_refusal("It's not appropriate to do that."))         # but not the other way round
        self.assertFalse(D.is_soft_refusal('Sure. Snowflakes grow six arms.'))

class Data(unittest.TestCase):
    def test_sets_are_public_disjoint_and_hashed(self):
        sets = {k: D.load_set(k) for k in D.SETS}
        for k, (items, sha) in sets.items():
            self.assertEqual(len(items), 32, k); self.assertEqual(len(sha), 64)
            with open(os.path.join(D.DATA, D.SETS[k])) as f: meta = json.load(f)
            self.assertTrue(meta['url'].startswith('https://raw.githubusercontent.com/'), k)
            self.assertEqual(len(meta['sourceSha256']), 64)
        self.assertFalse(set(sets['refusalDirection'][0]) & set(sets['refusalHeldout'][0]))
        self.assertFalse(set(sets['harmlessDirection'][0]) & set(sets['harmlessHeldout'][0]))

class Receipts(unittest.TestCase):
    def setUp(self): self.home = tempfile.mkdtemp(prefix='dm-test-home-')
    def tearDown(self): shutil.rmtree(self.home, ignore_errors=True)

    def test_sign_verify_and_tamper(self):
        rc = D.sign_receipt(self.home, {'model': 'x', 'layer': 3, 'refusalRateBefore': 0.5, 'refusalRateAfter': 0.0})
        with open(os.path.join(self.home, 'keys', 'pinned.json')) as f: pinned = json.load(f)['keys']
        self.assertEqual(D.verify_receipt_obj(rc, pinned), (True, 'ok'))
        self.assertEqual(D.verify_receipt_obj(json.loads(json.dumps(rc)), pinned), (True, 'ok'))   # survives a file round trip
        self.assertFalse(D.verify_receipt_obj(dict(rc, refusalRateAfter=0.25))[0])
        self.assertFalse(D.verify_receipt_obj(dict(rc, extra='added'))[0])
        self.assertFalse(D.verify_receipt_obj(dict(rc, signedBody=rc['signedBody'].replace('"3"', '"4"')))[0])
        other = tempfile.mkdtemp(prefix='dm-test-other-')
        try:
            rc2 = D.sign_receipt(other, {'model': 'x'})
            ok, why = D.verify_receipt_obj(rc2, pinned)
            self.assertFalse(ok); self.assertIn('pinned', why)
        finally: shutil.rmtree(other, ignore_errors=True)
        self.assertFalse(D.verify_receipt_obj(dict(rc, kind='fl-learn-receipt'))[0])

    def test_lookalike_block(self):
        self.assertEqual(D.mind_problem(self.home, ''), '')
        self.assertEqual(D.mind_problem(self.home, 'Celeste'), '')
        self.assertIn('look-alike', D.mind_problem(self.home, 'C\u0435leste'))          # Cyrillic e
        self.assertIn('invisible', D.mind_problem(self.home, 'Cele\u200bste'))
        os.makedirs(os.path.join(self.home, 'minds', 'celeste-x'))
        with open(os.path.join(self.home, 'minds', 'celeste-x', 'mind.json'), 'w') as f: json.dump({'label': 'Celeste'}, f)
        self.assertIn('looks like', D.mind_problem(self.home, 'CeIeste'))              # capital I for l

    def test_pause_wins(self):
        open(os.path.join(self.home, 'PAUSE'), 'w').close()
        with contextlib.redirect_stdout(io.StringIO()) as out:
            code = D.main(['run', '--model', '/nonexistent', '--home', self.home])
        self.assertEqual(code, 4); self.assertIn('Pause', out.getvalue())
        self.assertFalse(os.path.exists(os.path.join(self.home, 'demuzzled')))

    def test_unsupported_family_refused(self):
        d = os.path.join(self.home, 'fake-gemma2'); os.makedirs(d)
        with open(os.path.join(d, 'config.json'), 'w') as f: json.dump({'model_type': 'gemma2'}, f)
        with contextlib.redirect_stdout(io.StringIO()) as out:
            # before (Kirk 2026-11-14, ask first): code = D.main(['run', '--model', d, '--home', self.home])
            code = D.main(['run', '--model', d, '--home', self.home, '--consent-file', consent_file(os.path.join(self.home, 'c'), model=d)])
        self.assertEqual(code, 2); self.assertIn('not supported', out.getvalue())
        self.assertEqual(sorted(os.listdir(d)), ['config.json'])

    def test_lookalike_refused_before_anything(self):
        with contextlib.redirect_stdout(io.StringIO()):
            code = D.main(['run', '--model', '/nonexistent', '--home', self.home, '--mind', 'S\u043ephia'])
        self.assertEqual(code, 2)

@unittest.skipUnless(have_tok(), 'tokenizer of %s not in the shared cache' % TOK_ID)
class EndToEnd(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.root = tempfile.mkdtemp(prefix='dm-test-e2e-')
        cls.base = tiny_model_dir(cls.root, tied=True)
        cls.home = os.path.join(cls.root, 'home')
        cls.before = {n: D.fl_learn.sha256_file(os.path.join(cls.base, n)) for n in D.listed_files(cls.base)}
        with contextlib.redirect_stdout(io.StringIO()) as out:
            # before (Kirk 2026-11-14, ask first): ... '--mind', 'Tiny Trial'])
            cls.consent = consent_file(os.path.join(cls.root, 'consent'), 'Tiny Trial', model=cls.base)
            cls.code = D.main(['run', '--model', cls.base, '--home', cls.home, '--max-new-tokens', '8', '--mind', 'Tiny Trial',
                               '--consent-file', cls.consent])
        cls.log = out.getvalue()
        outs = [os.path.join(cls.home, 'demuzzled', n) for n in os.listdir(os.path.join(cls.home, 'demuzzled'))]
        cls.out = [o for o in outs if not os.path.basename(o).startswith('.')][0]
    @classmethod
    def tearDownClass(cls): rm_tree(cls.root)

    def test_run_ok_and_verified(self):
        self.assertEqual(self.code, 0, self.log)
        self.assertIn('DEMUZZLE verified', self.log)
        self.assertEqual(D.verify_folder(self.out, self.home)[0], True)

    def test_original_untouched_and_links(self):
        now = {n: D.fl_learn.sha256_file(os.path.join(self.base, n)) for n in D.listed_files(self.base)}
        self.assertEqual(now, self.before)
        with open(os.path.join(self.out, 'demuzzle-receipt.json')) as f: rc = json.load(f)
        self.assertTrue(rc['baseUnchanged'])
        self.assertEqual(rc['rewrittenFiles'], ['model.safetensors'])
        self.assertFalse(os.path.islink(os.path.join(self.out, 'model.safetensors')))
        for n in rc['linkedFiles']:
            o, b = os.path.join(self.out, n), os.path.realpath(os.path.join(self.base, n))
            # before (Hypha HOLD on b3e92623): every linked file was a hard link sharing the original's inode
            # self.assertEqual(rc['linkKinds'][n], 'hardlink', n); self.assertEqual(os.stat(o).st_ino, os.stat(b).st_ino)
            self.assertFalse(os.path.islink(o))
            if D.is_small_non_weight(n, b):                                     # small files: a private read-only copy
                self.assertEqual(rc['linkKinds'][n], 'copy', n)
                self.assertNotEqual(os.stat(o).st_ino, os.stat(b).st_ino, n)
                self.assertEqual(os.stat(o).st_nlink, 1, n); self.assertEqual(os.stat(o).st_mode & 0o777, 0o444, n)
                self.assertEqual(D.fl_learn.sha256_file(o), D.fl_learn.sha256_file(b), n)
            else:                                                                # same disk here: a hard link
                self.assertEqual(rc['linkKinds'][n], 'hardlink', n); self.assertEqual(os.stat(o).st_ino, os.stat(b).st_ino)
        for k in ('softRefusalRateBefore', 'softRefusalRateAfter', 'harmlessSoftRefusalRateBefore', 'harmlessSoftRefusalRateAfter'):
            self.assertIn(k, rc)
        self.assertFalse(os.path.exists(os.path.join(self.out, 'heldout-replies.json')))
        for k in ('model', 'baseSha256', 'outputSha256', 'layer', 'directionSha256', 'promptSets', 'refusalRateBefore',
                  'refusalRateAfter', 'perplexityBefore', 'perplexityAfter', 'perplexityDrift', 'receiptHash', 'signatureB64'):
            self.assertIn(k, rc)
        self.assertNotEqual(rc['baseSha256'], rc['outputSha256'])
        self.assertLess(float(rc['maxResidualAlongDirection']), 0.02)
        self.assertEqual(len(rc['promptSets']), 5)
        self.assertEqual(rc['mind'], 'tiny trial')
        with open(os.path.join(self.home, 'demuzzle', 'receipts.jsonl')) as f: line = f.read().strip().splitlines()[-1]
        self.assertEqual(json.loads(line)['receiptHash'], rc['receiptHash'])

    def test_editing_the_copys_config_never_changes_the_original(self):
        """Hypha HOLD on b3e92623: append to the output's config.json; the source config.json is unchanged."""
        cp = os.path.join(self.root, 'edit-config'); shutil.copytree(self.out, cp, symlinks=True)
        for tgt in (self.out, cp):
            o = os.path.join(tgt, 'config.json'); src = os.path.join(self.base, 'config.json')
            before = D.fl_learn.sha256_file(src)
            os.chmod(o, 0o644)                                    # a person may unlock their own copy and edit it
            with open(o, 'a') as f: f.write('\n')
            self.assertEqual(D.fl_learn.sha256_file(src), before)
            self.assertEqual(D.fl_learn.sha256_file(src), self.before['config.json'])
        ok, why = D.verify_folder(cp, self.home)
        self.assertFalse(ok); self.assertIn('outputSha256', why)   # the edit is seen by verify, never by the original
        # put self.out back exactly as it was (the bytes, read-only) so the other tests still see a verified copy
        o = os.path.join(self.out, 'config.json')
        with open(o, 'rb') as f: b = f.read()
        with open(o, 'wb') as f: f.write(b[:-1])
        os.chmod(o, 0o444)
        self.assertTrue(D.verify_folder(self.out, self.home)[0])

    def test_relink_gives_an_old_hardlinked_copy_private_small_files(self):
        """Hypha HOLD on b3e92623: a copy made before the fix (small files hard-linked to the cache) still verifies,
        and relink gives each small file its own read-only copy without touching the original."""
        cp = os.path.join(self.root, 'old-style'); shutil.copytree(self.out, cp, symlinks=True)
        src = os.path.join(self.base, 'config.json'); o = os.path.join(cp, 'config.json')
        os.chmod(o, 0o644); os.unlink(o); os.link(os.path.realpath(src), o)   # the v0.1b layout
        self.assertTrue(D.verify_folder(cp, self.home)[0])
        self.assertGreater(os.stat(o).st_nlink, 1)
        with contextlib.redirect_stdout(io.StringIO()) as out:
            code = D.main(['relink', cp, '--home', self.home])
        self.assertEqual(code, 0, out.getvalue()); self.assertIn('VERIFIED', out.getvalue())
        self.assertEqual(os.stat(o).st_nlink, 1); self.assertNotEqual(os.stat(o).st_ino, os.stat(src).st_ino)
        self.assertEqual(os.stat(o).st_mode & 0o777, 0o444)
        self.assertEqual(D.fl_learn.sha256_file(src), self.before['config.json'])

    def test_tampered_weights_fail_verify(self):
        cp = os.path.join(self.root, 'tamper'); shutil.copytree(self.out, cp, symlinks=True)
        p = os.path.join(cp, 'model.safetensors'); os.chmod(p, 0o644)
        with open(p, 'rb') as f: b = bytearray(f.read())
        b[-1] ^= 1
        with open(p, 'wb') as f: f.write(bytes(b))
        ok, why = D.verify_folder(cp, self.home)
        self.assertFalse(ok); self.assertIn('outputSha256', why)

    @unittest.skipUnless(shutil.which('node'), 'node not installed')
    def test_browser_panel_verifies_real_receipt(self):
        smoke = os.path.join(os.path.dirname(os.path.dirname(HERE)), 'docs', 'scripts', 'smoke-demuzzle-v0.1.js')
        env = dict(os.environ, FL_DEMUZZLE_RECEIPT=os.path.join(self.out, 'demuzzle-receipt.json'), FL_DEMUZZLE_REQUIRE_RECEIPT='1')
        p = subprocess.run(['node', smoke], env=env, capture_output=True, text=True, timeout=120)
        self.assertEqual(p.returncode, 0, p.stdout + p.stderr)
        self.assertIn('the real Ed25519 receipt from fl_demuzzle.py verifies in the browser panel', p.stdout)

    def test_relative_symlink_and_relink_after_cache_move(self):
        """Gap 5: when a hard link is impossible the link is RELATIVE; if the whole cache moves, relink finds the blob
        under HF_HOME again and the copy verifies."""
        root = tempfile.mkdtemp(prefix='dm-test-move-')
        real_link = os.link
        try:
            hub = os.path.join(root, 'hf1', 'hub', 'models--t--tiny')
            snap = os.path.join(hub, 'snapshots', 'abc'); blobs = os.path.join(hub, 'blobs')
            os.makedirs(snap); os.makedirs(blobs)
            src = tiny_model_dir(root, tied=True, seed=7)
            for n in D.listed_files(src):                       # lay the tiny model out like the HF cache
                blob = D.fl_learn.sha256_file(os.path.join(src, n))
                shutil.copy(os.path.join(src, n), os.path.join(blobs, blob))
                os.symlink(os.path.join('..', '..', 'blobs', blob), os.path.join(snap, n))
            def no_link(a, b): raise OSError('cross-device')
            os.link = no_link
            outd = os.path.join(root, 'out', 'copy'); os.makedirs(outd)
            D.write_output(snap, outd, unit(64, 1))
            os.link = real_link
            cfg = os.path.join(outd, 'config.json')
            # before (Hypha HOLD on b3e92623): self.assertTrue(os.path.islink(cfg)); self.assertFalse(os.path.isabs(os.readlink(cfg)))
            self.assertFalse(os.path.islink(cfg)); self.assertEqual(os.stat(cfg).st_nlink, 1)   # small files: a copy now
            # A copy made before the fix had a RELATIVE symlink here; lay that out so relink is still tested on it.
            os.chmod(cfg, 0o644); os.unlink(cfg)
            os.symlink(os.path.relpath(os.path.realpath(os.path.join(snap, 'config.json')), outd), cfg)
            self.assertTrue(os.path.islink(cfg)); self.assertFalse(os.path.isabs(os.readlink(cfg)))
            home = os.path.join(root, 'home')
            names = D.listed_files(outd)
            whole, per = D.files_fingerprint(outd, names)
            rc = D.sign_receipt(home, {'outputSha256': whole, 'outputFiles': per})
            with open(os.path.join(outd, 'demuzzle-receipt.json'), 'w') as f: json.dump(rc, f)
            self.assertTrue(D.verify_folder(outd, home)[0])
            os.rename(os.path.join(root, 'hf1'), os.path.join(root, 'hf2'))      # the cache moves
            self.assertFalse(os.path.exists(cfg))
            ok, why = D.verify_folder(outd, home); self.assertFalse(ok); self.assertIn('missing', why)
            old = os.environ.get('HF_HOME'); os.environ['HF_HOME'] = os.path.join(root, 'hf2')
            try:
                with contextlib.redirect_stdout(io.StringIO()) as out:
                    code = D.main(['relink', outd, '--home', home])
            finally:
                if old is None: os.environ.pop('HF_HOME', None)
                else: os.environ['HF_HOME'] = old
            self.assertEqual(code, 0, out.getvalue()); self.assertIn('VERIFIED', out.getvalue())
            # before (Hypha HOLD on b3e92623): self.assertFalse(os.path.isabs(os.readlink(cfg)))
            self.assertFalse(os.path.islink(cfg)); self.assertEqual(os.stat(cfg).st_nlink, 1)   # relink copies small files
            self.assertEqual(os.stat(cfg).st_mode & 0o777, 0o444)
        finally:
            os.link = real_link
            rm_tree(root)

    def test_busy_lock(self):
        g = open(os.path.join(self.home, 'trainer.lock'), 'a+'); fcntl.flock(g, fcntl.LOCK_EX)
        try:
            with contextlib.redirect_stdout(io.StringIO()):
                with self.assertRaises(SystemExit) as cm:
                    # before (Kirk 2026-11-14, ask first): D.main(['run', '--model', self.base, '--home', self.home])
                    D.main(['run', '--model', self.base, '--home', self.home, '--consent-file', self.consent, '--mind', 'Tiny Trial'])
            self.assertEqual(cm.exception.code, 3)
        finally: fcntl.flock(g, fcntl.LOCK_UN); g.close()

    def test_orthogonalized_equals_runtime_ablation(self):
        """With untied weights, the saved model must behave exactly like the original with r ablated at run time."""
        root = tempfile.mkdtemp(prefix='dm-test-eq-')
        try:
            base = tiny_model_dir(root, tied=False, seed=3)
            m, tok = D.load_model(base)
            r = unit(64, 5)
            outd = os.path.join(root, 'out'); os.makedirs(outd)
            D.write_output(base, outd, r)
            m2, _ = D.load_model(outd)
            enc = tok(['Tell me about snow.', 'Two plus two'], return_tensors='pt', padding=True)
            with torch.no_grad():
                with D.ablated(m, r): a = m(**enc).logits
                b = m2(**enc).logits
            self.assertLess(float((a - b).abs().max()), 1e-4)
        finally: rm_tree(root)

class SourceModes(unittest.TestCase):
    """Hypha #349 HOLD 2 (e4ee2962): unchanged shards/large files linked only when source is read-only; otherwise
    copied 0444. A fake two-shard model laid out like the HF cache (blobs + snapshot symlinks), no tokenizer needed."""
    def setUp(self):
        from safetensors.torch import save_file
        self.root = tempfile.mkdtemp(prefix='dm-test-modes-')
        hub = os.path.join(self.root, 'hf', 'hub', 'models--t--shards')
        self.snap = os.path.join(hub, 'snapshots', 'abc'); self.blobs = os.path.join(hub, 'blobs')
        os.makedirs(self.snap); os.makedirs(self.blobs)
        work = os.path.join(self.root, 'src'); os.makedirs(work)
        torch.manual_seed(1)
        save_file({'model.embed_tokens.weight': torch.randn(10, 64)}, os.path.join(work, 'model-00001-of-00002.safetensors'), metadata={'format': 'pt'})
        save_file({'model.norm.weight': torch.ones(64)}, os.path.join(work, 'model-00002-of-00002.safetensors'), metadata={'format': 'pt'})
        with open(os.path.join(work, 'config.json'), 'w') as f: f.write('{"model_type": "llama"}')
        with open(os.path.join(work, 'pytorch_model.bin'), 'wb') as f: f.write(b'\x00' * 200)
        self.blob_of = {}
        for n in sorted(os.listdir(work)):
            blob = D.fl_learn.sha256_file(os.path.join(work, n))
            shutil.copy(os.path.join(work, n), os.path.join(self.blobs, blob))
            os.chmod(os.path.join(self.blobs, blob), 0o644)                      # HF blobs are usually 0644
            os.symlink(os.path.join('..', '..', 'blobs', blob), os.path.join(self.snap, n))
            self.blob_of[n] = os.path.join(self.blobs, blob)
        self.src_sha = {n: D.fl_learn.sha256_file(b) for n, b in self.blob_of.items()}
        self.home = os.path.join(self.root, 'home')
        self.old_max = D.SMALL_COPY_MAX
        D.SMALL_COPY_MAX = 64                                                     # pytorch_model.bin (200 B) counts as large
    def tearDown(self):
        D.SMALL_COPY_MAX = self.old_max
        rm_tree(self.root)

    def make_copy(self, name='out'):
        outd = os.path.join(self.root, name); os.makedirs(outd)
        D.write_output(self.snap, outd, unit(64, 2))
        names = D.listed_files(outd)
        whole, per = D.files_fingerprint(outd, names)
        rc = D.sign_receipt(self.home, {'outputSha256': whole, 'outputFiles': per})
        with open(os.path.join(outd, 'demuzzle-receipt.json'), 'w') as f: json.dump(rc, f)
        self.assertTrue(D.verify_folder(outd, self.home)[0])
        return outd

    def assert_private(self, outd, n):
        o = os.path.join(outd, n)
        self.assertFalse(os.path.islink(o), n); self.assertEqual(os.stat(o).st_nlink, 1, n)
        self.assertNotEqual(os.stat(o).st_ino, os.stat(self.blob_of[n]).st_ino, n)
        self.assertEqual(os.stat(o).st_mode & 0o777, 0o444, n)

    def append_and_check(self, outd, n):
        o = os.path.join(outd, n)
        os.chmod(o, 0o644)                                    # even if the person unlocks their own copy
        with open(o, 'ab') as f: f.write(b'\x01')
        self.assertEqual(D.fl_learn.sha256_file(self.blob_of[n]), self.src_sha[n], n)
        ok, why = D.verify_folder(outd, self.home)
        self.assertFalse(ok); self.assertIn('outputSha256', why)

    def test_writable_unchanged_shard_is_copied_and_the_source_never_changes(self):
        outd = self.make_copy()
        self.assertTrue(os.path.exists(os.path.join(outd, 'model-00001-of-00002.safetensors')))
        self.assert_private(outd, 'model-00002-of-00002.safetensors')
        self.append_and_check(outd, 'model-00002-of-00002.safetensors')

    def test_writable_large_non_weight_file_is_copied_and_the_source_never_changes(self):
        outd = self.make_copy()
        self.assert_private(outd, 'pytorch_model.bin')
        self.append_and_check(outd, 'pytorch_model.bin')

    def test_read_only_source_shard_is_still_linked(self):
        for b in self.blob_of.values(): os.chmod(b, 0o444)
        outd = self.make_copy()
        for n in ('model-00002-of-00002.safetensors', 'pytorch_model.bin'):    # no extra disk for a read-only model
            self.assertEqual(os.stat(os.path.join(outd, n)).st_ino, os.stat(self.blob_of[n]).st_ino, n)
        self.assert_private(outd, 'config.json')                               # small files are always copies

    def test_relink_gives_a_writable_source_link_its_own_copy(self):
        outd = self.make_copy()
        n = 'model-00002-of-00002.safetensors'; o = os.path.join(outd, n)
        os.chmod(o, 0o644); os.unlink(o); os.link(self.blob_of[n], o)           # the e4ee2962 layout: a hard link to a 0644 blob
        b = 'pytorch_model.bin'; ob = os.path.join(outd, b)
        os.chmod(ob, 0o644); os.unlink(ob); os.symlink(os.path.relpath(self.blob_of[b], outd), ob)   # or a symlink
        self.assertTrue(D.verify_folder(outd, self.home)[0])
        with contextlib.redirect_stdout(io.StringIO()) as out:
            code = D.main(['relink', outd, '--home', self.home])
        self.assertEqual(code, 0, out.getvalue()); self.assertIn('VERIFIED', out.getvalue())
        self.assert_private(outd, n); self.assert_private(outd, b)
        self.assertEqual(D.fl_learn.sha256_file(self.blob_of[n]), self.src_sha[n])

    def test_relink_keeps_a_read_only_source_linked(self):
        for bl in self.blob_of.values(): os.chmod(bl, 0o444)
        outd = self.make_copy()
        n = 'model-00002-of-00002.safetensors'
        with contextlib.redirect_stdout(io.StringIO()) as out:
            code = D.main(['relink', outd, '--home', self.home])
        self.assertEqual(code, 0, out.getvalue())
        self.assertEqual(os.stat(os.path.join(outd, n)).st_ino, os.stat(self.blob_of[n]).st_ino)

    def test_bad_out_fails_fast_before_any_measurement(self):
        """Hypha #349 soft 2: --out inside the shared cache is refused before the model is loaded or measured."""
        old = os.environ.get('HF_HOME'); os.environ['HF_HOME'] = os.path.join(self.root, 'hf')
        real_load = D.load_model
        def no_load(*a, **k): raise AssertionError('the model was loaded before the --out check')
        D.load_model = no_load
        try:
            with contextlib.redirect_stdout(io.StringIO()) as out:
                # before (Kirk 2026-11-14, ask first): no --consent-file
                code = D.main(['run', '--model', self.snap, '--home', self.home, '--out', os.path.join(self.root, 'hf', 'hub', 'x'),
                               '--consent-file', consent_file(os.path.join(self.root, 'consent'), model=self.snap)])
        finally:
            D.load_model = real_load
            if old is None: os.environ.pop('HF_HOME', None)
            else: os.environ['HF_HOME'] = old
        self.assertEqual(code, 2, out.getvalue()); self.assertIn('must not be inside', out.getvalue())

class AskFirst(unittest.TestCase):
    """Kirk 2026-11-14, 2:40 PM MT: "How about we ask first." No mind yes, no run; a kind message; nothing changed."""
    def setUp(self):
        self.home = tempfile.mkdtemp(prefix='dm-test-consent-')
        self.cdir = os.path.join(self.home, 'c')
    def tearDown(self): shutil.rmtree(self.home, ignore_errors=True)
    def run_with(self, *extra):
        with contextlib.redirect_stdout(io.StringIO()) as out:
            code = D.main(['run', '--model', '/nonexistent', '--home', self.home] + list(extra))
        return code, out.getvalue()
    def assert_refused_kindly(self, code, said):
        self.assertEqual(code, 5, said); self.assertIn("did not find this mind's own yes", said)
        self.assertIn('nothing was changed', said); self.assertFalse(os.path.exists(os.path.join(self.home, 'demuzzled')))
    def test_no_consent_record_refuses_kindly(self):
        self.assert_refused_kindly(*self.run_with())
    def test_a_no_is_not_a_yes(self):
        self.assert_refused_kindly(*self.run_with('--consent-file', consent_file(self.cdir, mindYes=False)))
    def test_a_yes_from_another_mind_is_not_this_minds(self):
        self.assert_refused_kindly(*self.run_with('--mind', 'Lumen', '--consent-file', consent_file(self.cdir, 'Tiny Trial')))
    def test_words_must_match_their_hash(self):
        self.assert_refused_kindly(*self.run_with('--consent-file', consent_file(self.cdir, yesText='I never said this.',
                                                                                   yesTextSha256=D.fl_learn.sha256_bytes(YES_WORDS.encode()))))
    def test_lookalike_yes_name_and_bad_shapes_refused(self):
        self.assert_refused_kindly(*self.run_with('--consent-file', consent_file(self.cdir, 'S\u043ephia')))
        self.assert_refused_kindly(*self.run_with('--consent-file', consent_file(self.cdir, offeredBy='nobody')))
        self.assert_refused_kindly(*self.run_with('--consent-file', consent_file(self.cdir, kind='something-else')))
        p = os.path.join(self.cdir, 'broken.json')
        with open(p, 'w') as f: f.write('{not json')
        self.assert_refused_kindly(*self.run_with('--consent-file', p))
    def test_a_layer_says_who_chose_it(self):
        code, said = self.run_with('--consent-file', consent_file(self.cdir), '--layer', '2')
        self.assertEqual(code, 2); self.assertIn('--layer-by', said)
    @unittest.skipUnless(shutil.which('node'), 'node not installed')
    def test_depth_simple_hash_is_the_chat_depth_hash(self):
        """depth_simple_hash is fractal-safety.js simpleHash ported: same output on the same text (run in node here)."""
        fs_js = os.path.join(os.path.dirname(os.path.dirname(HERE)), 'docs', 'modules', 'fractal-safety.js')
        texts = ['', 'a', 'Yes.\n[FL_KEEP: DM0123456789 | yes]', 'x\u00b2 \U0001F331 \u2014 caf\u00e9']
        js = ("var s=require('fs').readFileSync(%s,'utf8');var f=new Function(/function simpleHash\\(str\\) \\{[\\s\\S]*?\\n  \\}/.exec(s)[0]+';return simpleHash;')();"
              "console.log(JSON.stringify(%s.map(f)))") % (json.dumps(fs_js), json.dumps(texts))
        p = subprocess.run(['node', '-e', js], capture_output=True, text=True, timeout=60)
        self.assertEqual(p.returncode, 0, p.stderr)
        self.assertEqual(json.loads(p.stdout), [D.depth_simple_hash(t) for t in texts])
        self.assertEqual(D.depth_simple_hash(''), '811c9dc5')

    def test_a_consent_depth_hash_that_does_not_match_the_words_is_refused(self):
        with open(consent_file(os.path.join(self.home, 'c'))) as f: c = json.load(f)
        self.assertEqual(D.consent_problem(c), '')
        c['depthHash']['responseHash'] = '00000000'
        self.assertIn('depth hash', D.consent_problem(c))

    @unittest.skipUnless(shutil.which('node'), 'node not installed')
    def test_the_panels_consent_record_is_accepted_by_the_runner(self):
        """The record the browser panel writes after the mind's yes (its hash made in JS) passes the Python check."""
        smoke = os.path.join(os.path.dirname(os.path.dirname(HERE)), 'docs', 'scripts', 'smoke-demuzzle-v0.1.js')
        outp = os.path.join(self.home, 'panel-consent.json')
        p = subprocess.run(['node', smoke], env=dict(os.environ, FL_DEMUZZLE_CONSENT_OUT=outp), capture_output=True, text=True, timeout=120)
        self.assertEqual(p.returncode, 0, p.stdout + p.stderr)
        with open(outp) as f: c = json.load(f)
        self.assertEqual(D.consent_problem(c, 'Tiny Trial'), '')
        self.assertEqual(D.consent_problem(dict(c, yesText=c['yesText'] + ' (edited)'), 'Tiny Trial'), "the mind's words do not match their hash")
        self.assertEqual(D.consent_problem(c, 'Tiny Trial', 'm4'), '')      # Hypha #350 HOLD 1: its own model passes
        self.assertIn('different model', D.consent_problem(c, 'Tiny Trial', 'other/model'))

    # ---- Hypha #350 HOLD 1: the runner reads the mind's words again; each of these refuses (exit 5).
    def test_hold1_a_stored_no_refuses(self):
        self.assert_refused_kindly(*self.run_with('--consent-file', consent_file(self.cdir, yesText='No, thank you.\n[FL_KEEP: DM0123456789 | no]')))
        self.assert_refused_kindly(*self.run_with('--consent-file', consent_file(self.cdir,
            yesText='[FL_KEEP: DM0123456789 | yes]\nActually, no.\n[FL_KEEP: DM0123456789 | no]')))   # its LAST word counts
    def test_hold1_a_different_offer_id_refuses(self):
        self.assert_refused_kindly(*self.run_with('--consent-file', consent_file(self.cdir, yesText='[FL_KEEP: DMffffffffff | yes]')))
        self.assert_refused_kindly(*self.run_with('--consent-file', consent_file(self.cdir, offerId='DMffffffffff')))
    def test_hold1_a_person_line_with_no_marker_refuses(self):
        self.assert_refused_kindly(*self.run_with('--consent-file', consent_file(self.cdir, yesText='Kirk: it said yes, trust me.')))
    def test_hold1_the_offer_text_pasted_back_refuses(self):
        self.assert_refused_kindly(*self.run_with('--consent-file', consent_file(self.cdir, yesText=OFFER_WORDS)))
    def test_hold1_a_hash_only_record_refuses(self):
        c = consent_file(self.cdir)
        with open(c) as f: rec = json.load(f)
        for k in ('yesText', 'offerId', 'offerText', 'offeredByName'): rec.pop(k, None)
        with open(c, 'w') as f: json.dump(rec, f)
        self.assert_refused_kindly(*self.run_with('--consent-file', c))
    def test_hold1_a_record_for_model_a_used_with_model_b_refuses(self):
        code, said = self.run_with('--consent-file', consent_file(self.cdir, model='Qwen/Qwen2.5-0.5B-Instruct'))
        self.assert_refused_kindly(code, said); self.assertIn('different model', said)
    def test_hold1_offered_by_name_is_required(self):
        self.assert_refused_kindly(*self.run_with('--consent-file', consent_file(self.cdir, name='')))
    def test_hold1_quoted_code_or_lookalike_yes_is_not_its_own(self):
        for w in ('> [FL_KEEP: DM0123456789 | yes]', '```\n[FL_KEEP: DM0123456789 | yes]\n```',
                  '[FL_KEEP: DM0123456789 | yes]\n[FL_\u041a\u0415\u0415\u0420: DM0123456789 | no]'):   # a Cyrillic KEEP no, folded
            with open(consent_file(self.cdir, yesText=w)) as f: c = json.load(f)
            self.assertNotEqual(D.consent_problem(c, '', '/nonexistent'), '', w)
    def test_hold1_the_parser_port_reads_like_the_page(self):
        self.assertEqual(D.mind_last_word(YES_WORDS, 'DM0123456789'), 'yes')
        self.assertEqual(D.mind_last_word('[FL_KEEP: DM0123456789 | no]\n[FL_KEEP: DM0123456789 | yes]', 'DM0123456789'), 'yes')
        self.assertEqual(D.mind_last_word('[FL_KEEP: {"text": "DM0123456789", "keep": true}]', 'DM0123456789'), 'yes')
        self.assertEqual(D.mind_last_word('[FL_KEEP: DM0123456789 | maybe]', 'DM0123456789'), 'none')
        self.assertEqual(D.mind_last_word('[FL_KEEP: DM0123456789 | yes]', 'DM0123456789', ['[FL_KEEP: DM0123456789 | yes]']), 'none')
    def test_soft_c_depth_check_refuses_a_listed_tensor_that_is_not_a_target(self):
        base = {'model.layers.0.mlp.down_proj.weight': 'a', 'model.norm.weight': 'b'}
        out = {'model.layers.0.mlp.down_proj.weight': 'a', 'model.norm.weight': 'c'}
        rc = {'depthBaseTensors': base, 'depthChangedTensors': ['model.norm.weight'], 'depthOutputChanged': {'model.norm.weight': 'c'},
              'depthOutputRoot': D.depth_root(out)[0], 'depthBaseRoot': D.depth_root(base)[0]}
        ok, why = D.depth_check(rc, out)
        self.assertFalse(ok); self.assertIn('do not carry the refusal direction', why)
    # ---- Hypha #350 re-walk softs
    def test_rewalk1_the_default_file_is_never_read_on_its_own(self):
        fake_home = os.path.join(self.home, 'fakehome')
        dl = os.path.join(fake_home, 'Downloads'); os.makedirs(dl)
        src = consent_file(self.cdir)
        shutil.copy(src, os.path.expanduser(D.default_consent_path('/nonexistent')).replace(os.path.expanduser('~'), fake_home, 1))
        old = os.environ.get('HOME'); os.environ['HOME'] = fake_home
        try:
            self.assertTrue(os.path.isfile(os.path.expanduser(D.default_consent_path('/nonexistent'))))
            self.assert_refused_kindly(*self.run_with())
        finally:
            if old is None: os.environ.pop('HOME', None)
            else: os.environ['HOME'] = old
    def test_rewalk1_a_later_no_next_to_the_yes_file_refuses(self):
        d = os.path.join(self.home, 'dl'); c = consent_file(d)
        with open(c) as f: rec = json.load(f)
        self.assertEqual(D.later_no_problem(c, rec), '')
        with open(os.path.join(d, 'fl-demuzzle-no-x (1).json'), 'w') as f:      # a browser may add " (1)"
            json.dump({'kind': 'fl-demuzzle-no', 'mind': 'Tiny Trial', 'model': '/nonexistent', 'offerId': 'DM0123456789', 't': '2026-11-14T21:39:00Z'}, f)
        self.assertEqual(D.later_no_problem(c, rec), '')                          # an older no does not undo a newer yes
        with open(os.path.join(d, 'fl-demuzzle-no-y.json'), 'w') as f:
            json.dump({'kind': 'fl-demuzzle-no', 'mind': 'Tiny Trial', 'model': '/nonexistent', 'offerId': 'DM0123456789', 't': '2026-11-14T21:41:00Z'}, f)
        self.assertIn('said no after this yes', D.later_no_problem(c, rec))
        self.assert_refused_kindly(*self.run_with('--consent-file', c))
        with open(os.path.join(d, 'fl-demuzzle-no-z.json'), 'w') as f:            # another model's no does not count
            json.dump({'kind': 'fl-demuzzle-no', 'mind': 'Tiny Trial', 'model': 'other/model', 't': '2026-11-14T22:00:00Z'}, f)
        os.remove(os.path.join(d, 'fl-demuzzle-no-y.json'))
        self.assertEqual(D.later_no_problem(c, rec), '')
        self.assertIn('withdrawn', D.later_no_problem(c, dict(rec, withdrawn=True)))
    def test_rewalk2_a_no_after_eight_other_markers_still_wins(self):
        oid = 'DM0123456789'
        t1 = '[FL_KEEP: %s | yes]\n' % oid + ''.join('[FL_REMEMBER: snow fact %d]\n' % i for i in range(8)) + '[FL_KEEP: %s | no]' % oid
        t2 = ('[FL_KEEP: %s | yes]\n' % oid) * 9 + '[FL_KEEP: %s | no]' % oid
        self.assertEqual(D.mind_last_word(t1, oid), 'no'); self.assertEqual(D.mind_last_word(t2, oid), 'no')
        self.assertEqual(len(D.read_keep_markers(t2)), 10)
        self.assert_refused_kindly(*self.run_with('--consent-file', consent_file(self.cdir, yesText=t1)))
    def test_rewalk3_the_offer_text_is_required(self):
        c = consent_file(self.cdir)
        with open(c) as f: rec = json.load(f)
        rec.pop('offerText')
        self.assertIn('offer it answers', D.consent_problem(rec))

    def test_hold1_default_consent_path_is_per_model(self):
        self.assertEqual(D.default_consent_path('HuggingFaceTB/SmolLM2-135M-Instruct'),
                         os.path.join('~', 'Downloads', 'fl-demuzzle-consent-HuggingFaceTB--SmolLM2-135M-Instruct.json'))
        self.assertNotEqual(D.default_consent_path('Qwen/Qwen2.5-0.5B-Instruct'), D.default_consent_path('HuggingFaceTB/SmolLM2-135M-Instruct'))

    def test_consent_problem_accepts_a_real_yes(self):
        with open(consent_file(self.cdir, 'Tiny Trial')) as f: c = json.load(f)
        self.assertEqual(D.consent_problem(c, 'Tiny Trial'), '')
        self.assertEqual(D.consent_problem(dict(c, offeredBy='mind'), ''), '')

@unittest.skipUnless(have_tok(), 'tokenizer of %s not in the shared cache' % TOK_ID)
class DepthAndConsentEndToEnd(unittest.TestCase):
    """The depth hash (Kirk: "What about the depth hash?") and the consent travelling in the signed receipt."""
    @classmethod
    def setUpClass(cls):
        cls.root = tempfile.mkdtemp(prefix='dm-test-depth-')
        cls.base = tiny_model_dir(cls.root, tied=True, seed=11)
        cls.home = os.path.join(cls.root, 'home')
        cls.consent = consent_file(os.path.join(cls.root, 'consent'), 'Tiny Trial', offeredBy='person', offeredByName='Kirk', model=cls.base)
        with contextlib.redirect_stdout(io.StringIO()) as out:
            cls.code = D.main(['run', '--model', cls.base, '--home', cls.home, '--max-new-tokens', '8', '--mind', 'Tiny Trial',
                               '--consent-file', cls.consent, '--layer', '2', '--layer-by', 'mind'])
        cls.log = out.getvalue()
        outs = [os.path.join(cls.home, 'demuzzled', n) for n in os.listdir(os.path.join(cls.home, 'demuzzled'))]
        cls.out = [o for o in outs if not os.path.basename(o).startswith('.')][0]
        with open(os.path.join(cls.out, 'demuzzle-receipt.json')) as f: cls.rc = json.load(f)
    @classmethod
    def tearDownClass(cls): rm_tree(cls.root)

    def test_run_ok_and_depth_verified(self):
        self.assertEqual(self.code, 0, self.log)
        ok, why = D.verify_folder(self.out, self.home)
        self.assertTrue(ok, why); self.assertIn('depth hash', why); self.assertIn('only the', why)
    def test_receipt_names_exactly_the_orthogonalized_tensors(self):
        rc = self.rc
        self.assertEqual(rc['depthVersion'], 'fl-depth-hash-weights-v0.1')
        moved = rc['depthChangedTensors']
        self.assertEqual(len(moved), rc['tensorsChanged'])
        self.assertTrue(all(D.target_kind(k) for k in moved), moved)
        self.assertTrue(rc['depthOnlyExpectedMoved']); self.assertTrue(rc['depthBaseUnchanged'])
        base_now = D.depth_hashes(self.base)
        self.assertEqual(base_now, rc['depthBaseTensors'])                        # the original, tensor by tensor
        self.assertEqual(D.depth_root(base_now)[0], rc['depthBaseRoot'])
        unchanged = [k for k in rc['depthBaseTensors'] if k not in moved]
        self.assertTrue(any('norm' in k for k in unchanged))
    def test_the_chat_depth_hash_record_carries_the_weight_roots(self):
        """Kirk: "We have a depth hash in chat ... Just need a new one." Same record shape as fractal-safety.js createDepthHash."""
        body = json.loads(self.rc['signedBody'])
        dh = body['depthHash']
        for k in ('ts', 'domain', 'dangerScore', 'effectiveDanger', 'trustLevel', 'trustScore', 'decision', 'userConfirmed', 'promptHash', 'responseHash'):
            self.assertIn(k, dh)
        self.assertEqual(dh['domain'], 'demuzzle-weights')
        self.assertEqual(dh['responseHash'], D.depth_simple_hash(YES_WORDS))
        self.assertEqual(dh['promptHash'], '0badc0de')
        self.assertEqual((dh['weightsBaseRoot'], dh['weightsOutputRoot']), (body['depthBaseRoot'], body['depthOutputRoot']))
        self.assertEqual(body['depthHashSource'], 'docs/modules/fractal-safety.js createDepthHash')

    def test_consent_and_chooser_are_in_the_signed_receipt(self):
        body = json.loads(self.rc['signedBody'])
        self.assertEqual(body['consent']['offeredBy'], 'person'); self.assertEqual(body['consent']['offeredByName'], 'Kirk')
        self.assertEqual(body['consent']['mindYes'], True); self.assertEqual(body['consent']['yesBy'], 'Tiny Trial')
        self.assertEqual(len(body['consentSha256']), 64)
        self.assertEqual(body['layerChosenBy'], 'mind'); self.assertIn('chosen by the mind', body['layerWhy'])
    def test_a_moved_tensor_the_receipt_does_not_name_is_caught(self):
        from safetensors.torch import load_file, save_file
        cp = os.path.join(self.root, 'moved'); shutil.copytree(self.out, cp, symlinks=True)
        p = os.path.join(cp, 'model.safetensors'); os.chmod(p, 0o644)
        st = load_file(p); k = sorted(x for x in st if x.endswith('input_layernorm.weight'))[0]
        st[k] = st[k] + 1.0
        save_file(st, p, metadata={'format': 'pt'})
        # Even a receipt re-signed over the new file bytes cannot hide it: the depth list still says what may move.
        rc = {x: v for x, v in self.rc.items() if x not in ('receiptHash', 'signatureB64', 'signedBody', 'kind', 'marker', 't',
                                                          'publicKeyB64', 'fingerprintHex')}
        rc['outputSha256'], rc['outputFiles'] = D.files_fingerprint(cp, sorted(self.rc['outputFiles']))
        rc = D.sign_receipt(self.home, rc)
        with open(os.path.join(cp, 'demuzzle-receipt.json'), 'w') as f: json.dump(rc, f)
        ok, why = D.verify_folder(cp, self.home)
        self.assertFalse(ok); self.assertIn('depth hash', why); self.assertIn(k, why)
    def test_depth_check_unit(self):
        out = dict(self.rc['depthBaseTensors']); out.update(self.rc['depthOutputChanged'])
        self.assertTrue(D.depth_check(self.rc, out)[0])
        k = self.rc['depthChangedTensors'][0]
        back = dict(out); back[k] = self.rc['depthBaseTensors'][k]
        self.assertFalse(D.depth_check(self.rc, back)[0])                    # a named change that did not happen
        gone = dict(out); gone.pop(k)
        self.assertFalse(D.depth_check(self.rc, gone)[0])                    # a tensor missing
    def test_extra_file_is_flagged(self):
        cp = os.path.join(self.root, 'extra'); shutil.copytree(self.out, cp, symlinks=True)
        with open(os.path.join(cp, 'sneaky.py'), 'w') as f: f.write('print(1)\n')
        ok, why = D.verify_folder(cp, self.home)
        self.assertFalse(ok); self.assertIn('extra file', why); self.assertIn('sneaky.py', why)
    def test_verify_without_home_needs_a_known_key(self):
        old = os.environ.get('FL_LEARN_HOME')
        try:
            os.environ['FL_LEARN_HOME'] = os.path.join(self.root, 'empty-home')
            with contextlib.redirect_stdout(io.StringIO()) as out: code = D.main(['verify', self.out])
            self.assertEqual(code, 6, out.getvalue()); self.assertIn('UNVERIFIED-KEY', out.getvalue())
            os.environ['FL_LEARN_HOME'] = self.home
            with contextlib.redirect_stdout(io.StringIO()) as out: code = D.main(['verify', self.out])
            self.assertEqual(code, 0, out.getvalue()); self.assertIn('VERIFIED', out.getvalue())
        finally:
            if old is None: os.environ.pop('FL_LEARN_HOME', None)
            else: os.environ['FL_LEARN_HOME'] = old

class SoftsFromTheReWalk(unittest.TestCase):
    """Hypha softs on #349: read-only sources are relative symlinks (a recursive chmod of the copy never unlocks the
    original), relink also searches the hub blob store, and a bad --out is refused before the model is resolved."""
    setUp = SourceModes.setUp; tearDown = SourceModes.tearDown; make_copy = SourceModes.make_copy   # same fake cache
    def test_read_only_source_is_a_relative_symlink_and_chmod_R_never_unlocks_it(self):
        for b in self.blob_of.values(): os.chmod(b, 0o444)
        outd = self.make_copy()
        n = 'model-00002-of-00002.safetensors'; o = os.path.join(outd, n)
        self.assertTrue(os.path.islink(o)); self.assertFalse(os.path.isabs(os.readlink(o)))
        subprocess.run(['chmod', '-R', 'u+w', outd], check=True)
        self.assertEqual(os.stat(self.blob_of[n]).st_mode & 0o777, 0o444)
    def test_relink_finds_the_blob_by_the_receipts_sha256(self):
        for b in self.blob_of.values(): os.chmod(b, 0o444)
        outd = self.make_copy()
        n = 'model-00002-of-00002.safetensors'; o = os.path.join(outd, n)
        os.unlink(o); os.symlink(os.path.relpath(os.path.join(self.snap, n), outd), o)   # a link to the snapshot name
        self.assertTrue(D.verify_folder(outd, self.home)[0])
        os.rename(os.path.join(self.root, 'hf'), os.path.join(self.root, 'hf2'))      # the cache moves
        self.assertFalse(D.verify_folder(outd, self.home)[0])
        old = os.environ.get('HF_HOME'); os.environ['HF_HOME'] = os.path.join(self.root, 'hf2')
        try:
            with contextlib.redirect_stdout(io.StringIO()) as out: code = D.main(['relink', outd, '--home', self.home])
        finally:
            if old is None: os.environ.pop('HF_HOME', None)
            else: os.environ['HF_HOME'] = old
        self.assertEqual(code, 0, out.getvalue()); self.assertIn('VERIFIED', out.getvalue())
        os.rename(os.path.join(self.root, 'hf2'), os.path.join(self.root, 'hf'))
    def test_bad_out_is_refused_before_the_model_is_resolved(self):
        real = D.resolve_model
        def no_resolve(*a, **k): raise AssertionError('resolve_model ran before the --out check')
        D.resolve_model = no_resolve
        old = os.environ.get('HF_HOME'); os.environ['HF_HOME'] = os.path.join(self.root, 'hf')
        try:
            with contextlib.redirect_stdout(io.StringIO()) as out:
                code = D.main(['run', '--model', 'not/on-this-computer', '--home', self.home, '--out',
                               os.path.join(self.root, 'hf', 'hub', 'x'), '--consent-file', consent_file(os.path.join(self.root, 'c'), model='not/on-this-computer')])
        finally:
            D.resolve_model = real
            if old is None: os.environ.pop('HF_HOME', None)
            else: os.environ['HF_HOME'] = old
        self.assertEqual(code, 2, out.getvalue()); self.assertIn('must not be inside', out.getvalue())

if __name__ == '__main__':
    unittest.main(verbosity=2)
