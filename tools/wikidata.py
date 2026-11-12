import csv, io, re, json, collections, sys
txt=open('source/wikidata.csv',encoding='utf-8').read()
parts=re.split(r'^#(\w+)\r?\n',txt,flags=re.M)
T={'Q195339':'research station','Q211748':'oil field','Q74047':'ghost town','Q182676':'mountain hut'}
out=[]; cnt=collections.Counter()
pt=re.compile(r'Point\(([-\d.eE]+) ([-\d.eE]+)\)')
for k,body in zip(parts[1::2],parts[2::2]):
    for r in csv.DictReader(io.StringIO(body)):
        m=pt.search(r.get('c') or '')
        if not m: continue
        lon,lat=float(m.group(1)),float(m.group(2))
        if not(-90<=lat<=90 and -180<=lon<=180): continue
        kind={'mines':'mine','arch':'archaeological site'}.get(k) or T.get((r.get('t') or '').rsplit('/',1)[-1],'place')
        out.append((lon,lat,kind,(r.get('l') or '')[:60])); cnt[kind]+=1
print(cnt, len(out))
print('south of 60S:',collections.Counter(o[2] for o in out if o[1]<-60))
print([o for o in out if o[1]<-60 and o[2]=='research station'][:8])
json.dump(out,open('out/wikidata.json','w'))
