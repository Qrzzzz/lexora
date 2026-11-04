"""Rebuild SystemC deck; --xlsx refreshes the lossless source snapshot."""
import argparse,hashlib,json
from pathlib import Path
from zipfile import ZipFile
import xml.etree.ElementTree as E
ROOT=Path(__file__).resolve().parents[1]
SOURCE=ROOT/'data/sources/systemc/entries.json'
p=argparse.ArgumentParser();p.add_argument('--xlsx',type=Path);args=p.parse_args()
if args.xlsx:
 n={'s':'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
 with ZipFile(args.xlsx) as z:
  shared=[''.join(t.itertext()) for t in E.fromstring(z.read('xl/sharedStrings.xml')).findall('s:si',n)] if 'xl/sharedStrings.xml' in z.namelist() else []
  rows=[]
  for r in E.fromstring(z.read('xl/worksheets/sheet1.xml')).findall('.//s:sheetData/s:row',n):
   row={}
   for c in r.findall('s:c',n):
    value=c.find('s:v',n);value=value.text if value is not None else ''.join(c.find('s:is',n).itertext()) if c.find('s:is',n) is not None else ''
    if c.get('t')=='s':value=shared[int(value)]
    row[''.join(filter(str.isalpha,c.get('r')))]=value.strip()
   if any(row.values()):rows.append(row)
  assert rows[0]['A']=='英语单词' and rows[0]['B']=='中文翻译','Unexpected columns'
  entries=[{'term':r['A'],'definition':r['B']} for r in rows[1:]]
  assert all(e['term'] and e['definition'] for e in entries)
 snapshot={'filename':args.xlsx.name,'sha256':hashlib.sha256(args.xlsx.read_bytes()).hexdigest(),'sheet':'Sheet1','entries':entries}
 SOURCE.parent.mkdir(parents=True,exist_ok=True);SOURCE.write_text(json.dumps(snapshot,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
snapshot=json.loads(SOURCE.read_text(encoding='utf-8'));entries=snapshot['entries']
assert len(entries)==219 and len({e['term'] for e in entries})==219

import re
lexicon=json.loads((SOURCE.parent/'ecdict-subset.json').read_text(encoding='utf-8'))['entries']
editorial=json.loads((SOURCE.parent/'editorial.json').read_text(encoding='utf-8'))
curation=json.loads((SOURCE.parent/'curation.json').read_text(encoding='utf-8'))['regularPlurals']
cards=[];seen=set();missing=[]
for entry in entries:
 original=entry['term'];term=curation.get(original,original);definition=entry['definition']
 if term in seen:continue
 seen.add(term)
 row=lexicon.get(term.lower(),{});edit=editorial.get(term,{})
 phonetic=edit.get('phonetic') or row.get('phonetic','')
 parts=list(dict.fromkeys(re.findall(r'(?<![a-z])(n|v|a|adj|adv|vt|vi|prep|pron|conj|num|det|aux|art|int)\.',(row.get('translation','')+'\n'+row.get('definition','')).replace('\\n','\n'))))
 pos=edit.get('partOfSpeech') or '; '.join({'a':'adj'}.get(v,v)+'.' for v in parts)
 if not phonetic or not pos:missing.append({'term':term,'phonetic':phonetic,'pos':pos,'sourcePos':row.get('pos'),'translation':row.get('translation','')[:100]});continue
 phonetic=phonetic.strip(' /[]').replace("'",'ˈ').replace(':','ː').replace('ә','ə')
 for old,new in [('ei','eɪ'),('ai','aɪ'),('au','aʊ'),('əu','əʊ'),('oi','ɔɪ'),('əː','ɜː'),('ɒː','ɔː')]:phonetic=phonetic.replace(old,new)
 card={'id':'systemc-'+hashlib.sha256(term.encode()).hexdigest()[:16],'type':'vocabulary','term':term,'shortDefinition':definition if len(definition)<=32 else definition[:31]+'…','pronunciations':[{'system':'ipa','region':'general','value':'/'+phonetic+'/'}],'senses':[{'id':'source-meaning','partOfSpeech':pos,'definitions':[definition]}],'sourceRefs':['user-systemc-workbook','systemc-editorial' if edit else 'ecdict-systemc']}
 notes=[]
 if original!=term:notes.append('原表词形：'+original+'；规则复数已还原为单数。')
 if edit.get('note'):notes.append(edit['note'])
 if term=='stimulus':notes.append('不规则复数：stimuli /ˈstɪmjʊlaɪ/。')
 if notes:card['note']=' '.join(notes)
 cards.append(card)
if missing:
 (ROOT/'output/systemc-missing.json').write_text(json.dumps(missing,ensure_ascii=False,indent=2),encoding='utf-8')
 raise ValueError('Missing lexical metadata: '+', '.join(m['term'] for m in missing))
assert len(cards)==218
metadata=json.loads((SOURCE.parent/'ecdict-subset.json').read_text(encoding='utf-8'))
deck={'format':'lexora.deck','schemaVersion':2,'id':'lexora:systemc','revision':1,'title':'SystemC 英语词汇','description':'原表 219 条，经规则复数归一合并为 218 条；保留原始中文释义，补充音标与词性。','language':'en','answerLanguage':'zh-Hans','sources':[{'id':'user-systemc-workbook','title':snapshot['filename']},{'id':'ecdict-systemc','title':'ECDICT 音标与词性','url':metadata['url'],'license':'MIT'},{'id':'systemc-editorial','title':'SystemC 技术术语读法与词性编校'}],'cards':cards}
(ROOT/'examples/systemc-dictionary.json').write_text(json.dumps(deck,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print('SystemC: 218 curated entries exported')
