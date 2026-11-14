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
                code = D.main(['run', '--model', self.snap, '--home', self.home, '--out', os.path.join(self.root, 'hf', 'hub', 'x')])
        finally:
            D.load_model = real_load
            if old is None: os.environ.pop('HF_HOME', None)
            else: os.environ['HF_HOME'] = old
        self.assertEqual(code, 2, out.getvalue()); self.assertIn('must not be inside', out.getvalue())

if __name__ == '__main__':
    unittest.main(verbosity=2)
