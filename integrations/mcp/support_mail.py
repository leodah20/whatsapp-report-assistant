"""Bounded, read-only Invenzi/Movidesk feed for the local collector."""
from datetime import date
import json
from pathlib import Path
import sys
from email import policy
from email.parser import BytesParser
from email.utils import getaddresses

SENDER = "atendimento@invenzi.movidesk.com"
FOLDER = "INBOX"


def poll(since, validity, cursor):
    if date.fromisoformat(since).isoformat() != since or cursor < 0:
        raise ValueError()
    adapter = Path(__file__).resolve().parents[3] / "imap-readonly"
    sys.path.insert(0, str(adapter))
    from mail_core import (
        MAX_RAW_BYTES, checked, connection, load_account, message_metadata,
        message_text, search_criteria, select_readonly,
    )
    account = load_account()
    with connection(account) as client:
        current = select_readonly(client, account, FOLDER)["uidvalidity"]
        start = cursor if current == validity else 0
        criteria = search_criteria(sender=SENDER, since=since)
        criteria.extend([b"UID", f"{start + 1}:*".encode("ascii")])
        values = checked(client.uid("SEARCH", *criteria), "Falha na busca IMAP.")
        uids = sorted({int(uid) for uid in (values[0] or b"").split() if uid.isdigit() and int(uid) > start})
        messages = []
        for uid in uids[:20]:
            requested = str(uid)
            fetched = checked(client.uid("FETCH", requested, f"(UID RFC822.SIZE BODY.PEEK[]<0.{MAX_RAW_BYTES}>)"), "Falha na leitura IMAP.")
            entry = next((row for row in fetched if isinstance(row, tuple) and isinstance(row[1], bytes)), None)
            if entry is None:
                # The message may have been moved; do not silently advance past a failed read.
                break
            attrs, raw = entry
            meta = message_metadata(raw, attrs, current, FOLDER)
            if meta["uid"] != requested:
                raise ValueError()
            addresses = [value.lower() for _, value in getaddresses([meta["from"]])]
            if addresses == [SENDER] and (meta["size_bytes"] or len(raw)) <= len(raw):
                msg = BytesParser(policy=policy.default).parsebytes(raw)
                messages.append({k: meta[k] for k in ("uid", "from", "subject", "date", "message_id")} |
                                {"text": message_text(msg)[:16000]})
            elif addresses == [SENDER]:
                messages.append({"uid": requested, "skipped": "oversize"})
            start = uid
        return {"uidvalidity": current, "cursor": start, "messages": messages, "more": bool(uids and start < uids[-1])}


if __name__ == "__main__":
    try:
        since, validity, cursor = sys.argv[1:]
        sys.stdout.buffer.write(json.dumps(poll(since, validity, int(cursor)), ensure_ascii=False).encode("utf-8"))
    except Exception:
        # Never echo mailbox contents, paths, remote replies or credentials into logs.
        sys.stderr.write("Consulta local de tickets indisponível.\n")
        sys.exit(1)
