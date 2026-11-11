"""Smoke-test HTTP and MCP without linking WhatsApp or reading any messages."""
import asyncio
import json
import sys
import urllib.request
import urllib.error
import http.cookiejar
from pathlib import Path
from mcp import Client, StdioServerParameters

ORIGIN='http://127.0.0.1:8767'
def code(request,opener=None):
    try:
        with (opener.open(request) if opener else urllib.request.urlopen(request,timeout=5)) as response:
            return response.status,response.read()
    except urllib.error.HTTPError as exc:
        return exc.code,exc.read()

async def main():
    assert code(ORIGIN+'/api/status')[0]==401
    jar=http.cookiejar.CookieJar()
    browser=urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar))
    assert code(ORIGIN+'/',browser)[0]==200
    assert code(ORIGIN+'/api/status',browser)[0]==200
    req=urllib.request.Request(ORIGIN+'/api/select',data=b'{"id":"invalid"}',headers={'Content-Type':'application/json','Origin':'https://example.invalid'})
    assert code(req,browser)[0]==403
    req=urllib.request.Request(ORIGIN+'/api/select',data=b'{"id":"invalid"}',headers={'Content-Type':'application/json','Origin':ORIGIN})
    assert code(req,browser)[0]==400
    req=urllib.request.Request(ORIGIN+'/',headers={'Host':'example.invalid'})
    assert code(req)[0]==403
    params=StdioServerParameters(command=sys.executable,args=[str(Path(__file__).resolve().parents[1]/'integrations'/'mcp'/'server.py')])
    async with Client(params,mode='legacy',read_timeout_seconds=15) as client:
        result=await client.list_tools()
        assert sorted(t.name for t in result.tools)==['whatsapp_cases','whatsapp_image','whatsapp_month','whatsapp_status']
        assert all(t.annotations.read_only_hint for t in result.tools)
        status=await client.call_tool('whatsapp_status',{})
        assert not status.is_error
        print(json.dumps({'http_checks':6,'mcp_protocol_ok':True,'read_only_tools':[t.name for t in result.tools]}))

if __name__=='__main__':asyncio.run(main())
