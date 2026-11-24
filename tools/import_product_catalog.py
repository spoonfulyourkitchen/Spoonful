import csv
import json
import os
import sys
import time
import urllib.error
import urllib.request

DEFAULT_CSV = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), '_de_products.csv')
CSV_PATH = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_CSV
PROJECT = 'gmfkleugoxafmvprqatk'
def access_token():
    token = os.environ.get('SUPABASE_ACCESS_TOKEN', '').strip()
    if token:
        return token
    env_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), '.env.local')
    try:
        with open(env_path, encoding='utf-8') as handle:
            for line in handle:
                if line.startswith('SUPABASE_ACCESS_TOKEN='):
                    return line.split('=', 1)[1].strip()
    except OSError:
        pass
    raise SystemExit('Kein Supabase-Access-Token gefunden (.env.local: SUPABASE_ACCESS_TOKEN=sbp_...).')


TOKEN = access_token()
URL = 'https://api.supabase.com/v1/projects/%s/database/query' % PROJECT
BATCH = 800


def wait_for_export(timeout=3600):
    last = -1
    stable = 0
    start = time.time()
    while time.time() - start < timeout:
        size = os.path.getsize(CSV_PATH) if os.path.exists(CSV_PATH) else 0
        if size > 0 and size == last:
            stable += 1
            if stable >= 3:
                return size
        else:
            stable = 0
        last = size
        time.sleep(10)
    raise SystemExit('export did not finish in time')


def num(v):
    v = (v or '').strip()
    if not v:
        return None
    try:
        f = float(v)
    except ValueError:
        return None
    if f != f or f < 0 or f > 10000:
        return None
    return round(f, 1)


def text(v, limit):
    v = (v or '').strip()
    if not v:
        return None
    return v[:limit]


def lit(v):
    if v is None:
        return 'null'
    if isinstance(v, (int, float)):
        return str(v)
    return "'" + str(v).replace("'", "''") + "'"


def load_rows():
    rows = {}
    with open(CSV_PATH, 'r', encoding='utf-8', newline='') as fh:
        reader = csv.DictReader(fh)
        for row in reader:
            code = ''.join(ch for ch in (row.get('code') or '') if ch.isdigit())
            name = text(row.get('name'), 160)
            if len(code) < 8 or len(code) > 14 or not name or len(name) < 2:
                continue
            kcal = num(row.get('kcal'))
            if kcal is None:
                continue
            entry = (
                code,
                name,
                text(row.get('brand'), 80),
                kcal,
                num(row.get('protein')),
                num(row.get('carbs')),
                num(row.get('fat')),
                text(row.get('serving'), 40),
                num(row.get('serving_grams')),
                text(row.get('quantity'), 40),
                num(row.get('package_grams')),
            )
            prev = rows.get(code)
            if prev is None or sum(1 for x in entry[3:7] if x is not None) > sum(1 for x in prev[3:7] if x is not None):
                rows[code] = entry
    return list(rows.values())


def db_size_mb():
    body = json.dumps({'query': "select pg_database_size(current_database()) / 1048576 as mb"}).encode('utf-8')
    req = urllib.request.Request(URL, data=body, method='POST')
    req.add_header('Authorization', 'Bearer ' + TOKEN)
    req.add_header('Content-Type', 'application/json')
    try:
        with urllib.request.urlopen(req, timeout=60) as res:
            data = json.loads(res.read().decode('utf-8'))
            return int(data[0]['mb'])
    except Exception:
        return None


def send(sql, attempts=8):
    body = json.dumps({'query': sql}).encode('utf-8')
    wait = 4
    for attempt in range(attempts):
        req = urllib.request.Request(URL, data=body, method='POST')
        req.add_header('Authorization', 'Bearer ' + TOKEN)
        req.add_header('Content-Type', 'application/json')
        try:
            with urllib.request.urlopen(req, timeout=180) as res:
                res.read()
                return True
        except urllib.error.HTTPError as err:
            msg = err.read()[:200].decode('utf-8', 'ignore')
            if err.code in (429, 500, 502, 503, 504) and attempt < attempts - 1:
                time.sleep(wait)
                wait = min(wait * 2, 60)
                continue
            print('HTTP %s: %s' % (err.code, msg), flush=True)
            return False
        except Exception as err:
            if attempt < attempts - 1:
                time.sleep(wait)
                wait = min(wait * 2, 60)
                continue
            print('error: %s' % err, flush=True)
            return False
    return False


def chunk_insert(rows):
    values = ', '.join(
        '(' + ', '.join(lit(v) for v in row) + ", 'off')" for row in rows
    )
    return (
        'insert into public.product_catalog '
        '(code, name, brand, kcal, protein, carbs, fat, serving, serving_grams, quantity, package_grams, source) values '
        + values
        + ' on conflict (code) do update set name = excluded.name, brand = excluded.brand, kcal = excluded.kcal, '
        + 'protein = excluded.protein, carbs = excluded.carbs, fat = excluded.fat, serving = excluded.serving, '
        + 'serving_grams = excluded.serving_grams, quantity = excluded.quantity, '
        + 'package_grams = excluded.package_grams where product_catalog.source <> \'app\';'
    )


def main():
    size = wait_for_export()
    print('export size %s bytes' % size, flush=True)
    rows = load_rows()
    print('rows to import: %s' % len(rows), flush=True)
    done = 0
    failed = 0
    for i in range(0, len(rows), BATCH):
        batch = rows[i:i + BATCH]
        if send(chunk_insert(batch)):
            done += len(batch)
        else:
            failed += len(batch)
        time.sleep(0.2)
        if (i // BATCH) % 100 == 0:
            mb = db_size_mb()
            if mb is not None:
                print('database size %s MB' % mb, flush=True)
                if mb > 470:
                    print('stopping, database nearly full', flush=True)
                    break
        if (i // BATCH) % 20 == 0:
            print('imported %s / %s (failed %s)' % (done, len(rows), failed), flush=True)
    send('analyze public.product_catalog;')
    print('done imported=%s failed=%s' % (done, failed), flush=True)


if __name__ == '__main__':
    main()
