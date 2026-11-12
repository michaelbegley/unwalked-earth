import json, numpy as np
from PIL import Image, ImageDraw
from shapely.geometry import shape
D='source/'; W,H=2048,1024
def px(r): return [((x+180)/360*W,(90-y)/180*H) for x,y,*_ in r]
def polys(g):
    if g['type']=='Polygon': yield g['coordinates']
    else:
        for p in g['coordinates']: yield p
def tc(s):
    s=s.replace('’',"'")
    if any(w.isupper() and len(w)>2 for w in s.split()): s=s.title()
    for a,b in ((' Of ',' of '),("' Al "," al "),(" Al-"," al-"),('Mts.','Mountains'),(' Mtn.',' Mountain'),('Pen.','Peninsula'),(' Ra.',' Range'),("'S ","'s "),('  ',' ')): s=s.replace(a,b)
    return s.strip()
cf=json.load(open(D+'ne_10m_admin_0_countries.geojson'))['features']
cn=['']; ci=Image.new('I',(W,H),0); d=ImageDraw.Draw(ci)
for f in cf:
    cn.append(f['properties']['NAME_LONG'] or f['properties']['NAME']); k=len(cn)-1
    for p in polys(f['geometry']): d.polygon(px(p[0]),fill=k)
rf=[f for f in json.load(open(D+'ne_10m_geography_regions_polys.geojson'))['features'] if (f['properties'].get('NAME') or f['properties'].get('name'))]
rf.sort(key=lambda f:-shape(f['geometry']).area)
rn=['']; ri=Image.new('I',(W,H),0); d=ImageDraw.Draw(ri)
skip={'continent'}
for f in rf:
    cls=(f['properties'].get('FEATURECLA') or f['properties'].get('featurecla') or '').lower()
    if cls in skip: continue
    rn.append(tc(f['properties'].get('NAME') or f['properties'].get('name'))); k=len(rn)-1
    for p in polys(f['geometry']): d.polygon(px(p[0]),fill=k)
c=np.array(ci).astype(np.uint16); r=np.array(ri).astype(np.uint16)
print(len(cn),len(rn),c.max(),r.max())
img=np.dstack([(c&255),(r&255),((c>>8)<<4)|(r>>8)]).astype(np.uint8)
Image.fromarray(img).save('../data/names.png',optimize=True)
json.dump(dict(c=cn,r=rn),open('../data/names.json','w'),ensure_ascii=False,separators=(',',':'))
def at(lt,ln):
    y=int((90-lt)/180*H);x=int((ln+180)/360*W);print(lt,ln,'|',rn[r[y,x]],'|',cn[c[y,x]])
for a in [(19.9,50.1),(-80,-120),(72,-40),(34,86),(-25.5,136.5),(41.3,-99),(66.7,140.3),(-5,-65),(64.4,-131),(22,8),(-77.5,106)]: at(*a)
