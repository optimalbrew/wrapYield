try:
    import vaultero
except ImportError as e:
    raise RuntimeError("vaultero not installed, check your pyproject.toml commit SHA") from e

from importlib.metadata import version #this will pull the version from pyproject.toml
import bitcoinutils

def uses_vaultero() -> str:
    ver = version("vaultero")
    ver_bitcoinutils = getattr(bitcoinutils, "__version__", None)
    return f"vaultero version: {ver} with bitcoinutils version: {ver_bitcoinutils}" if ver else f"vaultero unkown version"
