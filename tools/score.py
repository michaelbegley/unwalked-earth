import numpy as np, json, csv
from scipy import ndimage as ndi
from scipy.spatial import cKDTree
g=dict(np.load('out/grid_base.npz')); S=g['S'].astype(np.float64); A=g['A'].astype(np.float64); land=g['land']; ice=g['ice']
H,W=S.shape; iy,ix=g['iy'],g['ix']
lat=90-(np.arange(H)+0.5)*180/H; lon=-180+(np.arange(W)+0.5)*360/W
LAT=np.repeat(lat[:,None],W,1)
tt=np.load('out/tt.npz'); tmean=tt['mean']; tmin=tt['min']
# baseline: fastest cell within ~150 km (the nearest road, track, river or coast corridor)
big=np.where(np.isfinite(tmin),tmin,1e9)
v=ndi.minimum_filter1d(big,size=31,axis=0,mode='nearest')
base=np.empty_like(v)
for y in range(H):
    r=int(min(W//4,round(15/max(np.cos(np.radians(lat[y])),0.05))))
    base[y]=ndi.minimum_filter1d(v[y],size=2*r+1,mode='wrap')
excess_h=np.clip((tmean-base)/60,0,None)
walk_km=np.where(np.isfinite(tmean)&(base<1e8),excess_h*4.0,np.inf)   # 4 km/h on foot
A2=np.minimum(A,walk_km)
used_tt=(walk_km<A)&land
# Antarctic facilities (COMNAP)
names=json.load(open('out/townnames_base.json'))
rows=list(csv.DictReader(open('source/comnap.csv',encoding='utf-8-sig')))
pts=[];pn=[]
for r in rows:
    try: pts.append((float(r['Longitude (DD)']),float(r['Latitude (DD)']))); pn.append(r['English Name'].strip())
    except: pass
for r in csv.DictReader(open('source/airports.csv',encoding='utf-8')):
    try: pts.append((float(r['longitude_deg']),float(r['latitude_deg']))); pn.append(r['name'].strip()+(' (closed airstrip)' if r['type']=='closed' else ''))
    except: pass
for lo,la,kind,lab in json.load(open('out/wikidata.json')):
    pts.append((lo,la)); pn.append((lab or kind)+' ('+kind+')')
pts.append((-38.4592,72.5796)); pn.append('Summit Station')  # staffed year-round since 2003; coordinates not confirmed in the fact check
pts=np.array(pts); print('extra pts',len(pts))
def xyz(lo,la):
    lo,la=np.radians(lo),np.radians(la); return np.c_[np.cos(la)*np.cos(lo),np.cos(la)*np.sin(lo),np.sin(la)]
P=xyz(lon[ix],lat[iy]); d,i=cKDTree(xyz(pts[:,0],pts[:,1])).query(P,workers=-1); dkm=2*6371*np.arcsin(np.clip(d/2,0,1))
d_town=g['d_town'].astype(np.float64); i_town=g['i_town'].copy()
closer=dkm<d_town; base_n=len(names); names+= [(n,'AQ' if p[1]<-60 else 'GL',0) for n,p in zip(pn,pts)]
i_town[closer]=base_n+i[closer]; d_town[closer]=dkm[closer]
Ac=np.zeros((H,W)); Ac[iy,ix]=dkm
A2=np.where(land,np.minimum(A2,np.where(land,Ac,np.inf)),0)
ant=LAT<-60
L=np.where(ice|ant,80.0,120.0)
reach=lambda a:1-np.exp(-(a/L)**1.2)
r_old=reach(A); factor=np.where(r_old>1e-3,S/(100*np.maximum(r_old,1e-9)),0)
S2=np.where(r_old>1e-3,np.clip(factor,0,1)*100*reach(A2),S); S2=np.where(land,np.minimum(S2,S),0)
which=g['which'].copy(); which[used_tt[iy,ix]]=0
g.update(S=S2.astype(np.float32),A=A2.astype(np.float32),d_town=d_town.astype(np.float32),i_town=i_town,which=which)
np.savez_compressed('out/grid.npz',**g); json.dump(names,open('out/townnames.json','w'))
a=np.cos(np.radians(LAT))[land]; s1=S[land]; s2=S2[land]; la=LAT[land]
for t in (25,50,75):
    print(f'>={t}: before {100*a[s1>=t].sum()/a.sum():.1f}% -> after {100*a[s2>=t].sum()/a.sum():.1f}% | excl Antarctica {100*a[(s1>=t)&(la>-60)].sum()/a[la>-60].sum():.1f}% -> {100*a[(s2>=t)&(la>-60)].sum()/a[la>-60].sum():.1f}%')
def at(n,lt,ln):
    y=int((90-lt)/180*H);x=int((ln+180)/360*W);print(f'{n:16s} score {S[y,x]:5.1f} -> {S2[y,x]:5.1f}   access {A[y,x]:5.0f} -> {A2[y,x]:5.0f} km')
for n,lt,ln in [('nebraska',41.3,-99),('greenland 72N',72,-40),('greenland top',71.32,-38.8),('amazon',-5,-65),('simpson',-25.53,136.45),('rub al khali',19.91,50.14),('tibet',33.53,86.53),('el djouf',20.35,-6.55),('selwyn',64.38,-131.18),('cherskiy',66.67,140.32),('baffin',69.83,-73.87),('alaska range',61.57,-154.12),('jabal abyad',17.8,24.3),('ant plateau',-80,80),('ellsworth',-77.65,-79.94),('e antarctica',-76.68,73.61)]: at(n,lt,ln)
