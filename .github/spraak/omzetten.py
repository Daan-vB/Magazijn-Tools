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
    segs, info = model.transcribe('stuk.wav', language='nl', vad_filter=True, beam_size=5, initial_prompt=woorden, condition_on_previous_text=False)
    rijen = []
    for s in segs:
        a = start + s.start
        if deel < delen - 1 and a >= tot: continue
        if deel > 0 and a < van: continue
        rijen.append({'van': round(a, 1), 'tot': round(start + s.end, 1), 'tekst': s.text.strip()})
    json.dump({'deel': deel, 'delen': delen, 'model': naam, 'duur': duur, 'van': van, 'tot': tot, 'zinnen': rijen}, open(uit, 'w'), ensure_ascii=False)
    print(f'deel {deel}: {len(rijen)} zinnen, model {naam}')
except SystemExit:
    raise
except Exception as e:
    fout(e)
