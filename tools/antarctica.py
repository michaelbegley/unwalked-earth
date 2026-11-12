import sys, struct, json, numpy as np
from scipy.spatial import cKDTree
SHP=sys.argv[1]
f=open(SHP,'rb').read()
# point shapefile: records are 8-byte header + int type + 2 doubles = 28 bytes
body=np.frombuffer(f[100:],dtype=np.dtype([('num','>i4'),('len','>i4'),('t','<i4'),('x','<f8'),('y','<f8')]))
assert (body['t']==1).all() and (body['len']==10).all(), 'not plain points'
x=body['x']; y=body['y']; print('records',len(x))
try:
    from pyproj import Transformer
    tr=Transformer.from_crs('+proj=stere +lat_0=-90 +lat_ts=-71 +lon_0=0 +x_0=0 +y_0=0 +datum=WGS84 +units=m','EPSG:4326',always_xy=True)
    lon,lat=tr.transform(x,y)
except ImportError:
    a=6378137.0; e=0.0818191908426; phc=np.radians(71)
    tc=np.tan(np.pi/4-phc/2)/((1-e*np.sin(phc))/(1+e*np.sin(phc)))**(e/2); mc=np.cos(phc)/np.sqrt(1-e*e*np.sin(phc)**2)
    rho=np.hypot(x,y); t=rho*tc/(a*mc); ph=np.pi/2-2*np.arctan(t)
    for _ in range(6): ph=np.pi/2-2*np.arctan(t*((1-e*np.sin(ph))/(1+e*np.sin(ph)))**(e/2))
    lat=-np.degrees(ph); lon=np.degrees(np.arctan2(x,y))
print('lat range',lat.min(),lat.max(),'lon range',lon.min(),lon.max())
# thin to unique ~1 km cells
key=np.unique(np.round(np.c_[lat,lon]*np.array([100,20])).astype(np.int64),axis=0); plat=key[:,0]/100; plon=key[:,1]/20
print('unique places',len(key))
np.save('ant/records_latlon.npy',np.c_[plat,plon].astype(np.float32))
g=dict(np.load('grid.npz')); S=g['S'].astype(np.float64); A=g['A'].astype(np.float64); land=g['land']; H,W=S.shape
glat=90-(np.arange(H)+0.5)*180/H; glon=-180+(np.arange(W)+0.5)*360/W
def xyz(lo,la):
    lo,la=np.radians(lo),np.radians(la); return np.c_[np.cos(la)*np.cos(lo),np.cos(la)*np.sin(lo),np.sin(la)]
ys,xs=np.nonzero(land&(glat[:,None]<-60))
d,_=cKDTree(xyz(plon,plat)).query(xyz(glon[xs],glat[ys]),workers=-1); dkm=2*6371*np.arcsin(np.clip(d/2,0,1))
L=80.0; reach=lambda a:1-np.exp(-(a/L)**1.2)
A0=A[ys,xs]; S0=S[ys,xs]; A1=np.minimum(A0,dkm)
r0=reach(A0); fac=np.where(r0>1e-3,np.clip(S0/(100*np.maximum(r0,1e-9)),0,1),0)
S1=np.minimum(S0,np.where(r0>1e-3,fac*100*reach(A1),S0))
w=np.cos(np.radians(glat[ys]))
for t in (50,70,90): print(f'Antarctica >={t}: {100*w[S0>=t].sum()/w.sum():.1f}% -> {100*w[S1>=t].sum()/w.sum():.1f}%')
print('median distance to a record, km',np.median(dkm),'max',dkm.max())
S[ys,xs]=S1; A[ys,xs]=A1
which=np.zeros((H,W),np.uint8); which[g['iy'],g['ix']]=g['which']; ch=np.zeros((H,W),bool); ch[ys,xs]=dkm<A0; which[ch]=1
g['which']=which[g['iy'],g['ix']]; g['S']=S.astype(np.float32); g['A']=A.astype(np.float32)
np.savez_compressed('ant/grid_ant.npz',**g)
