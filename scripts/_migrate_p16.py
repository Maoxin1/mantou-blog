#!/usr/bin/env python3
# P1-6 迁移脚本：支持 DRY_RUN（仅预览）。MODE=stray|bundles
import os, re, sys, shutil

DRY = os.environ.get("RUN") != "1"
MODE = os.environ.get("MODE","")
POSTS = "content/posts"
STATIC = "static/images/posts"

IMG_RE = re.compile(r"!\[([^\]]*)\]\(([^)]+)\)")

def split_fm(text):
    lines = text.split("\n")
    delim = lines[0].strip()
    assert delim in ("+++","---"), f"bad frontmatter start: {delim!r}"
    end = next(i for i in range(1,len(lines)) if lines[i].strip()==delim)
    return delim, lines[1:end], "\n".join(lines[end+1:])

def parse_fields(delim, fm_lines):
    fields={}
    for ln in fm_lines:
        if delim=="+++":
            m=re.match(r"\s*(\w+)\s*=\s*(.+)", ln)
        else:
            m=re.match(r"\s*(\w+)\s*:\s*(.+)", ln)
        if not m: continue
        k,v=m.group(1),m.group(2).strip()
        v=v.strip().rstrip()
        if v and v[0] in "'\"" and v[-1]==v[0]: v=v[1:-1]
        fields[k]=v
    return fields

ILLEGAL = '/\:*?"<>|'
def slugify(title):
    s="".join(c for c in title if c not in ILLEGAL).strip()
    return s

def emit_yaml(title, date, draft, alias, extra=None):
    out=["---", f'title: "{title}"', f"date: {date}"]
    if draft is not None: out.append(f"draft: {str(draft).lower()}")
    if extra:
        for k,v in extra.items(): out.append(f"{k}: {v}")
    out.append("aliases:")
    out.append(f"  - {alias}")
    out.append("---")
    return "\n".join(out)

def norm_date(d):
    # keep original full value; validator only needs YYYY-MM-DD prefix
    return d.strip()

actions=[]

def migrate_stray(fname, alias, force_slug=None):
    path=os.path.join(POSTS,fname)
    text=open(path,encoding="utf-8").read()
    delim,fm,body=split_fm(text)
    f=parse_fields(delim,fm)
    date=norm_date(f["date"]); title=f["title"]
    draft=f.get("draft","false")
    slug=force_slug or slugify(title)
    datestr=date[:10]
    newname=f"{datestr}-{slug}.md"
    newpath=os.path.join(POSTS,newname)
    newtext=emit_yaml(title,date,draft,alias)+"\n"+body
    actions.append((path,newpath,None,[]))
    print(f"[stray] {fname}")
    print(f"   title={title!r} date={date}")
    print(f"   -> {newname}   (delim {delim}->---, alias {alias})")
    if not DRY:
        open(newpath,"w",encoding="utf-8",newline="\n").write(newtext)
        os.remove(path)

def migrate_bundle(d):
    bdir=os.path.join(POSTS,d)
    idx=os.path.join(bdir,"index.md")
    text=open(idx,encoding="utf-8").read()
    delim,fm,body=split_fm(text)
    f=parse_fields(delim,fm)
    date=norm_date(f["date"]); title=f["title"]; draft=f.get("draft","false")
    datestr=date[:10]
    # collect referenced local images in order
    refs=[]
    for m in IMG_RE.finditer(body):
        src=m.group(2).strip()
        if src.startswith(("/","http://","https://")): continue
        if src not in refs: refs.append(src)
    mapping={}
    for i,src in enumerate(refs,1):
        ext=os.path.splitext(src)[1].lower()
        newimg=f"{datestr}-{i}{ext}"
        mapping[src]=f"/images/posts/{newimg}"
    # rewrite body
    def repl(m):
        alt,src=m.group(1),m.group(2).strip()
        if src in mapping: return f"![{alt}]({mapping[src]})"
        return m.group(0)
    newbody=IMG_RE.sub(repl,body)
    slug=slugify(title)
    newname=f"{datestr}-{slug}.md"
    newpath=os.path.join(POSTS,newname)
    alias=f"/posts/{datestr}/"
    newtext=emit_yaml(title,date,draft,alias)+"\n"+newbody
    allimgs=[x for x in os.listdir(bdir) if x.lower().endswith((".jpg",".jpeg",".png",".gif",".webp"))]
    orphans=[x for x in allimgs if x not in refs]
    print(f"[bundle] {d}/  title={title!r}")
    print(f"   -> {newname}   alias {alias}   (delim {delim}->---)")
    for src in refs:
        print(f"     img {src!r:30} -> {mapping[src]}")
    if orphans: print(f"     ORPHAN(丢弃未引用) {orphans}")
    if not DRY:
        for src in refs:
            shutil.copy(os.path.join(bdir,src), os.path.join(STATIC, os.path.basename(mapping[src])))
        open(newpath,"w",encoding="utf-8",newline="\n").write(newtext)
        shutil.rmtree(bdir)

if MODE=="stray":
    migrate_stray("first.md","/posts/first/",force_slug="first")
    migrate_stray("my-post.md","/posts/my-post/",force_slug="my-post")
    migrate_stray("2026.2.3.md","/posts/2026.2.3/")
elif MODE=="bundles":
    for d in sorted(os.listdir(POSTS)):
        if os.path.isdir(os.path.join(POSTS,d)) and re.match(r"^\d{4}-\d{2}-\d{2}$",d):
            migrate_bundle(d)
print("\nDRY RUN (无改动)" if DRY else "\n已执行")
