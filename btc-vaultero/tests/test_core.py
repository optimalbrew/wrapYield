from vaultero.core import uses_vaultero

def test_uses_vaultero():
    assert uses_vaultero() == "vaultero version: 0.1.0 with bitcoinutils version: 0.7.3" #or "vaultero unkown version"
