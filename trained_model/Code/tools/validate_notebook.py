"""
Validate and normalize Jupyter notebook cells to ensure each cell has:
 - metadata.id (unique)
 - metadata.language ('python' for code cells, 'markdown' for markdown)

Updates the notebook in-place and keeps a .bak backup.
Usage:
    python validate_notebook.py path/to/notebook.ipynb
"""
import json
import sys
from pathlib import Path
import uuid


def validate(path: Path):
    with path.open('r', encoding='utf-8') as f:
        data = json.load(f)

    if 'cells' not in data:
        raise RuntimeError('No cells in notebook')

    changed = False
    seen_ids = set()
    for i, cell in enumerate(data['cells']):
        meta = cell.setdefault('metadata', {})
        # Ensure metadata.language
        if 'language' not in meta or not isinstance(meta['language'], str) or meta['language']=='' :
            if cell.get('cell_type') == 'code':
                meta['language'] = 'python'
            else:
                meta['language'] = 'markdown'
            changed = True
        # Ensure metadata.id
        if 'id' not in meta or not isinstance(meta['id'], str) or meta['id']=='' :
            # generate a uuid4-based id
            new_id = uuid.uuid4().hex[:16]
            meta['id'] = new_id
            changed = True
        # Deduplicate ids
        if meta['id'] in seen_ids:
            meta['id'] = uuid.uuid4().hex[:16]
            changed = True
        seen_ids.add(meta['id'])

    if changed:
        backup = path.with_suffix(path.suffix + '.bak2')
        path.replace(backup)
        with path.open('w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=4)
        print(f'Notebook updated – backup at: {backup}')
    else:
        print('Notebook already valid – no changes made')

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print('Usage: python validate_notebook.py path/to/notebook.ipynb')
        sys.exit(1)
    p = Path(sys.argv[1])
    if not p.exists():
        print('File not found:', p)
        sys.exit(2)
    validate(p)
