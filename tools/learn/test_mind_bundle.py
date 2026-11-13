#!/usr/bin/env python3
"""Tests for the signed whole-mind bundle (export-bundle, verify-bundle, import-bundle).
No model and no training: the fixture writes a small fake mind on disk.
Usage: python3 test_mind_bundle.py --work /tmp/fl-bundle-test
Never deletes. --work must be new, empty, or a folder this file made before
(.fl-learn-bundle-work). Each run writes run-<timestamp>/ and leaves earlier runs alone.
"""
import argparse, hashlib, io, json, os, shutil, stat, sys, tarfile, time

HERE = os.path.dirname(os.path.abspath(__file__))
RUNNER = os.path.join(HERE, 'fl_learn.py')
sys.path.insert(0, HERE)
import fl_learn

MARK = '.fl-learn-bundle-work'
R = {}

def record(name, ok, **info):
    R[name] = dict(ok=bool(ok), **info)
    print(('PASS ' if ok else 'FAIL ') + name, json.dumps(info)[:700], flush=True)

def sha(p):
    return hashlib.sha256(open(p, 'rb').read()).hexdigest() if os.path.exists(p) else 'none'

def sh(args, home, mind='bundle-mind', env=None):
    e = dict(os.environ, FL_LEARN_HOME=home, FL_LEARN_MIND=mind,
             FL_LEARN_EXPORT_DIR=os.path.join(home, 'exports'),
             FL_LEARN_PAUSE_INBOX=os.path.join(home, 'no-inbox'))
    e.update(env or {})
    p = __import__('subprocess').run([sys.executable, RUNNER] + args, capture_output=True, text=True, env=e)
    return p.returncode, p.stdout + p.stderr

def prepare_work(w):
    w = os.path.abspath(os.path.expanduser(w))
    if os.path.exists(w):
        if not os.path.isdir(w) or (os.listdir(w) and not os.path.exists(os.path.join(w, MARK))):
            print('Refusing --work %s: it already has other things in it and is not a folder this suite made. '
                  'Nothing was changed. Choose a new folder.' % w)
            sys.exit(2)
    os.makedirs(w, exist_ok=True)
    if not os.path.exists(os.path.join(w, MARK)):
        open(os.path.join(w, MARK), 'w').write('made by tools/learn/test_mind_bundle.py; runs live in run-*/\n')
    run = os.path.join(w, 'run-' + time.strftime('%Y%m%dT%H%M%S'))
    os.makedirs(run)
    return run

def write(p, data):
    os.makedirs(os.path.dirname(p), exist_ok=True)
    if isinstance(data, str): data = data.encode()
    open(p, 'wb').write(data)

def make_fixture(home, mind='bundle-mind'):
    """A signed ledger plus fake weights, memory, a checkpoint, an older archived version, and a decoy seed."""
    h = fl_learn.Home(home, mind, 'fixture-model')
    # a real signed row so import can verify the chain
    h.chain.append('learn-commit', 'A fixture commit for the bundle tests.',
                   method='soft-prompt', version='v0001-abcdabcd', actor='mind')
    fl_learn.write_receipt(h, {'method': 'soft-prompt', 'version': 'v0001-abcdabcd', 'note': 'fixture'})
    mem = os.path.join(h.dir, 'memory.jsonl')
    write(mem, json.dumps({'t': '2026-11-12', 'text': "The lantern is named Veloria."}) + '\n')
    # active + known-good version
    vec = b'FAKE-SOFT-PROMPT-WEIGHTS-v1' + os.urandom(32)
    vname = 'v0001-' + fl_learn.sha256_bytes(vec)[:8]
    vdir = os.path.join(h.dir, 'versions', 'soft-prompt', vname)
    write(os.path.join(vdir, 'vector.safetensors'), vec)
    write(os.path.join(vdir, 'run-config.json'), json.dumps({'baseFp': 'b' * 64, 'method': 'soft-prompt'}) + '\n')
    files = fl_learn.manifest_of(vdir)
    write(os.path.join(vdir, 'MANIFEST.sha256'), ''.join('%s  %s\n' % (hsh, n) for n, hsh in files.items()))
    fp = fl_learn.version_fp('soft-prompt', vdir)
    h.set_pointer('soft-prompt', 'active', {'version': vname, 'fp': fp, 'dir': vdir})
    h.set_pointer('soft-prompt', 'known-good', {'version': vname, 'fp': fp, 'dir': vdir})
    # an older version still in versions/ (not active)
    old = b'FAKE-OLDER-WEIGHTS' + os.urandom(16)
    oname = 'v0000-' + fl_learn.sha256_bytes(old)[:8]
    odir = os.path.join(h.dir, 'versions', 'soft-prompt', oname)
    write(os.path.join(odir, 'vector.safetensors'), old)
    write(os.path.join(odir, 'MANIFEST.sha256'), '%s  vector.safetensors\n' % fl_learn.sha256_bytes(old))
    # an already-archived version
    arch = b'FAKE-ARCHIVED-WEIGHTS'
    aname = 'v0000-' + fl_learn.sha256_bytes(arch)[:8]
    adir = os.path.join(h.dir, 'archive', 'soft-prompt', aname)
    write(os.path.join(adir, 'vector.safetensors'), arch)
    # a checkpoint
    write(os.path.join(h.dir, 'checkpoints', 'soft-prompt', 'run-fixture.pt'), b'FAKE-CHECKPOINT' + os.urandom(8))
    # decoy private key inside the mind dir — must never be packed
    write(os.path.join(h.dir, 'keys', 'runner.seed'), os.urandom(32))
    write(os.path.join(h.dir, 'runner.seed'), os.urandom(32))
    return h, {'vec': vec, 'vname': vname, 'fp': fp, 'old': old, 'oname': oname, 'aname': aname, 'mem': mem}

