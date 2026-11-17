"""Builds js/sounds.js from the public-domain recordings in audio_src/commons.
Each take is cut out of its source by copying whole Ogg pages (no re-encoding, so no quality loss), then embedded as
base64. Offsets inside each cut are computed from the page granule positions so a take starts where the event does.
Run:  python tools/sounds.py      (needs only the Python standard library)"""
import base64, json, os, sys
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'audio_src', 'commons')

# take name -> list of (source file, start s, duration s, gain).  Loops are single long takes.
TAKES = {
  # ambience beds (looped with cross-fades)
  'lap':     [('boat_by_a_wharf_2', 21.0, 20.0, 1.6)],
  'shore':   [('on_a_pebble_beach', 4.0, 12.0, 1.0), ('water_over_rocks_as_tide_recedes', 2.9, 10.1, 1.0)],
  'rain':    [('rain_1', 10.0, 16.0, 3.2)],
  'birds':   [('gentle_breeze_and_birds_singing', 7.0, 14.0, 1.4)],
  'night':   [('country_night_noise', 10.0, 15.0, 1.8)],
  'fire':    [('dry_grass_burning_in_open_fireplace', 2.0, 9.0, 2.6)],
  # one-shots
  'splash':  [('bathtub_water_splashes', 3.50, 0.60, 1.0), ('bathtub_water_splashes', 17.0, 0.65, 1.5), ('bathtub_water_splashes', 20.83, 0.90, 1.7), ('bathtub_water_splashes', 6.68, 0.85, 2.0)],
  'plop':    [('bathtub_water_splashes', 25.0, 0.22, 1.3), ('bathtub_water_splashes', 45.40, 0.16, 2.2)],
  'stroke':  [('bathtub_water_splashes', 30.27, 0.85, 2.2), ('bathtub_water_splashes', 37.52, 0.95, 2.2), ('bathtub_water_splashes', 42.08, 0.85, 2.5), ('bathtub_water_splashes', 12.32, 0.80, 3.5)],
  'drip':    [('water_bubbles_chortling', 6.20, 0.32, 1.6), ('water_bubbles_chortling', 2.20, 0.30, 2.5)],
  'bubbles': [('water_bubbles_chortling', 3.75, 1.30, 1.0), ('water_bubbles_chortling', 8.17, 1.10, 1.3)],
  'knock':   [('hitting_wooden_pole', 0.06, 0.28, 1.7), ('hitting_wooden_pole', 1.25, 0.32, 1.9), ('hitting_wooden_pole', 1.85, 0.28, 2.1), ('knocking_on_wood_or_door', 0.47, 0.45, 1.9), ('knocking_on_wood_or_door', 2.44, 0.50, 2.1), ('knocking_on_wood_or_door', 4.42, 0.55, 1.7)],
  'splinter':[('splinter_of_wood_falls_on_ground', 0.0, 1.5, 1.2)],
  'stone':   [('assorted_gravel_rock_and_stones', 14.1, 0.50, 1.2), ('assorted_gravel_rock_and_stones', 16.74, 0.95, 1.2), ('assorted_gravel_rock_and_stones', 26.62, 0.70, 1.0), ('assorted_gravel_rock_and_stones', 55.0, 0.50, 0.9)],
  'creak':   [('creaky_wooden_casket', 0.03, 1.30, 1.6), ('squeaky_door', 5.88, 1.32, 0.8), ('creaky_wooden_swivel_chair', 0.0, 2.2, 1.2)],
  'door':    [('closing_an_old_door', 1.05, 3.20, 2.8)],
  'open':    [('wooden_desk_drawer', 2.48, 0.35, 1.6), ('wooden_desk_drawer', 5.31, 0.52, 1.4)],
  'rope':    [('lace_cord_rope', 13.38, 0.68, 2.0), ('lace_cord_rope', 15.96, 0.68, 1.7)],
  'drink':   [('drinking_a_glass_of_wat', 3.35, 2.0, 1.2)],
  'page':    [('turning_a_page', 1.40, 1.0, 4.0)],
  'gull':    [('gull_1', 2.80, 0.32, 0.7), ('gull_1', 6.35, 0.85, 0.85), ('gull_1', 7.92, 0.95, 0.85), ('gull_1', 10.72, 0.85, 0.95), ('gull_1', 12.42, 0.85, 0.85), ('gull_2', 0.0, 5.7, 0.6)],
  'eat':     [('eating_snacks', 0.0, 2.0, 1.0)],
  'radio':   [('radio_short_wave_frequency', 1.0, 3.0, 0.8)],
  'flint':   [('flintstone', 0.0, 1.5, 1.0)],
  'pour':    [('pouring_water_bottles', 1.0, 2.5, 1.0)],
  'thunder': [('storm_thunderbolts', 0.0, 8.0, 1.0)],
}

