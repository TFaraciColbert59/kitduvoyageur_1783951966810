#!/usr/bin/env python3
"""File reprenable de création des plans au sol (FLUX.1 schnell -> Real-ESRGAN x2 + Lanczos -> Depth Anything V2 Small).

Usage (depuis trailer/) :
  python3 tools/gen/run_queue.py                     # traite toute la file, saute ce qui existe
  python3 tools/gen/run_queue.py --only 08_k2_concordia_solo --seed 1891   # refait un plan (anciens fichiers archivés)
  python3 tools/gen/run_queue.py --only 02_iceland_route1_lupines --steps upscale,depth   # refait seulement ces étapes
  python3 tools/gen/run_queue.py --status            # affiche QUEUE_STATUS.txt

Pour chaque plan : raw/<nom>.png (génération) -> <nom>.png (agrandi) -> depth/<nom>.png (profondeur 16 bits).
Chaque fichier est écrit sous un nom temporaire puis renommé : un fichier présent est toujours complet.
Un seul lanceur à la fois (verrou flock sur assets/footage/.queue.lock).
"""
import argparse, datetime as dt, fcntl, json, os, shutil, subprocess, sys, time

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
FOOT = os.path.join(ROOT, 'assets', 'footage')
RAW, DEPTH, OLD = os.path.join(FOOT, 'raw'), os.path.join(FOOT, 'depth'), os.path.join(FOOT, 'raw', 'old')
G = os.environ.get('GEN', '/tmp/claude-0/-home-user-kitduvoyageur-1783951966810/01a3ca9d-48c3-50c5-8d53-c0cbef7f3fab/scratchpad/gen')
PY = os.path.join(G, 'venv', 'bin', 'python')
THREADS = int(os.environ.get('GEN_THREADS', '3'))
UPSCALE_ARGS = ['--model', 'x2', '--mix', '0.6', '--grain', '0.012']
MODEL_INFO = {
    'generator': 'FLUX.1 [schnell] (black-forest-labs, Apache-2.0), quantification GGUF Q4_K_S (city96/FLUX.1-schnell-gguf)',
    'text_encoders': 'CLIP-L (clip_l.safetensors, comfyanonymous/flux_text_encoders) + T5 v1.1 XXL GGUF Q4_K_M (city96/t5-v1_1-xxl-encoder-gguf)',
    'vae': 'ae.safetensors de FLUX.1 [schnell] (miroir second-state/FLUX.1-schnell-GGUF)',
    'runtime': 'stable-diffusion.cpp (leejet, MIT), CPU, 4 pas, euler, cfg 1.0',
    'upscale': 'Real-ESRGAN RealESRGAN_x2plus (xinntao, BSD-3-Clause), mélangé à 60 % avec un Lanczos, grain 1,2 %',
    'depth': 'Depth Anything V2 Small (depth-anything/Depth-Anything-V2-Small-hf, Apache-2.0), PNG 16 bits, blanc = près',
}


def now():
    return dt.datetime.now().astimezone()


def load_spec():
    with open(os.path.join(HERE, 'plates.json')) as f:
        return json.load(f)


def full_prompt(spec, p):
    if p.get('prompt_full'):
        return p['prompt_full']
    s = p['prompt'] + ' ' + spec['style']
    if p.get('people'):
        s += ' ' + spec['people']
    return s


def read_log():
    """Durées mesurées par étape (secondes par mégapixel brut pour gen, secondes sinon)."""
    out = {'gen': [], 'upscale': [], 'depth': []}
    path = os.path.join(FOOT, 'plates.log')
    if os.path.exists(path):
        for line in open(path):
            try:
                d = json.loads(line)
            except ValueError:
                continue
            if d.get('ok') and d.get('step') in out:
                v = d['seconds'] / (d['megapixels'] if d['step'] == 'gen' else 1)
                out[d['step']].append(v)
    return out


def log(entry):
    entry = {'time': now().isoformat(timespec='seconds'), **entry}
    with open(os.path.join(FOOT, 'plates.log'), 'a') as f:
        f.write(json.dumps(entry, ensure_ascii=False) + '\n')


def paths(name):
    return (os.path.join(RAW, name + '.png'), os.path.join(FOOT, name + '.png'), os.path.join(DEPTH, name + '.png'))


def dims(spec, p):
    d = spec['defaults']
    w, h = p.get('width', d['width']), p.get('height', d['height'])
    if p.get('width'):  # petites images (pages du carnet) : agrandies x2
        up = f'{w * 2}x{h * 2}'
    else:
        up = d['upscale']
    return w, h, up


