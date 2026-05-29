import json
from pathlib import Path
p=Path(r"c:\Users\James\OneDrive\Documents\James\BSU\3202\Software Design\SEASCAN\trained_model\Code\train_coastal_classifier.ipynb")
with p.open('r', encoding='utf-8') as f:
    data=json.load(f)
print('cells', len(data.get('cells',[])))
for i, c in enumerate(data.get('cells',[])[:10]):
    print('CELL', i)
    print(' keys:', list(c.keys()))
    print(' top-level id present:', 'id' in c)
    print(' metadata keys:', list(c.get('metadata',{}).keys()))
    print('---')