def pages(d):
    i = 0
    while i + 27 <= len(d) and d[i:i + 4] == b'OggS':
        ns = d[i + 26]; ln = 27 + ns + sum(d[i + 27:i + 27 + ns])
        yield i, ln, int.from_bytes(d[i + 6:i + 14], 'little', signed=True), d[i + 14:i + 18], i + 27 + ns
        i += ln

def stream(d):
    pg = list(pages(d)); ser = None
    for (o, ln, gr, s, b) in pg:
        if d[b:b + 7] == b'\x01vorbis': ser = s; rate = int.from_bytes(d[b + 12:b + 16], 'little'); break
    if ser is None: raise ValueError('no vorbis stream')
    return rate, [p for p in pg if p[3] == ser]

def cut(d, t0, t1):
    """returns (ogg bytes, time in the source where the decoded cut begins)"""
    rate, pg = stream(d); out = bytearray(); k = 0
    while k < len(pg) and pg[k][2] == 0: out += d[pg[k][0]:pg[k][0] + pg[k][1]]; k += 1
    prev = 0; start = None; last = 0
    for (o, ln, gr, s, b) in pg[k:]:
        g = gr if gr >= 0 else last
        if g >= t0 * rate and prev <= t1 * rate:
            if start is None: start = prev / rate
            out += d[o:o + ln]
        if gr >= 0: prev = gr; last = gr
        if prev > t1 * rate and start is not None: break
    # mark the final page end-of-stream so decoders finish cleanly
    if start is None: raise ValueError('empty cut')
    return bytes(out), start

GAINS = json.load(open(os.path.join(ROOT, 'audio_src', 'gains.json'))) if os.path.exists(os.path.join(ROOT, 'audio_src', 'gains.json')) else {}

def main():
    snd, clips, used, missing = {}, {}, {}, set()
    total = 0
    for name, takes in TAKES.items():
        lst = []
        for idx, (src, t0, dur, gain) in enumerate(takes):
            p = os.path.join(SRC, src + '.ogg')
            if not os.path.exists(p): missing.add(src); continue
            d = open(p, 'rb').read(); pad = 0.06
            data, start = cut(d, max(0, t0 - pad), t0 + dur + pad)
            key = f'{name}{len(lst)}'
            snd[key] = base64.b64encode(data).decode('ascii'); total += len(data)
            gain = GAINS.get(key, gain)   # measured normalisation (audio_src/gains.json) overrides the hand guess
            lst.append([key, round(t0 - start, 3), dur, gain]); used.setdefault(src, 0); used[src] += len(data)
        if lst: clips[name] = lst
    meta = json.load(open(os.path.join(SRC, 'sources.json'), encoding='utf-8')) if os.path.exists(os.path.join(SRC, 'sources.json')) else {}
    credits = []
    for src in sorted(used):
        m = meta.get(src, {}); credits.append({'file': m.get('title', src), 'author': m.get('artist', '?'), 'licence': m.get('lic', 'Public domain'), 'url': m.get('page', '')})
    js = ("'use strict';\n/* Recorded sound: public-domain field recordings (Wikimedia Commons, PDsounds.org collection), cut by tools/sounds.py.\n"
          "   Each key is one Ogg Vorbis take, base64. G.SNDCLIPS maps an effect to its takes: [key, offset s, duration s, gain]. */\n"
          "window.G.SNDCLIPS = " + json.dumps(clips, separators=(',', ':')) + ";\n"
          "window.G.SNDCREDITS = " + json.dumps(credits, separators=(',', ':')) + ";\n"
          "window.G.SND = {\n" + ',\n'.join(f'  {k}: "{v}"' for k, v in snd.items()) + "\n};\n")
    open(os.path.join(ROOT, 'js', 'sounds.js'), 'w', encoding='ascii').write(js)
    md = ['# Recorded sound credits', '', 'All recordings below are in the public domain. They come from the PDsounds.org collection on Wikimedia',
          'Commons. Attribution is not required; it is given here anyway. Only short excerpts are used, cut without re-encoding.', '',
          '| Recording | Recorded by | Licence | Source |', '|---|---|---|---|']
    for c in credits: md.append(f"| {c['file']} | {c['author']} | {c['licence']} | {c['url']} |")
    open(os.path.join(ROOT, 'SOUND_CREDITS.md'), 'w', encoding='utf-8').write('\n'.join(md) + '\n')
    print(f'{len(snd)} takes in {len(clips)} effects, {total // 1024} KB of audio ({len(js) // 1024} KB as js); sources used: {len(used)}')
    if missing: print('missing sources (skipped):', ', '.join(sorted(missing)))

if __name__ == '__main__': main()
