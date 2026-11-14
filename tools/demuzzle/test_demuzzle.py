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
            code = D.main(['run', '--model', d, '--home', self.home])
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
            cls.code = D.main(['run', '--model', cls.base, '--home', cls.home, '--max-new-tokens', '8', '--mind', 'Tiny Trial'])
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
            self.assertEqual(rc['linkKinds'][n], 'hardlink', n)                  # same disk here: a hard link
            self.assertFalse(os.path.islink(o)); self.assertEqual(os.stat(o).st_ino, os.stat(b).st_ino)
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
            self.assertFalse(os.path.isabs(os.readlink(cfg)))
        finally:
            os.link = real_link
            rm_tree(root)

    def test_busy_lock(self):
        g = open(os.path.join(self.home, 'trainer.lock'), 'a+'); fcntl.flock(g, fcntl.LOCK_EX)
        try:
            with contextlib.redirect_stdout(io.StringIO()):
                with self.assertRaises(SystemExit) as cm:
                    D.main(['run', '--model', self.base, '--home', self.home])
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

if __name__ == '__main__':
    unittest.main(verbosity=2)