def write_status(spec, order, cur, step, t0, extra=''):
    meas = read_log()
    avg = lambda k, dflt: (sum(meas[k][-6:]) / len(meas[k][-6:])) if meas[k] else dflt
    gen_mp, up_s, dp_s = avg('gen', 1300 / 0.59), avg('upscale', 40), avg('depth', 15)
    done, remain = 0, 0.0
    for p in order:
        r, f, d = paths(p['name'])
        w, h, _ = dims(spec, p)
        if os.path.exists(r) and os.path.exists(f) and os.path.exists(d):
            done += 1
            continue
        if not os.path.exists(r):
            remain += gen_mp * w * h / 1e6
        if not os.path.exists(f):
            remain += up_s
        if not os.path.exists(d):
            remain += dp_s
    eta = now() + dt.timedelta(seconds=remain)
    txt = (f"File des plans au sol LKDV — mis à jour {now():%Y-%m-%d %H:%M:%S %Z}\n"
           f"PID lanceur : {os.getpid()}\n"
           f"Plan en cours : {cur or '—'}  ·  étape : {step or '—'}\n"
           f"Faits : {done} / {len(order)}\n"
           f"Temps restant estimé : {remain / 3600:.1f} h  ·  fin estimée : {eta:%Y-%m-%d %H:%M %Z}\n"
           f"Moyennes mesurées : génération {gen_mp * 0.59 / 60:.1f} min par image 1024x576, "
           f"agrandissement {up_s:.0f} s, profondeur {dp_s:.0f} s\n"
           f"Démarré : {dt.datetime.fromtimestamp(t0).astimezone():%Y-%m-%d %H:%M}\n{extra}")
    tmp = os.path.join(FOOT, '.QUEUE_STATUS.tmp')
    open(tmp, 'w').write(txt)
    os.replace(tmp, os.path.join(FOOT, 'QUEUE_STATUS.txt'))


def update_manifest(spec, p, seed):
    """Copie enrichie : assets/footage/plates.json."""
    mpath = os.path.join(FOOT, 'plates.json')
    m = json.load(open(mpath)) if os.path.exists(mpath) else {'about': '', 'models': MODEL_INFO, 'plates': {}}
    m['about'] = ('Plans au sol générés localement par IA (FLUX.1 schnell), sans banque d\'images ; personnes fictives. '
                  'focus = point focal [x, y] en fractions de la largeur et de la hauteur (null = non renseigné). '
                  'depth : PNG 16 bits, blanc = près.')
    m['models'] = MODEL_INFO
    r, f, d = paths(p['name'])
    w, h, up = dims(spec, p)
    prev = m['plates'].get(p['name'], {})
    e = {
        'file': os.path.relpath(f, FOOT) if os.path.exists(f) else None,
        'raw': os.path.relpath(r, FOOT) if os.path.exists(r) else None,
        'depth': os.path.relpath(d, FOOT) if os.path.exists(d) else None,
        'width': int(up.split('x')[0]), 'height': int(up.split('x')[1]),
        'raw_width': w, 'raw_height': h,
        'seed': seed, 'steps': spec['defaults']['steps'],
        'prompt': full_prompt(spec, p),
        'use': p.get('use'),
        'band': bool(p.get('band')),
        'focus': p.get('focus', prev.get('focus')),
        'date': now().isoformat(timespec='seconds'),
        'notes': p.get('notes', prev.get('notes')),
    }
    m['plates'][p['name']] = e
    tmp = mpath + '.tmp'
    json.dump(m, open(tmp, 'w'), ensure_ascii=False, indent=2)
    os.replace(tmp, mpath)


def run(cmd, logfile):
    with open(logfile, 'w') as lf:
        return subprocess.run(['nice', '-n', '10'] + cmd, stdout=lf, stderr=subprocess.STDOUT).returncode


def step_gen(spec, p, seed):
    r, _, _ = paths(p['name'])
    w, h, _ = dims(spec, p)
    tmp = os.path.join(RAW, f'.tmp_{p["name"]}.png')
    cmd = [os.path.join(G, 'build/bin/sd-cli'),
           '--diffusion-model', f'{G}/models/flux1-schnell-Q4_K_S.gguf', '--vae', f'{G}/models/ae.safetensors',
           '--clip_l', f'{G}/models/clip_l.safetensors', '--t5xxl', f'{G}/models/t5-v1_1-xxl-encoder-Q4_K_M.gguf',
           '-p', full_prompt(spec, p), '--cfg-scale', '1.0', '--steps', str(spec['defaults']['steps']),
           '--sampling-method', 'euler', '-W', str(w), '-H', str(h), '-s', str(seed), '-t', str(THREADS),
           '--vae-tiling', '--offload-to-cpu', '--mmap', '-v', '-o', tmp]
    t = time.time()
    rc = run(cmd, os.path.join(G, 'logs', f'flux_{p["name"]}_s{seed}.log'))
    ok = rc == 0 and os.path.exists(tmp)
    if ok:
        os.replace(tmp, r)
    log({'plate': p['name'], 'step': 'gen', 'seed': seed, 'ok': ok, 'rc': rc, 'seconds': round(time.time() - t, 1),
         'megapixels': round(w * h / 1e6, 4), 'size': f'{w}x{h}'})
    return ok


