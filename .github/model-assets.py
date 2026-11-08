import pathlib,hashlib,json,re,urllib.request
root=pathlib.Path('.')
provenance=json.loads((root/'docs/MODEL_ASSET_PROVENANCE.json').read_text())
sha='ee88ed6948795645a7e4d4d6fa497b63462c44f3'
for entry in provenance['restored']:
 path=entry['path'];p=root/path
 assert hashlib.sha256(p.read_bytes()).hexdigest()==entry['beforeSha256'],path+' unexpected baseline'
 source=path.replace('references/controllers/','app/assets/gamepad/controllers/')
 data=urllib.request.urlopen(f'https://raw.githubusercontent.com/Exoridus/exosnap/{sha}/{source}',timeout=30).read()
 assert hashlib.sha256(data).hexdigest()==entry['sourceSha256'],source+' unexpected upstream source'
 p.write_bytes(data)
notice='app/assets/gamepad/controllers/SOURCE-NOTICE.txt'
(root/'references/controllers/SOURCE-NOTICE.txt').write_bytes(urllib.request.urlopen(f'https://raw.githubusercontent.com/Exoridus/exosnap/{sha}/{notice}',timeout=30).read())
p=root/'references/controllers/gamecube/source.svg';s=p.read_text()
for name in ['body-cube','body-cube-outer','body-start-label']:
 assert s.count(f'id="{name}"')==1
 s=s.replace(f'id="{name}"',f'id="{name}" data-decorative-marking="true"')
p.write_text(s)
for family in ['joycon_grip','joycon_left','joycon_right','joycon_pair','joycon_left_horizontal','joycon_right_horizontal']:
 p=root/'references/controllers'/family/'source.svg';s=p.read_text()
 def transform(m):
  head,group,body=m.groups();count=[0]
  attrs=[f'id="{group}-outline" ',f'id="{group}-grip-detail" data-stick-detail="true" ',f'id="{group}-top" ']
  def pathmatch(q):
   at=count[0];count[0]+=1;return '<path '+attrs[at]
  body=re.sub(r'<path ',pathmatch,body)
  assert count[0]==3,group+' unexpected original paths'
  return head+body+'</g>'
 s=re.sub(r'(<g id="(stick-[lr]-cap)"[^>]*>)(.*?)</g>',transform,s)
 p.write_text(s)
for entry in provenance['restored']:
 assert hashlib.sha256((root/entry['path']).read_bytes()).hexdigest()==entry['resultSha256'],entry['path']+' output mismatch'
print('Verified original source restoration and semantic-only Joy-Con identifiers')
