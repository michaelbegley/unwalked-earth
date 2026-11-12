import sys, numpy as np, rasterio
from rasterio.warp import reproject, Resampling
from rasterio.transform import from_bounds
W,H=4096,2048
src=rasterio.open(sys.argv[1])
dt=from_bounds(-180,-90,180,90,W,H)
out={}
for name,rs in (('mean',Resampling.average),('min',Resampling.min)):
    a=np.full((H,W),np.nan,np.float32)
    reproject(rasterio.band(src,1),a,src_transform=src.transform,src_crs=src.crs,src_nodata=-9999,dst_transform=dt,dst_crs='EPSG:4326',dst_nodata=np.nan,resampling=rs,num_threads=2)
    out[name]=a; print(name,np.nanmin(a),np.nanmax(a),np.isfinite(a).mean()); sys.stdout.flush()
np.savez_compressed('tt.npz',**out)
def at(n,lt,ln):
    y=int((90-lt)/180*H);x=int((ln+180)/360*W);print(f'{n:18s} mean {out["mean"][y,x]/60:8.1f} h  min {out["min"][y,x]/60:8.1f} h')
for n,lt,ln in [('nebraska',41.3,-99),('greenland',72,-40),('amazon',-5,-65),('simpson',-25.53,136.45),('rub al khali',19.91,50.14),('tibet',33.53,86.53),('el djouf',20.35,-6.55),('selwyn',64.38,-131.18),('cherskiy',66.67,140.32),('moomba',-28.1,140.2),('veladero',-29.4,-69.9),('baffin',69.83,-73.87),('nunavut',65,-100)]: at(n,lt,ln)
