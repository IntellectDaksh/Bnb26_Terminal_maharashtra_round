"""Identity hashing + field-level PII encryption (Fernet, rotatable keys)."""
import hashlib, hmac, os
from cryptography.fernet import Fernet, MultiFernet

_PEPPER = os.environ["ID_PEPPER"].encode()
_F = MultiFernet([Fernet(k.strip()) for k in os.environ["PII_KEYS"].split(",")])  # newest first

def norm_email(e: str) -> str:
    local, _, dom = e.strip().lower().partition("@")
    local = local.split("+")[0]
    if dom in ("gmail.com", "googlemail.com"):
        local, dom = local.replace(".", ""), "gmail.com"
    return f"{local}@{dom}"

def identity_hash(email: str) -> str:          # dedupe key; never store raw email in Redis
    return hmac.new(_PEPPER, norm_email(email).encode(), hashlib.sha256).hexdigest()

def encrypt_pii(s: str) -> str: return _F.encrypt(s.encode()).decode()
def decrypt_pii(t: str) -> str: return _F.decrypt(t.encode()).decode()
