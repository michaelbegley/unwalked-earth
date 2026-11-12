import base64, json
t=open('template4.html').read()
m=json.load(open('site/meta.json')); m.pop('spots',None)
b=lambda f:'data:image/png;base64,'+base64.b64encode(open(f,'rb').read()).decode()
t=t.replace('__TEX__',b('site/world.png')).replace('__NTEX__',b('site/names.png')).replace('__META__',json.dumps(m,separators=(',',':'))).replace('__NAMES__',open('site/names.json').read())
open('site/index.html','w').write(t); print(len(t)/1e6)
