"""Load this installation's local settings, never evaluating configuration as code."""
import os
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
local=ROOT/'.env.local'
if local.exists():
    for line in local.read_text(encoding='utf-8-sig').splitlines():
        line=line.strip()
        if not line or line.startswith('#') or '=' not in line:continue
        name,value=line.split('=',1)
        if not name.startswith('REPORT_') or not name.replace('_','').isalnum():continue
        value=value.strip()
        if len(value)>=2 and value[0]==value[-1] and value[0] in ('"',"'"):value=value[1:-1]
        os.environ.setdefault(name,value)
DATA=Path(os.environ.get('REPORT_DATA_DIR','data'))
if not DATA.is_absolute():DATA=ROOT/DATA
KEY_TARGET=os.environ.get('REPORT_KEY_TARGET','WhatsAppReportAssistant/ArchiveKey-v1')
