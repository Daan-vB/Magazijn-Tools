# Zet een deel van de opname om naar tekst met faster-whisper (Nederlands).
# DEEL / DELEN: welk stuk van de opname (met 3 s overlap; een zin telt bij het deel waarin hij begint).
import json, os, subprocess, sys, traceback

def fout(e):
    for regel in traceback.format_exc().strip().splitlines()[-6:]:
        print('::error::' + regel.replace('%', '%25'))
    sys.exit(1)

try:
    bron, uit = sys.argv[1], sys.argv[2]
    deel, delen = int(os.environ.get('DEEL', 0)), int(os.environ.get('DELEN', 1))
    duur = float(subprocess.check_output(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', bron]).decode().strip() or 0)
    if duur / delen < 120:   # korte opname: alles in deel 0
        delen = 1
        if deel > 0:
            json.dump({'deel': deel, 'delen': 1, 'model': '', 'duur': duur, 'van': 0, 'tot': 0, 'zinnen': []}, open(uit, 'w')); sys.exit(0)
    stuk = duur / delen
    van, tot = deel * stuk, (deel + 1) * stuk
    start = max(0.0, van - 3)
    subprocess.check_call(['ffmpeg', '-loglevel', 'error', '-y', '-ss', f'{start:.2f}', '-t', f'{(tot - start + 3):.2f}', '-i', bron, '-ac', '1', '-ar', '16000', 'stuk.wav'])
    from faster_whisper import WhisperModel
    naam = os.environ.get('MODEL') or 'large-v3-turbo'
    try:
        model = WhisperModel(naam, device='cpu', compute_type='int8', cpu_threads=4)
    except Exception as e:
        print('::warning::model', naam, 'lukt niet, medium gebruikt:', str(e)[:200])
        naam = 'medium'; model = WhisperModel(naam, device='cpu', compute_type='int8', cpu_threads=4)
    woorden = ('Productdata, palletmaat, stuks per pallet, picklocatie, aanvullen bij, aanvullen met, volle pallet, max op pick, '
               'per doos, max per ligger, vloernaam, volgende, sportvloertegel, sportvloer, ringmat, stalmat, rubbertegel, '
               'whiteboard, bureaustoel, kokos, spaghetti, rubberloper, traanplaat, ribbel, noppen, hamerslag, cobra, '
               'Wallace, Rubberselect, Stockz, MFL, kilo, centimeter, millimeter, 80 bij 120, 100 bij 120.')
    import numpy as np
    pcm = subprocess.check_output(['ffmpeg', '-loglevel', 'error', '-i', 'stuk.wav', '-f', 's16le', '-ac', '1', '-ar', '16000', '-'])
    geluid = np.frombuffer(pcm, np.int16).astype(np.float32) / 32768.0
    segs, info = model.transcribe(geluid, language='nl', vad_filter=True, beam_size=5, initial_prompt=woorden, condition_on_previous_text=False, word_timestamps=True)
    # per woord bepalen bij welk deel het hoort (overlap aan beide kanten), zodat niets dubbel of kwijt is
    rijen = []
    for s in segs:
        ws = [w for w in (s.words or []) if (deel == 0 or start + w.start >= van) and (deel == delen - 1 or start + w.start < tot)]
        if not ws: continue
        rijen.append({'van': round(start + ws[0].start, 1), 'tot': round(start + ws[-1].end, 1), 'tekst': ''.join(w.word for w in ws).strip()})
    json.dump({'deel': deel, 'delen': delen, 'model': naam, 'duur': duur, 'van': van, 'tot': tot, 'zinnen': rijen}, open(uit, 'w'), ensure_ascii=False)
    print(f'deel {deel}: {len(rijen)} zinnen, model {naam}')
except SystemExit:
    raise
except Exception as e:
    fout(e)
