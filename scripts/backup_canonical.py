"""Narrow PostgreSQL signature normalization, not SQL rewriting.
Only whitespace outside SQL strings/identifiers/comments is discarded.
Each token boundary is kept, so `a b` cannot compare equal to `ab`.
Dollar-quoted function body wrappers are parsed once; nested dollar strings
inside the SQL body remain opaque literals. Literal content is never changed.
"""
import json,re

def tokens(sql):
    out=[]; i=0; n=len(sql)
    while i<n:
        if sql[i].isspace(): i+=1; continue
        if sql.startswith('--',i):
            end=sql.find('\n',i);end=n if end<0 else end
            out.append(('comment',sql[i:end]));i=end;continue
        if sql.startswith('/*',i):
            start=i;i+=2;depth=1
            while depth:
                if i>=n: raise ValueError('Unclosed SQL comment')
                if sql.startswith('/*',i):depth+=1;i+=2
                elif sql.startswith('*/',i):depth-=1;i+=2
                else:i+=1
            out.append(('comment',sql[start:i]));continue
        escape=sql[i:i+2].lower()=="e'"
        if escape or sql[i] in "'\"":
            start=i
            if escape:i+=1
            q=sql[i];i+=1
            while True:
                if i>=n:raise ValueError('Unclosed SQL quote')
                if escape and sql[i]=='\\':i+=2;continue
                if sql[i]==q:
                    i+=1
                    if i<n and sql[i]==q:i+=1;continue
                    break
                i+=1
            out.append(('quoted',sql[start:i]));continue
        if sql[i]=='$':
            match=re.match(r'\$(?:[A-Za-z_][A-Za-z0-9_]*)?\$',sql[i:])
            if match:
                mark=match.group();end=sql.find(mark,i+len(mark))
                if end<0:raise ValueError('Unclosed dollar literal')
                end+=len(mark);out.append(('dollar',sql[i:end]));i=end;continue
        match=re.match(r'[A-Za-z_\u0080-\uffff][A-Za-z_0-9$\u0080-\uffff]*|[0-9]+(?:\.[0-9]+)?|[-+*/<>=~!@#%^&|?:]+',sql[i:])
        if match:value=match.group();out.append(('token',value));i+=len(value)
        else:out.append(('punct',sql[i]));i+=1
    return out

def canonical_entry(entry):
    # PG18 adds pg_constraint NOT NULL rows; attnotnull remains checked in
    # every column entry on ALL supported versions. No other constraint drops.
    if re.fullmatch(r'constraint\|[^|]+\|[^|]+\|NOT NULL .+',entry):return None
    if not entry.startswith('function|'):return entry
    sql=entry[len('function|'):]
    match=re.search(r'\bAS (\$(?:[A-Za-z_][A-Za-z0-9_]*)?\$)',sql)
    if not match:raise ValueError('Unknown function wrapper')
    end=sql.rfind(match.group(1))
    if end<match.end():raise ValueError('Unknown function body')
    return 'function-tokens|'+json.dumps([tokens(sql[:match.start()]),tokens(sql[match.end():end]),tokens(sql[end+len(match.group(1)):])],ensure_ascii=False,separators=(',',':'))

def canonical(entries):
    return sorted(x for e in entries if (x:=canonical_entry(e)) is not None)
