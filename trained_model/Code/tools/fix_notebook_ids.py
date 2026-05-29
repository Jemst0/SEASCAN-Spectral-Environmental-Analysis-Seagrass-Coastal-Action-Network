"""
Script to move top-level cell 'id' into 'metadata.id' for a Jupyter notebook.
Usage:
    python fix_notebook_ids.py path/to/notebook.ipynb

This updates the notebook in-place and makes a backup copy with .bak extension.
"""
import json
import sys
from pathlib import Path

def fix_notebook(path: Path):
    with path.open('r', encoding='utf-8') as f:
        data = json.load(f)

    if 'cells' not in data:
        raise RuntimeError('No cells key in notebook')

    changed = False
    for cell in data['cells']:
        if 'id' in cell:
            cid = cell.pop('id')
            if 'metadata' not in cell:
                cell['metadata'] = {}
            if 'id' not in cell['metadata']:
                cell['metadata']['id'] = cid
                changed = True

    if changed:
        backup = path.with_suffix(path.suffix + '.bak')
        path.replace(backup)
        with path.open('w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=4)
        print(f'Updated notebook and saved backup to: {backup}')
    else:
        print('No changes necessary.')

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print('Usage: python fix_notebook_ids.py path/to/notebook.ipynb')
        sys.exit(1)
    nb_path = Path(sys.argv[1])
    if not nb_path.exists():
        print('Notebook file not found:', nb_path)
        sys.exit(2)
    fix_notebook(nb_path)
