import json,base64,urllib.request,urllib.error,time,http.client,socket
BASE="https://api.pixellab.ai/v1"
def call(ep,body,timeout=240,tries=5):
    last=None
    for i in range(tries):
        try:
            req=urllib.request.Request(f"{BASE}/{ep}",data=json.dumps(body).encode(),
                headers={"Content-Type":"application/json"})
            with urllib.request.urlopen(req,timeout=timeout) as r: return json.load(r)
        except urllib.error.HTTPError as e:
            if e.code in (429,500,502,503,504):
                last=e; time.sleep(2**i); continue
            raise
        except (urllib.error.URLError,http.client.HTTPException,
                OSError,TimeoutError,socket.timeout) as e:
            # RemoteDisconnected/ConnectionReset arrive unwrapped from urllib, so the
            # retry has to cover the transport exceptions too, not just URLError.
            last=e; time.sleep(2**i); continue
    raise last
def b64(path): return base64.b64encode(open(path,'rb').read()).decode()
def save(d,path):
    img=d["image"] if "image" in d else d
    open(path,'wb').write(base64.b64decode(img["base64"])); return path
