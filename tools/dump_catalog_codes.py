import json
import os
import time
import urllib.error
import urllib.request

URL = 'https://api.supabase.com/v1/projects/gmfkleugoxafmvprqatk/database/query'
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
OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), '_codes.csv')
PAGE = 100000


def query(sql, attempts=6):
    body = json.dumps({'query': sql}).encode('utf-8')
    wait = 3
    for attempt in range(attempts):
        req = urllib.request.Request(URL, data=body, method='POST')
        req.add_header('Authorization', 'Bearer ' + TOKEN)
        req.add_header('Content-Type', 'application/json')
        try:
            with urllib.request.urlopen(req, timeout=180) as res:
                return json.loads(res.read().decode('utf-8'))
        except (urllib.error.HTTPError, urllib.error.URLError) as err:
            if attempt == attempts - 1:
                raise
            time.sleep(wait)
            wait = min(wait * 2, 30)


def main():
    total = query('select count(*) as c from public.product_catalog')[0]['c']
    with open(OUT, 'w', encoding='utf-8', newline='') as fh:
        fh.write('code\n')
        offset = 0
        while offset < total:
            rows = query(
                'select code from public.product_catalog order by code limit %s offset %s'
                % (PAGE, offset)
            )
            if not rows:
                break
            for row in rows:
                fh.write(row['code'] + '\n')
            offset += len(rows)
            print('codes %s / %s' % (offset, total), flush=True)
    print('written %s' % OUT, flush=True)


if __name__ == '__main__':
    main()