def step_upscale(spec, p, seed):
    r, f, _ = paths(p['name'])
    _, _, up = dims(spec, p)
    tmp = os.path.join(FOOT, f'.tmp_{p["name"]}.png')
    t = time.time()
    rc = run([PY, os.path.join(HERE, 'upscale.py'), r, tmp, '--size', up, '--threads', str(THREADS), '--seed', str(seed)] + UPSCALE_ARGS,
             os.path.join(G, 'logs', f'upscale_{p["name"]}.log'))
    ok = rc == 0 and os.path.exists(tmp)
    if ok:
        os.replace(tmp, f)
    log({'plate': p['name'], 'step': 'upscale', 'seed': seed, 'ok': ok, 'rc': rc, 'seconds': round(time.time() - t, 1), 'size': up})
    return ok


def step_depth(spec, p, seed):
    _, f, d = paths(p['name'])
    _, _, up = dims(spec, p)
    tmp = os.path.join(DEPTH, f'.tmp_{p["name"]}.png')
    t = time.time()
    rc = run([PY, os.path.join(HERE, 'depth.py'), f, tmp, '--size', up, '--threads', str(THREADS)],
             os.path.join(G, 'logs', f'depth_{p["name"]}.log'))
    ok = rc == 0 and os.path.exists(tmp)
    if ok:
        os.replace(tmp, d)
    log({'plate': p['name'], 'step': 'depth', 'seed': seed, 'ok': ok, 'rc': rc, 'seconds': round(time.time() - t, 1), 'size': up})
    return ok


def seed_of(p, override=None):
    if override is not None:
        return override
    mpath = os.path.join(FOOT, 'plates.json')
    if os.path.exists(mpath):  # garder la graine retenue pour un plan déjà refait
        e = json.load(open(mpath)).get('plates', {}).get(p['name'])
        if e and e.get('seed') is not None:
            return e['seed']
    return p['seed']


def archive(name, seed_old):
    os.makedirs(OLD, exist_ok=True)
    stamp = now().strftime('%Y%m%d-%H%M%S')
    for kind, path in zip(('raw', 'up', 'depth'), paths(name)):
        if os.path.exists(path):
            shutil.move(path, os.path.join(OLD, f'{name}__{kind}__s{seed_old}__{stamp}.png'))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--only'); ap.add_argument('--seed', type=int)
    ap.add_argument('--steps', default='gen,upscale,depth', help='avec --only : étapes à refaire')
    ap.add_argument('--status', action='store_true')
    a = ap.parse_args()
    for dpath in (FOOT, RAW, DEPTH):
        os.makedirs(dpath, exist_ok=True)
    if a.status:
        print(open(os.path.join(FOOT, 'QUEUE_STATUS.txt')).read())
        return
    lock = open(os.path.join(FOOT, '.queue.lock'), 'w')
    try:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
    except BlockingIOError:
        sys.exit('Une autre file tourne déjà (verrou assets/footage/.queue.lock).')
    spec = load_spec()
    order = spec['plates']
    t0 = time.time()
    todo = order
    if a.only:
        todo = [p for p in order if p['name'] == a.only]
        if not todo:
            sys.exit(f'Plan inconnu : {a.only}')
        p = todo[0]
        steps = a.steps.split(',')
        old_seed = seed_of(p)
        if 'gen' in steps:
            archive(p['name'], old_seed)
        else:
            r, f, d = paths(p['name'])
            for s, path in (('upscale', f), ('depth', d)):
                if s in steps and os.path.exists(path):
                    os.remove(path)
    for p in todo:
        seed = seed_of(p, a.seed if a.only else None)
        r, f, d = paths(p['name'])
        for step, path, fn in (('gen', r, step_gen), ('upscale', f, step_upscale), ('depth', d, step_depth)):
            if os.path.exists(path):
                continue
            write_status(spec, order, p['name'], step, t0)
            if not fn(spec, p, seed):
                write_status(spec, order, p['name'], step, t0, f'ÉCHEC à l\'étape {step} de {p["name"]} (voir {G}/logs)\n')
                break
        update_manifest(spec, p, seed)
    write_status(spec, order, None, 'terminé' if not a.only else f'--only {a.only} terminé', t0)


if __name__ == '__main__':
    main()
