import numpy as np, matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from scipy.ndimage import gaussian_filter
import sys
def champ(W,H,seed):
    rng=np.random.default_rng(seed)
    s=0.25  # calcul à 1/4 de résolution puis contours vectoriels
    w,h=int(W*s),int(H*s)
    z=np.zeros((h,w))
    for sig,amp in [(w/6,1.0),(w/14,0.45),(w/30,0.18),(w/70,0.06)]:
        n=rng.standard_normal((h,w)); z+=amp*gaussian_filter(n,sig,mode='wrap')/gaussian_filter(n,sig,mode='wrap').std()
    return z
def rendre(nom,W,H,fond,ligne,alpha,lw,niveaux,seed,q=88):
    z=champ(W,H,seed)
    dpi=100
    fig=plt.figure(figsize=(W/dpi,H/dpi),dpi=dpi)
    ax=fig.add_axes([0,0,1,1]); ax.set_axis_off()
    fig.patch.set_facecolor(fond); ax.set_facecolor(fond)
    h,w=z.shape
    X,Y=np.meshgrid(np.linspace(0,W,w),np.linspace(0,H,h))
    lv=np.linspace(z.min(),z.max(),niveaux)
    ax.contour(X,Y,z,levels=lv,colors=[ligne],linewidths=lw,alpha=alpha,antialiased=True,negative_linestyles='solid')
    # une ligne maîtresse sur 5, un peu plus marquée
    ax.contour(X,Y,z,levels=lv[::5],colors=[ligne],linewidths=lw*1.8,alpha=min(1,alpha*1.5),antialiased=True,negative_linestyles='solid')
    ax.set_xlim(0,W); ax.set_ylim(0,H)
    fig.savefig(nom,dpi=dpi,facecolor=fond,pil_kwargs={'quality':q,'optimize':True,'progressive':True} if nom.endswith('.jpg') else {})
    plt.close(fig)
# sombre (accueil, à propos, portfolio)
rendre('georama-fond-topo-sombre-3200x1800.jpg',3200,1800,'#020808','#33433f',0.45,1.1,70,11)
rendre('georama-fond-topo-sombre-2400x2400.jpg',2400,2400,'#020808','#33433f',0.45,1.1,70,12)
# vert (sections claires)
rendre('georama-fond-topo-vert-3200x1800.jpg',3200,1800,'#A7B957','#D9E3A6',0.75,1.2,70,21)
rendre('georama-fond-topo-vert-2400x2400.jpg',2400,2400,'#A7B957','#D9E3A6',0.75,1.2,70,22)
