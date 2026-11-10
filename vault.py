"""Read only our archive key; --init creates it. Never enumerate other secrets."""
import base64
import secrets
import sys
import win32cred
import pywintypes
from envconfig import KEY_TARGET

TARGET = KEY_TARGET

def key(create=False):
    try:
        item = win32cred.CredRead(TARGET, win32cred.CRED_TYPE_GENERIC, 0)
        value = item["CredentialBlob"]
        value = value.decode("utf-16-le") if isinstance(value, bytes) else value
    except pywintypes.error as exc:
        if exc.winerror != 1168 or not create:
            raise RuntimeError("Chave local indisponível.") from None
        value = base64.b64encode(secrets.token_bytes(32)).decode("ascii")
        win32cred.CredWrite({"Type":win32cred.CRED_TYPE_GENERIC,"TargetName":TARGET,"UserName":"WhatsAppReportAssistant","CredentialBlob":value,"Persist":win32cred.CRED_PERSIST_LOCAL_MACHINE},0)
    result = base64.b64decode(value, validate=True)
    if len(result) != 32:
        raise RuntimeError("Chave local inválida.")
    return result

if __name__ == "__main__":
    sys.stdout.write(base64.b64encode(key("--init" in sys.argv)).decode("ascii"))
