import struct
from pathlib import Path

VERSION='1.3.27'
ICO='icon.ico'
OUT='app.res'

def align4(b): return b + b'\0' * ((-len(b)) & 3)
def ordid(n): return struct.pack('<HH',0xFFFF,n)
def record(t,n,data,lang=0x0409,flags=0x1030):
    pre=align4(struct.pack('<II',len(data),0)+ordid(t)+ordid(n))
    hdr=pre+struct.pack('<IHHII',0,flags,lang,0,0)
    hdr=struct.pack('<II',len(data),len(hdr))+hdr[8:]
    return hdr+align4(data)
def parse_ico(path):
    b=Path(path).read_bytes(); r,t,c=struct.unpack_from('<HHH',b,0)
    if r or t!=1: raise ValueError('not an ICO')
    out=[]
    for i in range(c):
        w,h,cc,rv,pl,bpp,size,off=struct.unpack_from('<BBBBHHII',b,6+i*16)
        out.append((w,h,cc,rv,pl,bpp,size,b[off:off+size]))
    return out
def group_icon(es):
    b=struct.pack('<HHH',0,1,len(es))
    for rid,e in enumerate(es,1):
        w,h,cc,rv,pl,bpp,size,_=e
        b+=struct.pack('<BBBBHHIH',w,h,cc,rv,pl,bpp,size,rid)
    return b
def wstr(s): return s.encode('utf-16le')+b'\0\0'
def pad(n): return (-n)&3
def vblock(key,value=b'',children=(),type_=0,value_len=None):
    if value_len is None: value_len=len(value) if type_==0 else len(value)//2
    b=struct.pack('<HHH',0,value_len,type_)+wstr(key); b+=b'\0'*pad(len(b)); b+=value; b+=b'\0'*pad(len(b))
    for c in children: b+=c; b+=b'\0'*pad(len(b))
    return struct.pack('<H',len(b))+b[2:]
def sblock(k,v): return vblock(k,wstr(v),type_=1,value_len=len(v)+1)
def version_info():
    fixed=struct.pack('<13I',0xFEEF04BD,0x00010000,(1<<16)|3,(27<<16), (1<<16)|3,(27<<16),0x3F,0,0x00040004,1,0,0,0)
    vals=[
      ('CompanyName','Bệnh viện Hữu nghị Đa khoa Nghệ An - Giai đoạn 2'),
      ('FileDescription','Quản lý chất lượng xét nghiệm'),('FileVersion',VERSION),('InternalName','NAH-LAB-SUITE'),
      ('OriginalFilename','NAH-LAB-SUITE.exe'),('ProductName','Bệnh viện Hữu nghị Đa khoa Nghệ An - Giai đoạn 2'),('ProductVersion',VERSION),
      ('Comments','Quản lý chất lượng xét nghiệm của bệnh viện'),('LegalCopyright','© 2026 Bệnh viện Hữu nghị Đa khoa Nghệ An - Giai đoạn 2')]
    table=vblock('040904E4',children=tuple(sblock(k,v) for k,v in vals),type_=1,value_len=0)
    sfi=vblock('StringFileInfo',children=(table,),type_=1,value_len=0)
    var=vblock('Translation',struct.pack('<HH',0x0409,0x04E4),type_=0,value_len=4)
    vfi=vblock('VarFileInfo',children=(var,),type_=1,value_len=0)
    return vblock('VS_VERSION_INFO',fixed,(sfi,vfi),type_=0,value_len=len(fixed))
def manifest():
    return '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<assembly xmlns="urn:schemas-microsoft-com:asm.v1" manifestVersion="1.0">\n  <assemblyIdentity version="1.3.27.0" processorArchitecture="amd64" name="NAH.LAB.SUITE" type="win32"/>\n  <description>Quản lý chất lượng xét nghiệm - Bệnh viện Hữu nghị Đa khoa Nghệ An - Giai đoạn 2</description>\n  <trustInfo xmlns="urn:schemas-microsoft-com:asm.v3"><security><requestedPrivileges><requestedExecutionLevel level="asInvoker" uiAccess="false"/></requestedPrivileges></security></trustInfo>\n  <application xmlns="urn:schemas-microsoft-com:asm.v3"><windowsSettings>\n    <dpiAware xmlns="http://schemas.microsoft.com/SMI/2005/WindowsSettings">true/pm</dpiAware>\n    <dpiAwareness xmlns="http://schemas.microsoft.com/SMI/2016/WindowsSettings">PerMonitorV2</dpiAwareness>\n    <longPathAware xmlns="http://schemas.microsoft.com/SMI/2016/WindowsSettings">true</longPathAware>\n  </windowsSettings></application>\n</assembly>'''.encode('utf-8')

def main():
    es=parse_ico(ICO)
    b=record(0,0,b'',lang=0,flags=0)
    for i,e in enumerate(es,1): b+=record(3,i,e[-1])
    b+=record(14,1,group_icon(es))
    b+=record(16,1,version_info())
    b+=record(24,1,manifest())
    Path(OUT).write_bytes(b)
    print(f'Wrote {OUT}: {len(es)} icon images + VERSIONINFO + asInvoker manifest')
if __name__=='__main__': main()
