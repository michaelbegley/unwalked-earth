import json, numpy as np
from PIL import Image
from shapely.geometry import shape, Point
from shapely.strtree import STRtree
g=np.load('grid.npz'); S=g['S']; A=g['A']; land=g['land']; ice=g['ice']; elev=g['elev']
H,W=S.shape; iy=g['iy']; ix=g['ix']
names=json.load(open('townnames.json'))
which=np.zeros((H,W),np.uint8); which[iy,ix]=g['which']
# texture
Rc=np.where(land, np.clip(np.round(S*2.54)+1,1,255),0).astype(np.uint8)
Gc=np.clip(np.round(np.sqrt(A)*8),0,255).astype(np.uint8)
Bc=(which | (ice.astype(np.uint8)<<2) | (np.clip(elev/300,0,31).astype(np.uint8)<<3)).astype(np.uint8)
Image.fromarray(np.dstack([Rc,Gc,Bc])).save('site/world.png',optimize=True)
# area histogram
lat=90-(np.arange(H)+0.5)*180/H; LAT=np.repeat(lat[:,None],W,1)
a=np.cos(np.radians(LAT))[land]; s=S[land]; la=LAT[land]
cum=[round(100*a[s>=t].sum()/a.sum(),2) for t in range(0,101)]
cumx=[round(100*a[(s>=t)&(la>-60)].sum()/a[la>-60].sum(),2) for t in range(0,101)]
km2=510.1e6*np.pi/2/ (W*H) # per-cell area at equator: (2piR/W)*(piR/H)
cell=(2*np.pi*6371/W)*(np.pi*6371/H)
land_km2=float((a*cell).sum())
# top spots
cf=json.load(open('/home/claude/data/ne_10m_admin_0_countries.geojson'))['features']
cg=[shape(f['geometry']) for f in cf]; ct=STRtree(cg)
rf=[f for f in json.load(open('/home/claude/data/ne_10m_geography_regions_polys.geojson'))['features']]
rg=[shape(f['geometry']) for f in rf]; rt=STRtree(rg)
lon=-180+(np.arange(W)+0.5)*360/W
Dt=np.zeros((H,W),np.float32); Dt[iy,ix]=g['d_town']; It=np.zeros((H,W),np.int64); It[iy,ix]=g['i_town']
Dr=np.zeros((H,W),np.float32); Dr[iy,ix]=g['d_road']
key=S*10000+np.minimum(A,9999)   # rank by score, then by distance in
key=np.where(land,key,-1)
order=np.argsort(key.ravel())[::-1]
def hav(la1,lo1,la2,lo2):
    p=np.radians; d=np.sin(p(la2-la1)/2)**2+np.cos(p(la1))*np.cos(p(la2))*np.sin(p(lo2-lo1)/2)**2
    return 2*6371*np.arcsin(np.sqrt(d))
spots=[]; nant=0; ngr=0
for o in order[:2_000_000:1]:
    y,x=divmod(int(o),W); lt,ln=float(lat[y]),float(lon[x])
    if any(hav(lt,ln,s['lat'],s['lon'])<1100 for s in spots): continue
    pt=Point(ln,lt)
    c=[cf[i]['properties']['NAME'] for i in ct.query(pt) if cg[i].contains(pt)]
    r=sorted([(rg[i].area,rf[i]['properties']['NAME'] or rf[i]['properties'].get('name')) for i in rt.query(pt) if rg[i].contains(pt)])
    country='Antarctica' if lt<-60 else (c[0] if c else '')
    if country=='Antarctica':
        if nant>=2: continue
        nant+=1
    if country=='Greenland':
        if ngr>=1: continue
        ngr+=1
    nm=names[int(It[y,x])]
    spots.append(dict(lat=round(lt,2),lon=round(ln,2),score=round(float(S[y,x])),access=round(float(A[y,x])),country=country,
        region=r[0][1] if r else '',town=nm[0],town_cc=nm[1],town_km=round(float(Dt[y,x])),road_km=round(float(Dr[y,x])),ice=bool(ice[y,x]),elev=int(round(elev[y,x]/100)*100)))
    if len(spots)>=14: break
for s in spots: print(s['lat'],s['lon'],s['score'],s['access'],s['country'],s['region'],s['town'],s['town_km'],s['ice'])
# borders
bl=[]
for f in json.load(open('/home/claude/data/ne_50m_admin_0_boundary_lines_land.geojson'))['features']:
    gm=f['geometry']; ls=[gm['coordinates']] if gm['type']=='LineString' else gm['coordinates']
    for l in ls:
        out=[l[0]]
        for p in l[1:]:
            if abs(p[0]-out[-1][0])+abs(p[1]-out[-1][1])>0.08: out.append(p)
        if out[-1]!=l[-1]: out.append(l[-1])
        bl.append([round(v,2) for p in out for v in p[:2]])
json.dump(dict(cum=cum,cumx=cumx,land_km2=round(land_km2),spots=spots,borders=bl),open('site/meta.json','w'),separators=(',',':'))
print(cum[25],cum[50],cum[75],cumx[25],cumx[50],cumx[75],land_km2)
