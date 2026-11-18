import json
from reportlab.pdfgen import canvas
from reportlab.lib.colors import Color
from pypdf import PdfReader,PdfWriter
S='/tmp/claude-0/-home-claude/0e779dd7-9c76-5df6-b3e6-848e20bb5bdb/scratchpad'
k=0.75;H=792
c=canvas.Canvas(S+'/champs.pdf',pagesize=(612,792))
tips={'pour':'Nom de la personne qui reçoit','de':'Nom de la personne qui offre','message':'Message personnalisé','code':'Code de la carte-cadeau'}
tr=Color(0,0,0,alpha=0)
for f in json.load(open(S+'/champs.json')):
    x=f['x']*k+3;w=f['w']*k-6;h=f['h']*k-4;y=H-(f['y']+f['h'])*k+2
    c.acroForm.textfield(name=f['n'],tooltip=tips[f['n']],x=x,y=y,width=w,height=h,borderWidth=0,borderColor=tr,fillColor=tr,textColor=Color(.165,.184,.169),fontName='Helvetica-Bold' if f['n']=='code' else 'Helvetica',fontSize=10 if f['m'] else 11,fieldFlags='multiline' if f['m'] else '',forceBorder=False)
c.showPage();c.save()
ov=PdfReader(S+'/champs.pdf');bg=PdfReader(S+'/fond.pdf')
print(len(bg.pages))
w=PdfWriter(clone_from=ov)
w.pages[0].merge_page(bg.pages[0],over=False)
w.add_metadata({'/Title':'Carte-cadeau Georama','/Author':'Georama'})
out='/home/claude/georama-outil/carte-cadeau/pdf/carte-cadeau-georama-modele.pdf'
w.write(out)
r=PdfReader(out);print(list(r.get_fields().keys()))
w2=PdfWriter(clone_from=r)
w2.update_page_form_field_values(w2.pages[0],{'pour':'Marcel Tremblay','de':'Julie et les enfants','message':"Joyeux Noël papa ! Pour ton lac Brochet, celui où tu nous as appris à pêcher. Choisis ton coin et tes couleurs. On t'aime.",'code':'ABCD-EFGH-JKLM-NPQR'},auto_regenerate=False)
w2.write(S+'/test-rempli.pdf')
