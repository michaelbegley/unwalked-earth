import json, numpy as np
from PIL import Image
g=np.load('out/grid.npz'); S=g['S']; land=g['land']; H,W=S.shape
nm=json.load(open('../data/names.json')); n=np.array(Image.open('../data/names.png')).astype(np.uint16)
cid=(n[...,0]|((n[...,2]>>4)<<8)); cid=np.repeat(np.repeat(cid,2,0),2,1)
lat=90-(np.arange(H)+0.5)*180/H; lon=-180+(np.arange(W)+0.5)*360/W
LAT=np.repeat(lat[:,None],W,1); LON=np.repeat(lon[None,:],H,0)
cell=(2*np.pi*6371/W)*(np.pi*6371/H)*np.cos(np.radians(LAT))
hi=land&(S>=50)
tot=np.bincount(cid[land],weights=cell[land],minlength=len(nm['c']))
un=np.bincount(cid[hi],weights=cell[hi],minlength=len(nm['c']))
rows=[]
for i in np.argsort(un)[::-1][:14]:
    if i==0 or un[i]<20000: continue
    m=hi&(cid==i); w=cell[m]; la,lo=np.radians(LAT[m]),np.radians(LON[m])
    x=(np.cos(la)*np.cos(lo)*w).sum(); y=(np.cos(la)*np.sin(lo)*w).sum(); z=(np.sin(la)*w).sum(); r=np.sqrt(x*x+y*y+z*z)
    rows.append(dict(n=nm['c'][i],km2=int(round(un[i],-3)),pct=round(100*un[i]/tot[i],1),lat=round(float(np.degrees(np.arcsin(z/r))),1),lon=round(float(np.degrees(np.arctan2(y,x))),1)))
rows=rows[:10]
for r in rows: print(r)
m=json.load(open('../data/meta.json')); m['top']=rows; json.dump(m,open('../data/meta.json','w'),separators=(',',':'))