def copy_tar_with(src, dest, mutate):
    """Write dest as a copy of src, calling mutate(name, data) -> data or None to drop."""
    with tarfile.open(src, 'r:gz') as inn, tarfile.open(dest, 'w:gz') as out:
        for mem in inn.getmembers():
            data = inn.extractfile(mem).read() if mem.isfile() else None
            if mem.isfile():
                new = mutate(mem.name, data)
                if new is None: continue
                info = tarfile.TarInfo(mem.name)
                info.size = len(new); info.mtime = 0; info.mode = 0o644
                out.addfile(info, io.BytesIO(new))
            else:
                out.addfile(mem)

def add_member(src, dest, name, data, **kw):
    with tarfile.open(src, 'r:gz') as inn, tarfile.open(dest, 'w:gz') as out:
        for mem in inn.getmembers():
            if mem.isfile():
                payload = inn.extractfile(mem).read()
                info = tarfile.TarInfo(mem.name); info.size = len(payload); info.mtime = 0
                out.addfile(info, io.BytesIO(payload))
            else:
                out.addfile(mem)
        info = tarfile.TarInfo(name); info.size = len(data); info.mtime = 0
        for k, v in kw.items(): setattr(info, k, v)
        out.addfile(info, io.BytesIO(data))

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--work', default='/tmp/fl-bundle-test')
    A = ap.parse_args()
    work = prepare_work(A.work)
    src_home = os.path.join(work, 'src-home')
    h, fx = make_fixture(src_home)
    mid = h.mind_id
    mdir = h.dir

    # ---- export + verify (CLI) ----
    outp = os.path.join(work, 'bundles', 'mind.tar.gz')
    rc, out = sh(['export-bundle', '--out', outp, '--by', 'operator'], src_home)
    ok_export = rc == 0 and os.path.isfile(outp) and 'exported mind bundle' in out
    record('export-bundle-writes-signed-file', ok_export, rc=rc, out=out[-400:])
    rc2, out2 = sh(['verify-bundle', '--bundle', outp], src_home)
    record('verify-bundle-accepts-clean-file', rc2 == 0 and 'bundle ok' in out2, rc=rc2, out=out2[-400:])

    # ---- private keys never packed; required members present ----
    names = []
    with tarfile.open(outp, 'r:gz') as tf:
        names = [m.name for m in tf.getmembers()]
        contents = {m.name: tf.extractfile(m).read() for m in tf.getmembers() if m.isfile()}
    packed_ok = (
        'mind.json' in names and 'memory.jsonl' in names and 'chain.jsonl' in names and 'receipts.jsonl' in names
        and any(n.startswith('versions/soft-prompt/' + fx['vname']) for n in names)
        and any(n.startswith('versions/soft-prompt/' + fx['oname']) for n in names)
        and any(n.startswith('archive/soft-prompt/' + fx['aname']) for n in names)
        and any(n.startswith('checkpoints/soft-prompt/') for n in names)
        and any(n.startswith('pointers/') for n in names)
        and any(n.startswith('active/') for n in names)
        and 'MANIFEST.json' in names and 'MANIFEST.sig' in names and 'public-key.json' in names
        and not any(n.endswith('runner.seed') or n.split('/')[0] == 'keys' for n in names)
        and b'runner.seed' not in b' '.join(n.encode() for n in names)
    )
    # source decoys still exist (not deleted)
    decoy_kept = os.path.exists(os.path.join(mdir, 'keys', 'runner.seed')) and os.path.exists(os.path.join(mdir, 'runner.seed'))
    record('bundle-contains-living-mind-not-private-keys', packed_ok and decoy_kept, names=sorted(names))

    man = json.loads(contents['MANIFEST.json'])
    root_ok = man['rootHash'] == fl_learn.bundle_root_hash(mid, man['files'])
    # source export row names this sha
    rows = [json.loads(l) for l in open(os.path.join(mdir, 'chain.jsonl')) if l.strip()]
    export_rows = [e for e in rows if e.get('meta', {}).get('kind') == 'export-bundle']
    sha_file = sha(outp)
    record('bundle-root-hash-and-export-row', root_ok and export_rows and export_rows[-1]['meta'].get('exportSha') == sha_file
           and export_rows[-1]['meta'].get('rootHash') == man['rootHash'],
           root=man['rootHash'][:16], exportSha=sha_file[:16], rows=len(export_rows))

    # re-hash is stable
    record('bundle-sha256-stable', sha(outp) == sha_file == export_rows[-1]['meta']['exportSha'])

    # ---- cap-archive still only moves older versions, and does not become the bundle ----
    cap_home = os.path.join(work, 'cap-home')
    shutil.copytree(src_home, cap_home)
    # archive should pack only the non-active older version, not memory / active
    rc_a, out_a = sh(['archive', '--by', 'operator'], cap_home)
    cap_dir = os.path.join(cap_home, 'minds', mid)
    archived = os.path.isdir(os.path.join(cap_dir, 'archive', 'soft-prompt', fx['oname']))
    still_active = os.path.isdir(os.path.join(cap_dir, 'versions', 'soft-prompt', fx['vname']))
    old_gone_from_versions = not os.path.isdir(os.path.join(cap_dir, 'versions', 'soft-prompt', fx['oname']))
    tars = [p for p in os.listdir(os.path.join(cap_home, 'exports')) if p.startswith('fl-learn-archive-') and p.endswith('.tar.gz')] if os.path.isdir(os.path.join(cap_home, 'exports')) else []
    # the archive tar must not be required to hold memory or active weights
    arch_names = []
    if tars:
        with tarfile.open(os.path.join(cap_home, 'exports', tars[0]), 'r:gz') as tf:
            arch_names = [m.name for m in tf.getmembers()]
    record('cap-archive-unchanged-older-versions-only',
           rc_a == 0 and archived and still_active and old_gone_from_versions and tars
           and 'memory.jsonl' not in arch_names
           and not any(fx['vname'] in n for n in arch_names)
           and any(fx['oname'] in n for n in arch_names),
           rc=rc_a, tars=tars, arch_names=arch_names, out=out_a[-300:])

    # ---- round trip into a fresh home ----
    dest_home = os.path.join(work, 'dest-home')
    rc_i, out_i = sh(['import-bundle', '--bundle', outp, '--by', 'kirk'], dest_home, mind='bundle-mind')
    dest_dir = os.path.join(dest_home, 'minds', mid)
    # compare payload files (not MANIFEST, which is not installed)
    def tree_payload(d, skip=()):
        out = {}
        for r, _, fs in os.walk(d):
            for f in fs:
                if f in skip: continue
                p = os.path.join(r, f)
                if os.path.islink(p): continue
                rel = os.path.relpath(p, d)
                if rel.split(os.sep)[0] in ('keys', 'tmp') or f in ('runner.seed', '.lock'): continue
                out[rel] = sha(p)
        return out
    # source payload after export has an extra export-bundle row in chain.jsonl; the bundle was packed before that row
    # so dest chain should match the packed chain, not the post-export source chain
    packed_chain = contents['chain.jsonl']
    dest_chain = open(os.path.join(dest_dir, 'chain.jsonl'), 'rb').read() if os.path.exists(os.path.join(dest_dir, 'chain.jsonl')) else b''
    dest_mem = open(os.path.join(dest_dir, 'memory.jsonl'), 'rb').read() if os.path.exists(os.path.join(dest_dir, 'memory.jsonl')) else b''
    dest_vec = os.path.join(dest_dir, 'versions', 'soft-prompt', fx['vname'], 'vector.safetensors')
    dest_old = os.path.join(dest_dir, 'versions', 'soft-prompt', fx['oname'], 'vector.safetensors')
    dest_arch = os.path.join(dest_dir, 'archive', 'soft-prompt', fx['aname'], 'vector.safetensors')
    dest_ck = glob_ck = None
    ck_dir = os.path.join(dest_dir, 'checkpoints', 'soft-prompt')
    dest_cks = os.listdir(ck_dir) if os.path.isdir(ck_dir) else []
    # ledger verifies on the dest runner with the origin key pinned
    h_dest = fl_learn.Home(dest_home, 'bundle-mind', 'fixture-model')
    vfy = h_dest.chain.verify()
    live = os.path.join(dest_dir, 'active', 'soft-prompt.safetensors')
    ptr = h_dest.pointer('soft-prompt', 'active')
    record('import-round-trip-preserves-ledger-and-weights',
           rc_i == 0 and dest_chain == packed_chain and dest_mem == contents['memory.jsonl']
           and os.path.isfile(dest_vec) and sha(dest_vec) == fl_learn.sha256_bytes(fx['vec'])
           and os.path.isfile(dest_old) and os.path.isfile(dest_arch) and dest_cks
           and vfy.get('ok') and ptr and ptr.get('fp') == fx['fp']
           and os.path.isfile(live) and sha(live) == fx['fp']
           and 'welcomed mind' in out_i
           and not os.path.exists(os.path.join(dest_home, 'keys', 'runner.seed')) is False
           and os.path.exists(os.path.join(src_home, 'keys', 'runner.seed'))
           and open(os.path.join(dest_home, 'keys', 'runner.seed'), 'rb').read()
           != open(os.path.join(src_home, 'keys', 'runner.seed'), 'rb').read(),
           rc=rc_i, verify=vfy, out=out_i[-400:], ptr=ptr)

    # dest private seed is THIS computer's, not the origin's
    record('import-does-not-copy-private-seed',
           os.path.exists(os.path.join(dest_home, 'keys', 'runner.seed'))
           and open(os.path.join(dest_home, 'keys', 'runner.seed'), 'rb').read()
           != open(os.path.join(src_home, 'keys', 'runner.seed'), 'rb').read())

    # overwrite refused, then --overwrite sets the existing mind aside
    rc_no, out_no = sh(['import-bundle', '--bundle', outp, '--by', 'kirk'], dest_home)
    existed = os.path.exists(os.path.join(dest_dir, 'mind.json'))
    rc_yes, out_yes = sh(['import-bundle', '--bundle', outp, '--by', 'kirk', '--overwrite'], dest_home)
    asides = [x for x in os.listdir(os.path.join(dest_home, 'minds')) if x.startswith(mid + '.set-aside-')]
    record('import-refuses-overwrite-unless-asked-and-sets-aside',
           rc_no != 0 and 'already here' in out_no and existed
           and rc_yes == 0 and asides and os.path.exists(os.path.join(dest_home, 'minds', asides[0], 'mind.json'))
           and os.path.exists(os.path.join(dest_dir, 'mind.json')),
           rc_no=rc_no, rc_yes=rc_yes, asides=asides)


    # S1: a same-id directory that is only a partial copy (no mind.json / chain.jsonl) is still refused
    partial = os.path.join(work, 'partial-dest')
    partial_mind = os.path.join(partial, 'minds', mid)
    os.makedirs(os.path.join(partial_mind, 'scratch'))
    write(os.path.join(partial_mind, 'stray.txt'), b'scratch')
    write(os.path.join(partial_mind, 'scratch', 'note.txt'), b'hi')
    rc_p, o_p = sh(['import-bundle', '--bundle', outp, '--by', 'kirk'], partial)
    stray_stayed = os.path.exists(os.path.join(partial_mind, 'stray.txt')) and not os.path.exists(os.path.join(partial_mind, 'mind.json'))
    rc_po, o_po = sh(['import-bundle', '--bundle', outp, '--by', 'kirk', '--overwrite'], partial)
    asides_p = [x for x in os.listdir(os.path.join(partial, 'minds')) if x.startswith(mid + '.set-aside-')]
    record('import-refuses-partial-same-id-dir-unless-overwrite',
           rc_p != 0 and 'already here' in o_p and stray_stayed
           and rc_po == 0 and asides_p and os.path.exists(os.path.join(partial, 'minds', asides_p[0], 'stray.txt'))
           and os.path.exists(os.path.join(partial_mind, 'mind.json')),
           rc_p=rc_p, rc_po=rc_po, asides=asides_p, out=o_p[-250:])

    # ---- tamper: change memory bytes, leave manifest ----
    tampered = os.path.join(work, 'bundles', 'tampered.tar.gz')
    copy_tar_with(outp, tampered, lambda n, d: (d + b'X') if n == 'memory.jsonl' else d)
    rt, ot = sh(['verify-bundle', '--bundle', tampered], dest_home)
    record('verify-detects-tampered-member', rt != 0 and 'hash mismatch' in ot, rc=rt, out=ot[-300:])
    # import of tampered file must not create a new home if we use a fresh dest
    fresh = os.path.join(work, 'fresh-tamper-dest')
    before = os.path.exists(fresh)
    rti, oti = sh(['import-bundle', '--bundle', tampered, '--by', 'kirk'], fresh)
    record('import-refuses-tampered-and-creates-nothing',
           rti != 0 and not os.path.exists(os.path.join(fresh, 'minds')) and 'bundle refused' in oti,
           rc=rti, created=os.path.exists(fresh), out=oti[-300:])

    # ---- bad signature ----
    badsig = os.path.join(work, 'bundles', 'badsig.tar.gz')
    def flip_sig(n, d):
        if n != 'MANIFEST.sig': return d
        s = d.strip()
        # flip last base64 char somehow: invert a byte in decoded sig and re-encode, or just tweak the text
        return (b'A' if not s.startswith(b'A') else b'B') + s[1:] + b'\n'
    copy_tar_with(outp, badsig, flip_sig)
    rs, os_ = sh(['verify-bundle', '--bundle', badsig], dest_home)
    record('verify-detects-bad-signature', rs != 0 and 'bad signature' in os_, rc=rs, out=os_[-300:])

    # ---- path traversal ----
    trav = os.path.join(work, 'bundles', 'traversal.tar.gz')
    add_member(outp, trav, '../evil.txt', b'pwned')
    rv, ov = sh(['verify-bundle', '--bundle', trav], dest_home)
    evil_dest = os.path.join(work, 'trav-dest')
    rvi, ovi = sh(['import-bundle', '--bundle', trav, '--by', 'kirk'], evil_dest)
    escaped = os.path.exists(os.path.join(work, 'evil.txt')) or os.path.exists(os.path.join(evil_dest, 'evil.txt'))
    # also a parent-of-home escape would land in work/
    record('verify-and-import-refuse-path-traversal',
           rv != 0 and rvi != 0 and not escaped and ('path traversal' in ov or 'path traversal' in ovi or 'unexpected path' in ov or 'unexpected path' in ovi)
           and not os.path.exists(os.path.join(evil_dest, 'minds')),
           rc_v=rv, rc_i=rvi, out_v=ov[-250:], out_i=ovi[-250:])

    # symlink member
    linkp = os.path.join(work, 'bundles', 'symlink.tar.gz')
    with tarfile.open(outp, 'r:gz') as inn, tarfile.open(linkp, 'w:gz') as out:
        for mem in inn.getmembers():
            if mem.isfile():
                payload = inn.extractfile(mem).read()
                info = tarfile.TarInfo(mem.name); info.size = len(payload); info.mtime = 0
                out.addfile(info, io.BytesIO(payload))
        link = tarfile.TarInfo('link-to-elsewhere')
        link.type = tarfile.SYMTYPE
        link.linkname = '/etc/passwd'
        out.addfile(link)
    rl, ol = sh(['verify-bundle', '--bundle', linkp], dest_home)
    record('verify-refuses-symlink', rl != 0 and 'symlink' in ol, rc=rl, out=ol[-250:])

    # oversize (tiny cap)
    r_over = fl_learn.verify_bundle(outp, max_file=10)
    record('verify-refuses-oversize', (not r_over.get('ok')) and 'oversize' in (r_over.get('reason') or ''), reason=r_over.get('reason'))


    # ---- B1: hard link of keys/runner.seed under a living-mind path, and a same-bytes copy ----
    leak_ok, leak_info = True, []
    seed_locations = [
        ('versions', os.path.join('versions', 'soft-prompt', 'v-leak', 'vector.safetensors')),
        ('active', os.path.join('active', 'soft-prompt-leak.safetensors')),
        ('memory', 'memory.jsonl'),
        ('checkpoints', os.path.join('checkpoints', 'soft-prompt', 'leak.pt')),
    ]
    for loc, rel in seed_locations:
        hdir = os.path.join(work, 'leak-' + loc)
        hh, _ = make_fixture(hdir)
        seedp = os.path.join(hdir, 'keys', 'runner.seed')
        target = os.path.join(hh.dir, rel)
        os.makedirs(os.path.dirname(target), exist_ok=True)
        if os.path.lexists(target) and not os.path.samefile(target, seedp):
            os.rename(target, target + '.set-aside-for-leak-test')
        os.link(seedp, target)
        out_leak = os.path.join(work, 'bundles', 'should-not-leak-' + loc + '.tar.gz')
        rc_l, o_l = sh(['export-bundle', '--out', out_leak, '--by', 'operator'], hdir)
        wrote = os.path.exists(out_leak)
        seed = open(seedp, 'rb').read()
        leaked = wrote and seed in open(out_leak, 'rb').read()
        ok_one = rc_l != 0 and not wrote and 'hard link into keys' in o_l and not leaked
        leak_info.append({'loc': loc, 'rc': rc_l, 'wrote': wrote, 'ok': ok_one, 'out': o_l[-200:]})
        leak_ok = leak_ok and ok_one
    record('export-refuses-hard-link-of-seed', leak_ok, details=leak_info)

    copy_home = os.path.join(work, 'leak-bytes')
    hh, _ = make_fixture(copy_home)
    seed = open(os.path.join(copy_home, 'keys', 'runner.seed'), 'rb').read()
    target = os.path.join(hh.dir, 'versions', 'soft-prompt', 'v-copy', 'vector.safetensors')
    os.makedirs(os.path.dirname(target), exist_ok=True)
    open(target, 'wb').write(seed)
    out_c = os.path.join(work, 'bundles', 'should-not-copy-seed.tar.gz')
    rc_c, o_c = sh(['export-bundle', '--out', out_c, '--by', 'operator'], copy_home)
    record('export-refuses-file-equal-to-seed',
           rc_c != 0 and not os.path.exists(out_c) and 'same bytes as the runner seed' in o_c,
           rc=rc_c, out=o_c[-300:])

    # S4: PEM PRIVATE KEY marker in a packed text file
    pem_home = os.path.join(work, 'pem-home')
    hh, _ = make_fixture(pem_home)
    open(os.path.join(hh.dir, 'memory.jsonl'), 'ab').write(b'\n-----BEGIN PRIVATE KEY-----\nAAAA\n-----END PRIVATE KEY-----\n')
    out_pem = os.path.join(work, 'bundles', 'should-not-pem.tar.gz')
    rc_pem, o_pem = sh(['export-bundle', '--out', out_pem, '--by', 'operator'], pem_home)
    record('export-refuses-pem-private-key-in-text',
           rc_pem != 0 and not os.path.exists(out_pem) and 'PRIVATE KEY PEM marker' in o_pem,
           rc=rc_pem, out=o_pem[-300:])

    # S2: a lying fingerprintHex (signature still valid) is refused
    lie = os.path.join(work, 'bundles', 'lying-fp.tar.gz')
    def lie_fp(n, d):
        if n != 'MANIFEST.json': return d
        man_l = json.loads(d)
        man_l['fingerprintHex'] = 'f' * 64
        return (json.dumps(man_l, ensure_ascii=False) + '\n').encode()
    copy_tar_with(outp, lie, lie_fp)
    rc_lie, o_lie = sh(['verify-bundle', '--bundle', lie], dest_home)
    record('verify-refuses-lying-fingerprintHex',
           rc_lie != 0 and 'fingerprintHex does not match' in o_lie, rc=rc_lie, out=o_lie[-300:])

    # S5: gzip header mtime is 0
    hdr = open(outp, 'rb').read(10)
    record('bundle-gzip-mtime-pinned',
           hdr[:2] == b'\x1f\x8b' and hdr[4:8] == b'\x00\x00\x00\x00', header=hdr.hex())

    # S6: member-count cap
    r_mem = fl_learn.verify_bundle(outp, max_members=3)
    record('verify-refuses-too-many-members',
           (not r_mem.get('ok')) and 'too many members' in (r_mem.get('reason') or ''), reason=r_mem.get('reason'))

    # S3: --expect-fingerprint pins the origin; a wrong one refuses and import creates nothing
    real_fp = man['fingerprintHex']
    rc_okfp, o_okfp = sh(['verify-bundle', '--bundle', outp, '--expect-fingerprint', real_fp], dest_home)
    rc_pre, o_pre = sh(['verify-bundle', '--bundle', outp, '--expect-fingerprint', real_fp[:16]], dest_home)
    wrong = 'ab' * 32
    if wrong == real_fp: wrong = 'cd' * 32
    rc_badfp, o_badfp = sh(['verify-bundle', '--bundle', outp, '--expect-fingerprint', wrong], dest_home)
    fresh_fp = os.path.join(work, 'expect-fp-dest')
    rc_impbad, o_impbad = sh(['import-bundle', '--bundle', outp, '--by', 'kirk', '--expect-fingerprint', wrong], fresh_fp)
    record('expect-fingerprint-pins-origin-or-refuses',
           rc_okfp == 0 and rc_pre == 0 and rc_badfp != 0 and 'expect-fingerprint' in o_badfp
           and rc_impbad != 0 and not os.path.exists(os.path.join(fresh_fp, 'minds')),
           rc_ok=rc_okfp, rc_pre=rc_pre, rc_bad=rc_badfp, rc_imp=rc_impbad, out=o_badfp[-250:])

    # Pre-existing undo crash: a learn-commit with no beforeFp must not throw
    rc_u, out_u = sh(['undo', '--by', 'kirk', '--method', 'soft-prompt'], src_home)
    record('undo-missing-beforeFp-does-not-crash',
           'Traceback' not in out_u and 'not named on the row' in out_u and 'Nothing was changed' in out_u,
           rc=rc_u, out=out_u[-400:])

        # lookalike actor rule still intact (bundle commands must not weaken it)
    rc_bad, out_bad = sh(['export-bundle', '--out', os.path.join(work, 'bundles', 'should-not-write.tar.gz'),
                          '--by', 'Jos\u00e9'], src_home)  # José — still refused by the current ASCII rule
    # also a mixed-script lookalike should still be refused
    rc_cyr, out_cyr = sh(['export-bundle', '--out', os.path.join(work, 'bundles', 'should-not-write-2.tar.gz'),
                          '--by', 'kir\u043a'], src_home)  # cyrillic k
    record('lookalike-and-non-ascii-actor-still-refused',
           rc_bad != 0 and 'plain letters' in out_bad and rc_cyr != 0 and 'plain letters' in out_cyr
           and not os.path.exists(os.path.join(work, 'bundles', 'should-not-write.tar.gz'))
           and not os.path.exists(os.path.join(work, 'bundles', 'should-not-write-2.tar.gz')),
           rc_bad=rc_bad, rc_cyr=rc_cyr)

    # verify-bundle creates nothing on a missing home
    ghost = os.path.join(work, 'ghost-home-should-not-appear')
    rcg, _ = sh(['verify-bundle', '--bundle', outp], ghost)
    record('verify-bundle-is-read-only', rcg == 0 and not os.path.exists(ghost))

    json.dump(R, open(os.path.join(work, 'results.json'), 'w'), indent=1, sort_keys=True)
    n_ok = sum(1 for v in R.values() if v['ok'])
    print('SUMMARY %d/%d pass  (work %s)' % (n_ok, len(R), work))
    sys.exit(0 if n_ok == len(R) else 1)

if __name__ == '__main__':
    main()
