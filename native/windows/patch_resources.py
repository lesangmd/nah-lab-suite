"""Replace matching PE resources in the existing x64 launcher with app.res data.

Only in-place replacements that fit their previous resource allocation are allowed.
"""
import struct
from pathlib import Path

def u16(b, o): return struct.unpack_from('<H', b, o)[0]
def u32(b, o): return struct.unpack_from('<I', b, o)[0]

def res_entries(blob):
    out = {}
    pos = 0
    while pos < len(blob):
        size, header = struct.unpack_from('<II', blob, pos)
        if not size and not header:
            pos += header or 32
            continue
        typ = u16(blob, pos + 10)
        name = u16(blob, pos + 14)
        lang = u16(blob, pos + header - 10)
        if typ:
            out[(typ, name, lang)] = blob[pos + header:pos + header + size]
        pos += (header + size + 3) & ~3
    return out

def pe_entries(blob):
    pe = u32(blob, 0x3c)
    assert blob[pe:pe+4] == b'PE\0\0'
    section_count = u16(blob, pe+6)
    opt = pe+24
    assert u16(blob, opt) == 0x20b
    resource_rva = u32(blob, opt+112+8*2)
    sections = []
    sh = opt + u16(blob, pe+20)
    for i in range(section_count):
        off = sh+i*40
        sections.append((u32(blob,off+12),u32(blob,off+16),u32(blob,off+20)))
    def raw(rva):
        for va, size, off in sections:
            if va <= rva < va+size: return off+rva-va
        raise ValueError(f'RVA {rva:x} outside sections')
    base = raw(resource_rva)
    def children(relative):
        pos = base+relative
        count = u16(blob,pos+12)+u16(blob,pos+14)
        return [(u32(blob,pos+16+8*i),u32(blob,pos+20+8*i)) for i in range(count)]
    out={}
    for typ, rel in children(0):
        if typ & 0x80000000: continue
        for name, nrel in children(rel & 0x7fffffff):
            if name & 0x80000000: continue
            for lang, drel in children(nrel & 0x7fffffff):
                if drel & 0x80000000: continue
                data_entry=base+drel
                data_rva=u32(blob,data_entry)
                size=u32(blob,data_entry+4)
                out[(typ,name,lang)]=(raw(data_rva),size,data_entry)
    return out

def main():
    old=bytearray(Path('base-launcher-v1.3.4.exe').read_bytes())
    new=res_entries(Path('app.res').read_bytes())
    existing=pe_entries(old)
    for key, data in new.items():
        if key not in existing:
            print('Missing',key); continue
        pos, size, entry=existing[key]
        print(key,'old',size,'new',len(data))
        if len(data)>size: raise ValueError(f'{key} grows {size} -> {len(data)}')
        old[pos:pos+len(data)]=data
        old[pos+len(data):pos+size]=b'\0'*(size-len(data))
        struct.pack_into('<I',old,entry+4,len(data))
    old_agent='NAHISONative/1.3.4 NAHLABDesktop/1.3.4'.encode('utf-16le')
    new_agent='NAHISONative/1.3.9 NAHLABDesktop/1.3.9'.encode('utf-16le')
    if old.count(old_agent)!=1: raise ValueError('Unexpected launcher version string')
    old=old.replace(old_agent,new_agent)
    Path('NAH-LAB-SUITE.exe').write_bytes(old)

if __name__=='__main__': main()
